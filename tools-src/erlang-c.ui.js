(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ids = ['calls', 'interval', 'aht', 'sl', 'target', 'shrink', 'agents'];
  var pct = function (x) { return (x * 100).toFixed(1) + '%'; };
  var sec = function (x) { return isFinite(x) ? (x >= 100 ? Math.round(x) : x.toFixed(1)) + '秒' : '—'; };
  var num = function (id) { var v = $(id).value.trim(); return v === '' ? NaN : Number(v); };

  function stat(label, value, note, cls) {
    return '<div class="stat ' + (cls || '') + '"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' + (note ? '<div class="stat-note">' + note + '</div>' : '') + '</div>';
  }

  function render() {
    var calls = num('calls'), interval = num('interval'), aht = num('aht'), sl = num('sl') / 100,
        target = num('target'), shrink = num('shrink') / 100, custom = num('agents');
    var msg = $('msg');
    var bad = [calls, interval, aht, sl, target].some(function (x) { return !isFinite(x); }) ||
      calls < 0 || interval <= 0 || aht <= 0 || sl <= 0 || sl >= 1 || target < 0;
    if (bad) { msg.style.display = 'block'; msg.textContent = '入力値を確認してください(着信数は0以上、区間とAHTは正の数、目標サービスレベルは1〜99.9%)。'; $('out').style.display = 'none'; return; }
    if (!isFinite(shrink) || shrink < 0 || shrink >= 0.9) shrink = 0;
    msg.style.display = 'none'; $('out').style.display = '';

    var A = Erlang.trafficErlangs(calls, aht, interval);
    var req = Erlang.requiredAgents(A, aht, target, sl);
    var stats = '', rows = '';
    stats += stat('呼量', A.toFixed(2) + ' アーラン', '同時に塞がる人数の平均');
    if (req === null) {
      stats += stat('必要席数', '算出できません', '5,000人まで試しても目標に届きません');
      $('stats').innerHTML = stats; $('tbl').querySelector('tbody').innerHTML = ''; $('custom').innerHTML = ''; return;
    }
    var m = Erlang.metrics(req, A, aht, target);
    stats += stat('必要席数', req + ' 人', '目標のサービスレベルを満たす最小の人数', 'main');
    stats += stat('配置人数(シュリンケージ込み)', Erlang.withShrinkage(req, shrink) + ' 人', 'シュリンケージ ' + (shrink * 100).toFixed(0) + '% を見込んだ人数');
    stats += stat('サービスレベル', pct(m.serviceLevel), target + '秒以内に応答できる割合');
    stats += stat('待たされる確率', pct(m.waitProb), '即時に応答できない割合');
    stats += stat('平均応答待ち時間', sec(m.asaSec), '全着信の平均(待たなかった分を含む)');
    stats += stat('占有率', pct(m.occupancy), m.occupancy > 0.9 ? '90%を超えています。負荷が高めです' : '応対に使われている時間の割合', m.occupancy > 0.9 ? 'warn' : '');
    $('stats').innerHTML = stats;

    var from = Math.max(1, req - 3), to = req + 4;
    for (var n = from; n <= to; n++) {
      var x = Erlang.metrics(n, A, aht, target);
      rows += '<tr' + (n === req ? ' class="hit"' : '') + '><td>' + n + '人' + (n === req ? '(必要席数)' : '') + '</td><td>' + (x.stable ? pct(x.serviceLevel) : '—') + '</td><td>' + (x.stable ? pct(x.waitProb) : '—') + '</td><td>' + sec(x.asaSec) + '</td><td>' + pct(x.occupancy) + '</td></tr>';
    }
    $('tbl').querySelector('tbody').innerHTML = rows;

    var c = '';
    if (isFinite(custom) && custom >= 1) {
      var y = Erlang.metrics(Math.floor(custom), A, aht, target);
      c = '<h3>' + Math.floor(custom) + '人で対応した場合</h3>';
      if (!y.stable) c += '<div class="notice draft">呼量(' + A.toFixed(2) + ' アーラン)以下の人数では、待ち行列が解消せず、計算できません。</div>';
      else c += '<div class="stats">' + stat('サービスレベル', pct(y.serviceLevel), target + '秒以内', y.serviceLevel >= sl ? 'ok' : 'warn') + stat('待たされる確率', pct(y.waitProb)) + stat('平均応答待ち時間', sec(y.asaSec)) + stat('占有率', pct(y.occupancy)) + '</div>';
    }
    $('custom').innerHTML = c;
  }

  ids.forEach(function (id) { $(id).addEventListener('input', render); });
  render();
})();
