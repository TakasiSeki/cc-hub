// ニュース記事のはてなブックマーク数を取得し、data/bookmarks.json に保存する。使い方: npm run bookmarks
// 注目記事の順位づけ(build.js)で使う。数値は取得した時点のもの。
const fs = require('fs');
const path = require('path');

const UA = 'cc-hub-news/0.1 (+https://github.com/TakasiSeki/cc-hub)';
const NEWS = path.join(__dirname, 'data', 'news.json');
const OUT = path.join(__dirname, 'data', 'bookmarks.json');

(async () => {
  const news = JSON.parse(fs.readFileSync(NEWS, 'utf8'));
  const links = news.filter(n => n.source !== '日本コンタクトセンター協会').map(n => n.link);
  const result = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  for (let i = 0; i < links.length; i += 40) {
    const batch = links.slice(i, i + 40);
    const q = batch.map(u => 'url=' + encodeURIComponent(u)).join('&');
    try {
      const res = await fetch('https://bookmark.hatenaapis.com/count/entries?' + q, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      for (const u of batch) result[u] = json[u] || 0;
    } catch (e) { console.error(String(e.message || e)); }
    await new Promise(r => setTimeout(r, 1000));
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
  const total = Object.values(result).filter(v => v > 0).length;
  console.log(`取得${Object.keys(result).length}件 / ブックマークあり${total}件`);
})();
