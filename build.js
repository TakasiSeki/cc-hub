// entries/*.md → dist/ の静的HTMLを生成する。使い方: npm run build
// 公開URLが決まったら SITE_URL を指定する(sitemap.xml 用)。例: SITE_URL=https://user.github.io/repo npm run build
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const SRC = path.join(__dirname, 'entries');
const OUT = path.join(__dirname, 'dist');
const SITE = 'CC Hub';
const TAGLINE = 'コンタクトセンター・ハブ';
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const TAGS = {
  '中立出典': { cls: 'tag-neutral', desc: '官公庁・自治体・公益法人・論文など、販売利益と無関係な出典を含む' },
  '業界団体': { cls: 'tag-assoc', desc: '業界団体(協会)が公開しているガイドラインや調査を含む。業界の自主的な見解で、会員企業の立場が反映される場合がある' },
  '調査レポート': { cls: 'tag-report', desc: '調査会社・コンサルティング会社などが実施した調査の結果を含む' },
  'ベンダー情報': { cls: 'tag-vendor', desc: '製品・サービスを販売する事業者の資料や、その解説記事を出典とする' },
  'メディア記事': { cls: 'tag-media', desc: '新聞・雑誌・Webメディアの記事を出典とする' },
};
// 出典欄の行頭ラベル → 項目タグ(ラベルは「【ラベル】」の形で書く)
const SRC_LABELS = {
  '公的資料': { tag: '中立出典', cls: 'tag-neutral' },
  '公益法人': { tag: '中立出典', cls: 'tag-neutral' },
  '論文': { tag: '中立出典', cls: 'tag-neutral' },
  '業界団体': { tag: '業界団体', cls: 'tag-assoc' },
  '調査レポート': { tag: '調査レポート', cls: 'tag-report' },
  'ベンダー情報': { tag: 'ベンダー情報', cls: 'tag-vendor' },
  'メディア記事': { tag: 'メディア記事', cls: 'tag-media' },
};
const CATS = ['用語', '指標', '運営', 'AI導入', '技術', '法規制', '人材'];

