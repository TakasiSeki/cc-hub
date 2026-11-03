// コンタクトセンター関連ニュースを取得し、data/news.json に追記する。使い方: npm run news
// 保存するのは、タイトル・リンク・日付・媒体・一致キーワードのみ。本文・概要は保存しない。
const fs = require('fs');
const path = require('path');

const UA = 'cc-hub-news/0.1 (+https://github.com/TakasiSeki/cc-hub)';
const FILE = path.join(__dirname, 'data', 'news.json');

// 全件を対象にするRSS: キーワードで絞る
const RSS_FEEDS = [
  { name: 'PR TIMES', url: 'https://prtimes.jp/index.rdf' },
  { name: 'ITmedia', url: 'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml' },
];
// すでにテーマで絞られた一覧ページ(HTML): そのまま採用する
const LIST_PAGES = [
  { name: 'ITmedia', url: 'https://www.itmedia.co.jp/keywords/contactcenter.html' },
  { name: 'ITmedia', url: 'https://atmarkit.itmedia.co.jp/ait/kw/contactcenter.html' },
  { name: 'TechTarget ジャパン', url: 'https://techtarget.itmedia.co.jp/tt/wpkw/contactcenter.html' },
];
// 日本コンタクトセンター協会(CCAJ)のお知らせ: 日付と見出しの表
const CCAJ_YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1];
// 一覧ページから除く記事(広告記事、テーマと無関係なもの)
const EXCLUDE = ['アジャイル', '開発管理', 'ネットワークエンジニア', '【無料PDF】', '価格交渉促進月間', '行政相談月間'];
// どこに出ても対象にする語 / タイトルだけで判定する広めの語 / 英字の語(単語として一致したときのみ)
const CORE = ['コンタクトセンター', 'コールセンター', 'カスタマーハラスメント', 'カスハラ', 'ボイスボット', 'AIオペレーター', 'お客様センター'];
const TITLE_ONLY = ['カスタマーサポート', 'カスタマーサービス', 'お客様窓口', '問い合わせ対応', '電話応対'];
const ASCII = ['IVR', 'CTI', 'CCaaS', 'CX'];

const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (block, t) => { const m = block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ''; };

function matchKeywords(title, text) {
  const hit = [];
  for (const k of CORE) if (text.includes(k)) hit.push(k);
  for (const k of TITLE_ONLY) if (title.includes(k)) hit.push(k);
  for (const k of ASCII) if (new RegExp(`(^|[^A-Za-z0-9])${k}($|[^A-Za-z0-9])`).test(title)) hit.push(k);
  return hit;
}

// 日付を YYYY-MM-DD(日本時間)にそろえる
function toDate(s) {
  const t = String(s).trim();
  let m = t.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(t);
  if (isNaN(d)) return '';
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const head = new TextDecoder('latin1').decode(buf.slice(0, 3000));
  const cs = ((head.match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8').toLowerCase();
  return new TextDecoder(cs).decode(buf);
}

async function fromRss(feed) {
  const xml = await get(feed.url);
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  const items = blocks.map(b => {
    const title = tag(b, 'title');
    return { source: feed.name, title, link: tag(b, 'link'), date: toDate(tag(b, 'dc:date') || tag(b, 'pubDate')), keywords: matchKeywords(title, title + ' ' + tag(b, 'description')) };
  });
  return { total: items.length, hits: items.filter(i => i.link && i.keywords.length) };
}

async function fromList(page) {
  const html = await get(page.url);
  const items = [];
  for (const m of html.matchAll(/<p class="(?:newsart|otherart)">([\s\S]*?)<\/p>/g)) {
    const block = m[1];
    if (/PR[：:]/.test(block)) continue; // 広告記事は除く
    const a = block.match(/<a href="([^"]+)">(?:<img[^>]*>)?<strong>(?!<small>)([\s\S]*?)<\/strong><\/a>/);
    const d = block.match(/[（(](\d{4}\/\d{1,2}\/\d{1,2})[）)]/);
    if (!a || !d) continue;
    const title = decode(a[2].replace(/<[^>]+>/g, ''));
    if (EXCLUDE.some(k => title.includes(k))) continue;
    items.push({ source: /techtarget.itmedia/.test(a[1]) ? 'TechTarget ジャパン' : page.name, title, link: a[1], date: toDate(d[1]), keywords: [] });
  }
  return { total: items.length, hits: items };
}

async function fromCcaj(year) {
  const url = `https://ccaj.or.jp/information_backnumber/back_topics_${year}.html`;
  const html = await get(url);
  const items = [];
  for (const m of html.matchAll(/<td class="col-3c">\s*(\d{4}\/\d{1,2}\/\d{1,2})\s*<\/td>\s*<td[^>]*>\s*<a href="([^"]+)"><strong>([\s\S]*?)<\/strong><\/a>/g)) {
    const title = decode(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
    if (EXCLUDE.some(k => title.includes(k))) continue;
    const link = m[2].startsWith('http') ? m[2] : new URL(m[2], url).href;
    items.push({ source: '日本コンタクトセンター協会', title, link, date: toDate(m[1]), keywords: [] });
  }
  return { total: items.length, hits: items, url };
}

(async () => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
  const seen = new Set(old.map(n => n.link));
  const added = [];
  const jobs = [...RSS_FEEDS.map(f => [f, fromRss]), ...LIST_PAGES.map(p => [p, fromList]), ...CCAJ_YEARS.map(y => [{ name: `CCAJ ${y}`, url: `${y}` }, () => fromCcaj(y)])];
  for (const [src, fn] of jobs) {
    try {
      const { total, hits } = await fn(src);
      console.log(`${src.name}: 取得${total}件 / 対象${hits.length}件 (${src.url})`);
      for (const i of hits) {
        if (!i.title || seen.has(i.link)) continue;
        seen.add(i.link);
        added.push({ ...i, fetched: new Date().toISOString().slice(0, 10) });
      }
    } catch (e) { console.error(String(e.message || e)); }
  }
  const all = [...added, ...old].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (added.length || !fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(all, null, 1) + '\n');
  console.log(`新規${added.length}件 / 累計${all.length}件`);
  for (const n of added.slice(0, 10)) console.log(`- ${n.date} [${n.source}] ${n.title}`);
})();
