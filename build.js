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

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

const CSS = `body{font-family:system-ui,'Hiragino Sans','Yu Gothic',sans-serif;max-width:46rem;margin:0 auto;padding:1rem;line-height:1.8;color:#222}
a{color:#0b5fa5}header{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;align-items:baseline;border-bottom:1px solid #ddd;padding-bottom:.5rem;margin-bottom:1rem}
header .brand{font-weight:700;font-size:1.1rem;text-decoration:none}footer{margin:2rem 0 1rem;color:#555}
h1{font-size:1.6rem}h2{font-size:1.2rem;border-bottom:1px solid #ddd;padding-bottom:.2rem;margin-top:2rem}
.meta span{display:inline-block;margin-right:.5rem;padding:0 .5rem;background:#eef;border-radius:.3rem;font-size:.85rem}
.draft{background:#fff4d6!important}li{margin:.2rem 0}
.pillars{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));margin:1.5rem 0}
.pillar{border:1px solid #ddd;border-radius:.5rem;padding:.8rem 1rem}.pillar h2{margin:0 0 .3rem;border:0;font-size:1.1rem}
.soon{color:#777;font-size:.9rem}
@media (prefers-color-scheme:dark){body{background:#16181b;color:#e6e6e6}a{color:#7ab8f0}header,.pillar,h2{border-color:#333}footer{color:#aaa}.meta span{background:#26304a}.draft{background:#4a3f1a!important}.soon{color:#999}}`;

function page({ title, body, desc = '', jsonld = null, root = '' }) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head><body>
<header><a class="brand" href="${root}index.html">${SITE}</a>
<nav><a href="${root}index.html#dictionary">事典</a> · <a href="${root}news.html">ニュース</a> · <a href="${root}tools.html">ツール</a> · <a href="${root}about.html">このサイトについて</a></nav></header>
<main>${body}</main>
<footer><small>AIが下書きし、人が出典を確認して公開しています。状態が「下書き」の項目は未確認の部分を含みます。</small></footer>
</body></html>`;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'entries'), { recursive: true });
const write = (rel, html) => fs.writeFileSync(path.join(OUT, rel), html);

const entries = [];
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith('.md') || f.startsWith('_')) continue;
  const slug = f.replace(/\.md$/, '');
  const { meta, body } = parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  if (!meta.title) throw new Error(`${f}: title がありません`);
  entries.push({ slug, ...meta });

  const head = `<h1>${esc(meta.title)}</h1>
<p class="meta"><span>${esc(meta.category || '')}</span><span>合意度: ${esc(meta.consensus || '')}</span>
<span class="${meta.status === '確認済み' ? '' : 'draft'}">${esc(meta.status || '')}</span><span>更新: ${esc(meta.updated || '')}</span></p>`;
  write(`entries/${slug}.html`, page({
    title: `${meta.title} | ${SITE}`,
    desc: `${meta.title}の定義・通説・異論・出典`,
    root: '../',
    body: head + marked.parse(body),
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: meta.title, dateModified: meta.updated, inLanguage: 'ja' },
  }));
}

// 分類ごとに一覧
const byCat = {};
for (const e of entries) (byCat[e.category || 'その他'] ||= []).push(e);
const dict = Object.entries(byCat).map(([cat, list]) =>
  `<h3>${esc(cat)}</h3><ul>` + list.sort((a, b) => a.title.localeCompare(b.title, 'ja')).map(e =>
    `<li><a href="entries/${e.slug}.html">${esc(e.title)}</a> <small>${esc(e.status || '')}</small></li>`).join('') + '</ul>').join('\n');

write('index.html', page({
  title: `${SITE}(${TAGLINE}) | コンタクトセンターの事典・ニュース・ツール`,
  desc: 'コンタクトセンターの全貌が分かる日本語サイト。用語・指標・法規制・AI導入を、通説・異論・出典つきで整理。',
  body: `<h1>${SITE} <small>${TAGLINE}</small></h1>
<p>コンタクトセンターの全貌が分かる日本語サイトです。用語・指標・法規制・AI導入を、通説と異論、出典を分けて整理しています。</p>
<div class="pillars">
<div class="pillar"><h2>事典</h2><p>${entries.length}項目を公開中。</p><a href="#dictionary">項目一覧へ</a></div>
<div class="pillar"><h2>ニュース</h2><p class="soon">準備中</p><a href="news.html">詳細</a></div>
<div class="pillar"><h2>ツール</h2><p class="soon">準備中</p><a href="tools.html">詳細</a></div>
</div>
<h2 id="dictionary">事典</h2>${dict}`,
}));

write('news.html', page({
  title: `ニュース | ${SITE}`, desc: 'コンタクトセンター関連ニュース(準備中)',
  body: `<h1>ニュース</h1><p>業界の最新動向を、タイトル・要約・元記事リンクの形で掲載する予定です(準備中)。本文の転載は行いません。</p>`,
}));
write('tools.html', page({
  title: `ツール | ${SITE}`, desc: 'コンタクトセンター向け便利ツール(準備中)',
  body: `<h1>ツール</h1><p>サービスレベルやアーランCの計算など、現場で使える無料ツールを公開する予定です(準備中)。</p>`,
}));
write('about.html', page({
  title: `このサイトについて | ${SITE}`, desc: `${SITE}の方針と運営について`,
  body: `<h1>このサイトについて</h1>
<p>${SITE}は、コンタクトセンターの全貌が分かる日本語サイトを目指しています。</p>
<h2>方針</h2><ul>
<li>「正解」を断定せず、通説・異論・合意度を出典つきで示します</li>
<li>出典のない数値は載せません</li>
<li>更新日と変更理由を残します</li></ul>
<h2>運営</h2><p>AIが下書きし、人が出典を確認して公開しています。項目ごとの状態は「確認済み」「下書き」で示します。「下書き」には、未確認の部分や、ベンダー資料のみを出典とする部分が含まれます。誤りに気づかれた場合は、出典とあわせてお知らせいただけると助かります。</p>`,
}));

// sitemap / robots
const urls = ['index.html', 'news.html', 'tools.html', 'about.html', ...entries.map(e => `entries/${e.slug}.html`)];
if (SITE_URL) {
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
} else {
  write('robots.txt', `User-agent: *\nAllow: /\n`);
  console.log('SITE_URL 未指定のため sitemap.xml は作成しません');
}
console.log(`生成: 事典${entries.length}件 → dist/`);
