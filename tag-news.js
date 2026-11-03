// ニュースの記事ページを読み、data/news-tags.json の辞書でタグを付けて data/news.json に tags として保存する。
// 本文は保存しない(タグだけ)。題名に一致すれば付与、本文は3回以上の一致で付与。
// 使い方: node tag-news.js          (tags 未設定の記事だけ処理)
//         node tag-news.js --all    (全件やり直し)
//         node tag-news.js --offline (本文を取らず、題名だけで付与)
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'data');
const news = JSON.parse(fs.readFileSync(path.join(DATA, 'news.json'), 'utf8'));
const dict = JSON.parse(fs.readFileSync(path.join(DATA, 'news-tags.json'), 'utf8'));
const ALL = process.argv.includes('--all');
const OFFLINE = process.argv.includes('--offline');
const BODY_MIN = 3;
const UA = 'cc-hub-news-tagger/1.0 (+https://takasiseki.github.io/cc-hub/)';

const count = (text, keys, cs) => {
  let n = 0;
  const t = cs ? text : text.toLowerCase();
  for (const k0 of keys) {
    const k = cs ? k0 : k0.toLowerCase();
    if (!k) continue;
    // 英数字だけの語は、前後が英数字なら別の語として数えない(例: SIP と SIPS、SV と SVG)
    const ascii = /^[A-Za-z0-9 .\-]+$/.test(k);
    let i = 0;
    while ((i = t.indexOf(k, i)) >= 0) {
      const b = t[i - 1], a = t[i + k.length];
      if (!ascii || (!/[A-Za-z0-9]/.test(b || '') && !/[A-Za-z0-9]/.test(a || ''))) n++;
      i += k.length;
    }
  }
  return n;
};

const textOf = html => html
  .replace(/<(script|style|noscript|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;|&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ');

const fetchText = async url => {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) return { err: 'HTTP ' + r.status };
    return { text: textOf(await r.text()) };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(to); }
};

const tagOne = (title, body) => {
  const out = [];
  for (const d of dict) {
    const cs = !!d.caseSensitive;
    const inTitle = count(title, d.match, cs) > 0;
    const inBody = body ? count(body, d.match, cs) >= BODY_MIN : false;
    if (inTitle || inBody) out.push(d.tag);
  }
  return out;
};

(async () => {
  let done = 0, fail = 0;
  for (const n of news) {
    if (!ALL && Array.isArray(n.tags)) continue;
    let body = '';
    // CCAJの記事ページは共通部分の文言が多くて誤判定するため、題名だけで判定する
    if (!OFFLINE && n.source !== '日本コンタクトセンター協会') {
      const r = await fetchText(n.link);
      if (r.err) { fail++; n.tagNote = '本文取得不可(' + r.err + ')'; } else { body = r.text; delete n.tagNote; }
      await new Promise(r => setTimeout(r, 1000));
    }
    n.tags = tagOne(n.title, body);
    done++;
  }
  fs.writeFileSync(path.join(DATA, 'news.json'), JSON.stringify(news, null, 1), 'utf8');

  // 事典にないタグ(候補)の集計
  const freq = {};
  for (const n of news) for (const t of n.tags || []) freq[t] = (freq[t] || 0) + 1;
  const cand = dict.filter(d => !d.entry && freq[d.tag]).sort((a, b) => freq[b.tag] - freq[a.tag]);
  const lines = ['# 事典・企業ページにないタグ(新規作成の候補)', '', '`node tag-news.js` が自動で作る一覧。件数の多い順。', ''];
  for (const type of ['topic', 'company']) {
    lines.push('## ' + (type === 'topic' ? '事典の項目の候補' : '企業ページの候補'), '');
    for (const d of cand.filter(d => d.type === type)) {
      const ex = news.filter(n => (n.tags || []).includes(d.tag)).slice(0, 2).map(n => n.title);
      lines.push(`- **${d.tag}** ${freq[d.tag]}件 — 例: ${ex.join(' / ')}`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(DATA, 'tag-candidates.md'), lines.join('\n'), 'utf8');
  console.log(`処理 ${done}件 / 本文取得失敗 ${fail}件 / タグ付き ${news.filter(n => (n.tags || []).length).length}/${news.length}件`);
})();