const TOOLS_SRC = path.join(__dirname, 'tools-src');
const readTool = f => fs.readFileSync(path.join(TOOLS_SRC, f), 'utf8');
const TOOLS = [
  { slug: 'erlang-c', title: 'アーランC計算機(必要席数・サービスレベル)', desc: '着信数とAHTから、目標のサービスレベルを満たす必要席数を計算。人数を指定した場合のサービスレベルや待ち時間も確認できます。', tag: '要員計画', seo: '着信数とAHTから、目標のサービスレベルを満たす必要席数を計算する無料ツール。シュリンケージの見込みにも対応。', name: 'アーランC計算機' },
  { slug: 'kpi', title: 'コンタクトセンター KPI計算機', desc: '応答率・放棄呼率・サービスレベル・AHT・占有率・一次解決率・CSAT・NPS を、実績の件数や時間から計算。各指標の計算式と解説へのリンク付き。', tag: 'KPI', seo: '応答率・放棄呼率・サービスレベル・AHT・占有率・FCR・CSAT・NPSを、実績の件数や時間から計算する無料ツール。計算式つき。', name: 'コンタクトセンター KPI計算機' },
  { slug: 'staffing', title: '時間帯別の必要席数 計算ツール', desc: '時間帯ごとの着信数から、必要席数とシュリンケージ込みの配置人数をまとめて計算。Excelからの貼り付けとCSV保存に対応。', tag: '要員計画', seo: '時間帯別の着信数から、必要席数と配置人数をアーランC式でまとめて計算する無料ツール。Excel貼り付けとCSV保存に対応。', name: '時間帯別の必要席数 計算ツール' },
];
const NEWS_FILE = path.join(__dirname, 'data', 'news.json');
const NEWS = (fs.existsSync(NEWS_FILE) ? JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')) : [])
  .map(n => ({ ...n, title: n.title.replace(/[\u3000\s]+/g, ' ').trim() }))
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const fmtDate = d => (d || '').replace(/-/g, '/');
const newsItem = n => `<li class="news-item"><div class="news-meta"><time>${esc(fmtDate(n.date))}</time><span class="badge plain">${esc(n.source)}</span></div><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a></li>`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const catIdx = c => { const i = CATS.indexOf(c); return i < 0 ? CATS.length : i; };

function parse(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('フロントマターがありません');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

// 「## 定義」の最初の段落を、カード用の要約にする
function summary(body) {
  const m = body.match(/##\s*定義\s*\r?\n+([\s\S]*?)(?:\r?\n\r?\n|\r?\n##|$)/);
  if (!m) return '';
  const t = m[1].replace(/[*_`>#]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  return t.length > 90 ? t.slice(0, 88) + '…' : t;
}

const CSS = `
:root{--bg:#f6f7f9;--surface:#fff;--text:#1d2330;--muted:#5d6678;--line:#e4e7ee;--accent:#2f5bea;--accent-soft:#e8eeff;
--ok:#0f7a4b;--ok-soft:#e1f5ea;--rep:#0b6e99;--rep-soft:#dff2fb;--asc:#6b3fc7;--asc-soft:#efe8ff;--warn:#8a5a00;--warn-soft:#fff1cc;--shadow:0 1px 2px rgba(20,30,60,.05),0 6px 20px rgba(20,30,60,.06);--r:14px}
@media (prefers-color-scheme:dark){:root{--bg:#0f131a;--surface:#171c26;--text:#e8ebf2;--muted:#9aa4b8;--line:#272e3d;--accent:#7b9bff;--accent-soft:#1f2a4d;
--ok:#5fd39a;--ok-soft:#14352a;--rep:#74c7ec;--rep-soft:#12334a;--asc:#c0a6ff;--asc-soft:#2c2250;--warn:#f0c15a;--warn-soft:#3a2f12;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo",system-ui,sans-serif;font-size:16px;line-height:1.85;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}a:hover{text-decoration:none}
.wrap{max-width:68rem;margin:0 auto;padding:0 20px}
.site-header{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.site-header .wrap{display:flex;align-items:center;gap:20px;min-height:58px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.15rem;color:var(--text);text-decoration:none;letter-spacing:.01em}
.logo{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#2f5bea,#7a4dff);display:grid;place-items:center;color:#fff;font-size:.8rem;font-weight:800}
.nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
.nav a{padding:6px 12px;border-radius:999px;color:var(--muted);text-decoration:none;font-size:.92rem;font-weight:600}
.nav a:hover,.nav a[aria-current]{background:var(--accent-soft);color:var(--accent)}
.hero{padding:48px 0 28px}
.hero h1{font-size:clamp(1.7rem,4.5vw,2.5rem);line-height:1.35;margin:0 0 12px;letter-spacing:.01em}
.hero p{margin:0;color:var(--muted);max-width:40rem;font-size:1.02rem}
.search{margin-top:22px;position:relative;max-width:36rem}
.search input{width:100%;padding:14px 16px 14px 44px;font:inherit;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);box-shadow:var(--shadow)}
.search input:focus{outline:2px solid var(--accent);outline-offset:1px}
.search svg{position:absolute;left:15px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--muted)}
.pillars{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin:8px 0 8px}
.pillar{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;box-shadow:var(--shadow);text-decoration:none;color:inherit;display:block}
.pillar b{display:block;font-size:1.05rem;margin-bottom:2px}.pillar span{color:var(--muted);font-size:.9rem}
.pillar.soon{opacity:.85}
.pillar .tag{float:right;font-size:.72rem;padding:2px 8px;border-radius:999px;background:var(--line);color:var(--muted);font-weight:700}
.sec-title{display:flex;align-items:baseline;gap:12px;margin:40px 0 14px}.sec-title h2{margin:0;font-size:1.3rem}.sec-title small{color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.chip{border:1px solid var(--line);background:var(--surface);color:var(--text);padding:6px 14px;border-radius:999px;font:inherit;font-size:.88rem;font-weight:600;cursor:pointer}
.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;box-shadow:var(--shadow);text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:8px;transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--accent)}
.card h3{margin:0;font-size:1.05rem;line-height:1.5}.card p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.7;flex:1}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--accent-soft);color:var(--accent);line-height:1.7}
.badge.tag-neutral{background:var(--ok-soft);color:var(--ok)}.badge.tag-vendor{background:var(--warn-soft);color:var(--warn)}.badge.tag-assoc{background:var(--asc-soft);color:var(--asc)}.badge.tag-report{background:var(--rep-soft);color:var(--rep)}.badge.tag-media{background:var(--line);color:var(--muted)}.badge.plain{background:var(--line);color:var(--muted)}.badge.src{margin-right:6px;font-size:.7rem}
.chips-label{font-size:.8rem;color:var(--muted);font-weight:700;margin:10px 0 6px}.empty{display:none;padding:30px;text-align:center;color:var(--muted)}
.crumb{font-size:.85rem;color:var(--muted);margin:26px 0 6px}.crumb a{color:var(--muted)}
.article-head{margin-bottom:6px}.article-head h1{font-size:clamp(1.6rem,4vw,2.2rem);line-height:1.4;margin:6px 0 12px}
.meta-line{color:var(--muted);font-size:.85rem;margin-top:10px}
.layout{display:grid;gap:36px;grid-template-columns:minmax(0,1fr);margin-bottom:40px}
@media (min-width:60rem){.layout{grid-template-columns:minmax(0,1fr) 14rem}}
.toc{position:sticky;top:78px;align-self:start;font-size:.88rem;display:none}
@media (min-width:60rem){.toc{display:block}}
.toc b{display:block;margin-bottom:8px;color:var(--muted);font-size:.78rem;letter-spacing:.06em}
.toc a{display:block;padding:5px 12px;border-left:2px solid var(--line);color:var(--muted);text-decoration:none}
.toc a:hover{border-color:var(--accent);color:var(--accent)}
.notice{border-radius:12px;padding:12px 16px;font-size:.9rem;margin:14px 0 20px}
.notice{background:var(--accent-soft);color:var(--text)}.notice p{margin:.2em 0}.notice.draft{background:var(--warn-soft);color:var(--warn)}.legend{display:grid;gap:10px;padding:0;list-style:none}.legend li{display:flex;gap:10px;align-items:baseline}
.sec{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:6px 24px 14px;margin-bottom:16px;box-shadow:var(--shadow)}
.sec h2{font-size:1.15rem;margin:18px 0 8px;display:flex;align-items:center;gap:10px}
.sec h2::before{content:"";width:5px;height:1.1em;border-radius:3px;background:var(--accent)}
.sec-caution{background:var(--warn-soft);border-color:transparent}.sec-caution h2::before{background:var(--warn)}
.sec-source h2::before{background:var(--ok)}.sec-source{font-size:.9rem;overflow-wrap:anywhere}
.sec ul,.sec ol{padding-left:1.3em}.sec li{margin:.35em 0}
.sec p{margin:.6em 0}
.sec code{background:var(--line);padding:1px 6px;border-radius:5px;font-size:.9em}
.news-list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.news-item{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.news-item a{display:block;font-weight:600;line-height:1.6;text-decoration:none;color:var(--text)}.news-item a:hover{color:var(--accent)}
.news-meta{display:flex;gap:8px;align-items:center;font-size:.8rem;color:var(--muted);margin-bottom:2px}
.news-month{font-size:.95rem;color:var(--muted);margin:26px 0 10px;font-weight:700}
.lead{color:var(--muted);max-width:44rem;margin:.2rem 0 0}
.tool{margin:18px 0 50px}.tool-form,.tool-out{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:8px 24px 20px;box-shadow:var(--shadow);margin-bottom:16px}
.tool h2{font-size:1.15rem;margin:16px 0 10px}.tool h3{font-size:1rem;margin:22px 0 8px}
.tool-grid{display:grid;gap:14px 18px;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))}
.tool-grid label{display:flex;flex-direction:column;gap:4px;font-size:.88rem;font-weight:700;color:var(--muted)}
.tool-grid select,.tool textarea{font:inherit;font-size:1rem;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);width:100%}.tool textarea{resize:vertical}.btn-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.tool-grid input{font:inherit;font-size:1rem;font-weight:400;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);width:100%}
.tool-grid input:focus{outline:2px solid var(--accent);outline-offset:1px}
.hint{font-size:.85rem;color:var(--muted);margin:14px 0 0}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))}
.stat{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--bg)}
.stat.main{background:var(--accent-soft);border-color:transparent}.stat.warn{background:var(--warn-soft);border-color:transparent}.stat.ok{background:var(--ok-soft);border-color:transparent}
.stat-label{font-size:.78rem;color:var(--muted);font-weight:700}.stat-value{font-size:1.5rem;font-weight:800;line-height:1.4}.stat-note{font-size:.78rem;color:var(--muted);line-height:1.5}
.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.92rem}th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}
th{color:var(--muted);font-size:.8rem}
.cell{width:6rem;padding:6px 8px;font:inherit;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);text-align:right}
.bars{display:flex;align-items:flex-end;gap:4px;height:11rem;margin:6px 0 18px;overflow-x:auto;padding-bottom:2px}
.bar{flex:1 0 2rem;max-width:3.2rem;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:.7rem;color:var(--muted)}
.bar-fill{width:70%;min-height:2px;background:var(--accent);border-radius:4px 4px 0 0}.bar-n{font-weight:700;color:var(--text);order:-1}.bar-t{margin-top:2px;white-space:nowrap}tr.hit td{background:var(--accent-soft);font-weight:700}
.tool .sec{margin-top:16px}
.kpi-list{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))}
.kpi{border:1px solid var(--line);border-radius:12px;padding:12px 16px;background:var(--bg);display:flex;flex-direction:column;gap:4px}
.kpi-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.kpi-label{font-weight:700;font-size:.9rem}.kpi-value{font-size:1.45rem;font-weight:800;white-space:nowrap}
.kpi-f{font-size:.8rem;color:var(--muted)}.kpi-n{font-size:.8rem;color:var(--muted);line-height:1.6}.kpi-a{font-size:.8rem;margin-top:2px}
.tool-cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))}
.page-wide{max-width:50rem;margin:36px 0 60px}.page-wide h1{font-size:1.8rem}
.page{max-width:44rem;margin:36px 0 60px}.page h1{font-size:1.8rem}.page h2{margin-top:30px}
.site-footer{border-top:1px solid var(--line);margin-top:30px;padding:26px 0 40px;color:var(--muted);font-size:.85rem}
.site-footer .wrap{display:flex;flex-wrap:wrap;gap:12px 28px;justify-content:space-between}
`;

const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

function nav(root, cur) {
  const item = (href, label, key) => `<a href="${root}${href}"${cur === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="nav" aria-label="メイン">${item('index.html#dictionary', '事典', 'dict')}${item('news.html', 'ニュース', 'news')}${item('tools.html', 'ツール', 'tools')}${item('about.html', 'このサイトについて', 'about')}</nav>`;
}

function page({ title, body, desc = '', jsonld = null, root = '', cur = '' }) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head><body>
<header class="site-header"><div class="wrap">
<a class="brand" href="${root}index.html"><span class="logo">CC</span>${SITE}</a>${nav(root, cur)}</div></header>
${body}
<footer class="site-footer"><div class="wrap"><div>${SITE}(${TAGLINE})<br>AIがネット上の情報をもとに作成し、出典を明記しています。</div>
<div><a href="${root}about.html">このサイトについて</a></div></div></footer>
</body></html>`;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'entries'), { recursive: true });
const write = (rel, html) => fs.writeFileSync(path.join(OUT, rel), html);

