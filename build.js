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
  '調査レポート': { cls: 'tag-report', desc: '調査会社・コンサルティング会社などが実施した調査の結果を含む' },
  'ベンダー情報': { cls: 'tag-vendor', desc: '製品・サービスを販売する事業者の資料や、その解説記事を出典とする' },
  'メディア記事': { cls: 'tag-media', desc: '新聞・雑誌・Webメディアの記事を出典とする' },
};
// 出典欄の行頭ラベル → 項目タグ(ラベルは「【ラベル】」の形で書く)
const SRC_LABELS = {
  '公的資料': { tag: '中立出典', cls: 'tag-neutral' },
  '公益法人': { tag: '中立出典', cls: 'tag-neutral' },
  '論文': { tag: '中立出典', cls: 'tag-neutral' },
  '調査レポート': { tag: '調査レポート', cls: 'tag-report' },
  'ベンダー情報': { tag: 'ベンダー情報', cls: 'tag-vendor' },
  'メディア記事': { tag: 'メディア記事', cls: 'tag-media' },
};
const CATS = ['用語', '指標', '運営', 'AI導入', '技術', '法規制', '人材'];

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
--ok:#0f7a4b;--ok-soft:#e1f5ea;--rep:#0b6e99;--rep-soft:#dff2fb;--warn:#8a5a00;--warn-soft:#fff1cc;--shadow:0 1px 2px rgba(20,30,60,.05),0 6px 20px rgba(20,30,60,.06);--r:14px}
@media (prefers-color-scheme:dark){:root{--bg:#0f131a;--surface:#171c26;--text:#e8ebf2;--muted:#9aa4b8;--line:#272e3d;--accent:#7b9bff;--accent-soft:#1f2a4d;
--ok:#5fd39a;--ok-soft:#14352a;--rep:#74c7ec;--rep-soft:#12334a;--warn:#f0c15a;--warn-soft:#3a2f12;--shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}}
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
.badge.tag-neutral{background:var(--ok-soft);color:var(--ok)}.badge.tag-vendor{background:var(--warn-soft);color:var(--warn)}.badge.tag-report{background:var(--rep-soft);color:var(--rep)}.badge.tag-media{background:var(--line);color:var(--muted)}.badge.plain{background:var(--line);color:var(--muted)}.badge.src{margin-right:6px;font-size:.7rem}
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
<a class="pillar soon" href="news.html"><span class="tag">準備中</span><b>ニュース</b><span>業界の最新動向をまとめて確認</span></a>
<a class="pillar soon" href="tools.html"><span class="tag">準備中</span><b>ツール</b><span>現場で使える無料の計算ツール</span></a></div>
<div class="sec-title" id="dictionary"><h2>事典</h2><small>${entries.length}項目</small></div>
<div class="chips-label">分類</div><div class="chips"><button class="chip" data-group="cat" data-val="" aria-pressed="true">すべて</button>${usedCats.map(c => `<button class="chip" data-group="cat" data-val="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}</div>
<div class="chips-label">出典のタイプ</div><div class="chips"><button class="chip" data-group="tag" data-val="" aria-pressed="true">すべて</button>${Object.keys(TAGS).map(t => `<button class="chip" data-group="tag" data-val="${t}" aria-pressed="false">${t}</button>`).join('')}</div>
<div class="cards">${cards}</div><div class="empty" id="empty">該当する項目が見つかりませんでした。</div></div>${SCRIPT}`,
}));

const simple = (file, key, title, desc, inner) => write(file, page({
  title: `${title} | ${SITE}`, desc, cur: key, body: `<div class="wrap"><div class="page"><h1>${title}</h1>${inner}</div></div>`,
}));
simple('news.html', 'news', 'ニュース', 'コンタクトセンター関連ニュース(準備中)',
  '<div class="notice draft">準備中です。</div><p>業界の最新動向を、タイトル・要約・元記事へのリンクの形で掲載する予定です。本文の転載は行いません。</p>');
simple('tools.html', 'tools', 'ツール', 'コンタクトセンター向け便利ツール(準備中)',
  '<div class="notice draft">準備中です。</div><p>サービスレベルやアーランCの計算など、現場で使える無料ツールを公開する予定です。事典の項目からも、関連するツールへ移動できるようにします。</p>');
simple('about.html', 'about', 'このサイトについて', `${SITE}の方針と運営について`,
  `<p>${SITE}は、コンタクトセンターの全貌が分かる日本語サイトを目指しています。</p>
<h2>方針</h2><ul><li>「正解」を断定せず、通説・異論・合意度を出典つきで示します</li><li>出典のない数値は載せません</li><li>更新日と変更理由を残します</li></ul>
<h2>運営</h2><p>AIがネット上の情報をもとに下書きを作り、出典を確認しながら公開しています。確認の範囲は、各項目の出典欄に書いています。ページの内容は、出典に基づいて随時更新します。</p>
<h2 id="tags">タグの意味</h2><ul class="legend">${Object.entries(TAGS).map(([t, v]) => `<li><span class="badge ${v.cls}">${t}</span><span>${v.desc}</span></li>`).join('')}</ul>
<p>出典欄の各行にも、「公的資料」「公益法人」「論文」「調査レポート」「ベンダー情報」「メディア記事」のラベルを付けています。項目のタグは、出典欄のラベルから自動で決まります。複数のタグが付く項目もあります。タグの種類は、必要に応じて増やします。</p>
<p>誤りに気づかれた場合は、出典とあわせてお知らせいただけると助かります。</p>`);

const urls = ['index.html', 'news.html', 'tools.html', 'about.html', ...entries.map(e => `entries/${e.slug}.html`)];
if (SITE_URL) {
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
} else {
  write('robots.txt', `User-agent: *\nAllow: /\n`);
  console.log('SITE_URL 未指定のため sitemap.xml は作成しません');
}
console.log(`生成: 事典${entries.length}件 → dist/`);