const SEC_CLASS = h => /異論|注意/.test(h) ? 'sec-caution' : /出典/.test(h) ? 'sec-source' : '';
const deriveTags = body => {
  const m = body.match(/## 出典\r?\n([\s\S]*?)(?=\r?\n## |$)/);
  const found = new Set();
  for (const x of (m ? m[1] : '').matchAll(/^- 【([^】]+)】/gm)) if (SRC_LABELS[x[1]]) found.add(SRC_LABELS[x[1]].tag);
  return Object.keys(TAGS).filter(t => found.has(t));
};
const tagBadges = tags => tags.map(t => `<span class="badge ${(TAGS[t] || {}).cls || 'plain'}">${esc(t)}</span>`).join('');
const labelSources = html => html.replace(/<li>【([^】]+)】/g, (m, l) => SRC_LABELS[l] ? `<li><span class="badge src ${SRC_LABELS[l].cls}">${l}</span>` : m);

const entries = [];
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith('.md') || f.startsWith('_')) continue;
  const slug = f.replace(/\.md$/, '');
  const { meta, body } = parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  if (!meta.title) throw new Error(`${f}: title がありません`);
  const tags = deriveTags(body);
  entries.push({ slug, summary: summary(body), ...meta, tags });

  // 見出しごとにカード化し、目次を作る
  const chunks = labelSources(marked.parse(body)).split(/(?=<h2>)/).filter(s => s.trim());
  const toc = [];
  const sections = chunks.map((c, i) => {
    const h = (c.match(/<h2>(.*?)<\/h2>/) || [])[1];
    if (!h) return c;
    const id = 's' + i;
    toc.push(`<a href="#${id}">${h.replace(/<[^>]+>/g, '')}</a>`);
    return `<section class="sec ${SEC_CLASS(h)}" id="${id}">${c}</section>`;
  }).join('\n');

  const notes = [];
  if (tags.includes('中立出典')) notes.push('官公庁・自治体・公益法人・論文など、中立的な出典を含みます。');
  if (tags.includes('調査レポート')) notes.push('調査会社・コンサルティング会社による調査結果を含みます。');
  if (tags.includes('ベンダー情報')) notes.push(tags.includes('中立出典') ? '一部の内容は、ベンダー(事業者)の資料に基づきます。' : '出典は、ベンダー(事業者)の資料が中心です。中立的な出典は未確認です。');
  if (tags.includes('メディア記事')) notes.push('メディアの記事を含みます。');
  if (!notes.length) notes.push('出典の種類が分類されていません。');
  const notice = `<div class="notice">${notes.map(n => `<p>${n}</p>`).join('')}<p>出典ごとのラベルは出典欄にあります。<a href="../about.html#tags">タグの意味</a></p></div>`;
  write(`entries/${slug}.html`, page({
    title: `${meta.title} | ${SITE}`,
    desc: `${meta.title}の定義・通説・異論・出典`,
    root: '../', cur: 'dict',
    body: `<div class="wrap">
<div class="crumb"><a href="../index.html">ホーム</a> › <a href="../index.html#dictionary">事典</a> › ${esc(meta.category || '')}</div>
<div class="article-head"><div class="badges"><span class="badge">${esc(meta.category || '')}</span>${tagBadges(tags)}<span class="badge plain">合意度: ${esc(meta.consensus || '')}</span></div>
<h1>${esc(meta.title)}</h1><div class="meta-line">最終更新: ${esc(meta.updated || '')}</div></div>
${notice}
<div class="layout"><article>${sections}</article><aside class="toc"><b>目次</b>${toc.join('')}</aside></div></div>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: meta.title, dateModified: meta.updated, inLanguage: 'ja' },
  }));
}

entries.sort((a, b) => catIdx(a.category) - catIdx(b.category) || a.title.localeCompare(b.title, 'ja'));
const usedCats = CATS.filter(c => entries.some(e => e.category === c));
const cards = entries.map(e => `<a class="card" href="entries/${e.slug}.html" data-cat="${esc(e.category || '')}" data-tags="${esc(e.tags.join(','))}" data-q="${esc((e.title + ' ' + e.summary + ' ' + (e.category || '')).toLowerCase())}">
<div class="badges"><span class="badge">${esc(e.category || '')}</span>${tagBadges(e.tags)}</div>
<h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p></a>`).join('\n');

const SCRIPT = `<script>
(function(){var q=document.getElementById('q'),cards=[].slice.call(document.querySelectorAll('.card')),empty=document.getElementById('empty'),sel={cat:'',tag:''};
function apply(){var t=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){var ok=(!sel.cat||c.dataset.cat===sel.cat)&&(!sel.tag||c.dataset.tags.split(',').indexOf(sel.tag)>-1)&&(!t||c.dataset.q.indexOf(t)>-1);c.style.display=ok?'':'none';if(ok)n++});empty.style.display=n?'none':'block'}
q.addEventListener('input',apply);
[].slice.call(document.querySelectorAll('.chip')).forEach(function(b){b.addEventListener('click',function(){var g=b.dataset.group;sel[g]=b.dataset.val;[].slice.call(document.querySelectorAll('.chip[data-group="'+g+'"]')).forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});apply()})})})();
</script>`;

write('index.html', page({
  title: `${SITE}(${TAGLINE}) | コンタクトセンターの事典・ニュース・ツール`,
  desc: 'コンタクトセンターの全貌が分かる日本語サイト。用語・指標・法規制・AI導入を、通説・異論・出典つきで整理。',
  cur: '',
  body: `<div class="wrap">
<section class="hero"><h1>コンタクトセンターの全貌が、<br>ひとつで分かる。</h1>
<p>用語・指標・法規制・AI導入を、通説と異論、出典を分けて整理した日本語の事典です。ニュースや便利ツールも順次公開します。</p>
<div class="search">${SEARCH_ICON}<input id="q" type="search" placeholder="用語を検索(例: AHT、カスハラ、ボイスボット)" aria-label="事典内を検索"></div></section>
<div class="pillars">
<a class="pillar" href="#dictionary"><b>事典</b><span>${entries.length}項目を公開中</span></a>
<a class="pillar" href="news.html"><b>ニュース</b><span>${NEWS.length}件を掲載(最新: ${esc(fmtDate((NEWS[0] || {}).date))})</span></a>
<a class="pillar" href="tools.html"><b>ツール</b><span>${TOOLS.length}個を公開中(KPI・要員計画)</span></a></div>
${NEWS.length ? `<div class="sec-title"><h2>最新ニュース</h2><small><a href="news.html">すべて見る</a></small></div><ul class="news-list">${NEWS.slice(0, 5).map(newsItem).join('')}</ul>` : ''}
<div class="sec-title" id="dictionary"><h2>事典</h2><small>${entries.length}項目</small></div>
<div class="chips-label">分類</div><div class="chips"><button class="chip" data-group="cat" data-val="" aria-pressed="true">すべて</button>${usedCats.map(c => `<button class="chip" data-group="cat" data-val="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div>
<div class="chips-label">出典のタイプ</div><div class="chips"><button class="chip" data-group="tag" data-val="" aria-pressed="true">すべて</button>${Object.keys(TAGS).map(t => `<button class="chip" data-group="tag" data-val="${t}" aria-pressed="false">${t}</button>`).join('')}</div>
<div class="cards">${cards}</div><div class="empty" id="empty">該当する項目が見つかりませんでした。</div></div>${SCRIPT}`,
}));

const simple = (file, key, title, desc, inner) => write(file, page({
  title: `${title} | ${SITE}`, desc, cur: key, body: `<div class="wrap"><div class="page"><h1>${title}</h1>${inner}</div></div>`,
}));
const byMonth = {};
for (const n of NEWS) (byMonth[(n.date || '').slice(0, 7) || '日付不明'] ||= []).push(n);
const newsBody = NEWS.length
  ? Object.entries(byMonth).map(([m, list]) => `<div class="news-month">${esc(m.replace('-', '年') + (m.includes('-') ? '月' : ''))}</div><ul class="news-list">${list.map(newsItem).join('')}</ul>`).join('')
  : '<div class="notice draft">まだニュースがありません。</div>';
write('news.html', page({
  title: `ニュース | ${SITE}`, desc: 'コンタクトセンター関連ニュースの一覧(タイトルと元記事へのリンク)', cur: 'news',
  body: `<div class="wrap"><div class="page-wide"><h1>ニュース</h1>
<p>コンタクトセンター関連のニュースを、タイトルと元記事へのリンクで紹介します。本文の転載は行いません。記事は各媒体のサイトで読めます。</p>
<p><small>掲載元: ITmedia、TechTarget ジャパン(コンタクトセンター関連の記事一覧から収集)。関連の薄い記事が混じることがあります。</small></p>
<div class="search" style="margin:14px 0 6px">${SEARCH_ICON}<input id="nq" type="search" placeholder="ニュースを検索(例: カスハラ、AI、ボイスボット)" aria-label="ニュース内を検索"></div>
<div id="nlist">${newsBody}</div><div class="empty" id="nempty">該当するニュースが見つかりませんでした。</div></div></div>
<script>(function(){var q=document.getElementById('nq'),items=[].slice.call(document.querySelectorAll('.news-item')),months=[].slice.call(document.querySelectorAll('.news-month')),empty=document.getElementById('nempty');
q.addEventListener('input',function(){var t=q.value.trim().toLowerCase(),n=0;items.forEach(function(li){var ok=!t||li.textContent.toLowerCase().indexOf(t)>-1;li.style.display=ok?'':'none';if(ok)n++});
months.forEach(function(m){var ul=m.nextElementSibling,vis=[].slice.call(ul.children).some(function(li){return li.style.display!=='none'});m.style.display=vis?'':'none';ul.style.display=vis?'':'none'});empty.style.display=n?'none':'block'})})();</script>`,
}));
fs.mkdirSync(path.join(OUT, 'tools'), { recursive: true });
write('tools.html', page({
  title: `ツール | ${SITE}`, desc: 'コンタクトセンター向けの無料計算ツール', cur: 'tools',
  body: `<div class="wrap"><div class="page-wide"><h1>ツール</h1>
<p>現場で使える無料の計算ツールです。入力した値はブラウザの中だけで計算され、外部には送信されません。</p>
<div class="tool-cards">${TOOLS.map(t => `<a class="card" href="tools/${t.slug}.html"><div class="badges"><span class="badge">${esc(t.tag)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p></a>`).join('')}</div>
<p><small>ツールは順次追加します。ご要望があれば、お知らせください。</small></p></div></div>`,
}));
for (const t of TOOLS) {
  write(`tools/${t.slug}.html`, page({
    title: `${t.title} | ${SITE}`, desc: t.seo, root: '../', cur: 'tools',
    body: readTool(`${t.slug}.body.html`) + `<script>${readTool('erlang.js')}</script><script>${readTool(`${t.slug}.ui.js`)}</script>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'ja', offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' } },
  }));
}
simple('about.html', 'about', 'このサイトについて', `${SITE}の方針と運営について`,
  `<p>${SITE}は、コンタクトセンターの全貌が分かる日本語サイトを目指しています。</p>
<h2>方針</h2><ul><li>「正解」を断定せず、通説・異論・合意度を出典つきで示します</li><li>出典のない数値は載せません</li><li>更新日と変更理由を残します</li></ul>
<h2>運営</h2><p>AIがネット上の情報をもとに下書きを作り、出典を確認しながら公開しています。確認の範囲は、各項目の出典欄に書いています。ページの内容は、出典に基づいて随時更新します。</p>
<h2 id="tags">タグの意味</h2><ul class="legend">${Object.entries(TAGS).map(([t, v]) => `<li><span class="badge ${v.cls}">${t}</span><span>${v.desc}</span></li>`).join('')}</ul>
<p>出典欄の各行にも、「公的資料」「公益法人」「論文」「業界団体」「調査レポート」「ベンダー情報」「メディア記事」のラベルを付けています。項目のタグは、出典欄のラベルから自動で決まります。複数のタグが付く項目もあります。タグの種類は、必要に応じて増やします。</p>
<p>誤りに気づかれた場合は、出典とあわせてお知らせいただけると助かります。</p>`);

const urls = ['index.html', 'news.html', 'tools.html', 'about.html', ...TOOLS.map(t => `tools/${t.slug}.html`), ...entries.map(e => `entries/${e.slug}.html`)];
if (SITE_URL) {
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
} else {
  write('robots.txt', `User-agent: *\nAllow: /\n`);
  console.log('SITE_URL 未指定のため sitemap.xml は作成しません');
}
console.log(`生成: 事典${entries.length}件 → dist/`);
