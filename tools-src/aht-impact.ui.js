(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ids = ['monthly', 'days', 'hours', 'ahtNow', 'ahtNew', 'sl', 'target', 'shrink', 'cost'];
  var num = function (id) { var v = $(id).value.trim(); return v === '' ? NaN : Number(v); };
  var yen = function (x) { return Math.round(x).toLocaleString('ja-JP') + '円'; };
  var mark = function (x) { return x > 0 ? '+' : x < 0 ? '−' : '±'; };
  var sgn = function (x, unit) { return mark(x) + Math.abs(Math.round(x * 100) / 100).toLocaleString('ja-JP') + unit; };

  function stat(label, value, note, cls) {
    return '<div class="stat ' + (cls || '') + '"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' + (note ? '<div class="stat-note">' + note + '</div>' : '') + '</div>';
  }

  function plan(callsPerHour, aht, target, sl, shrink) {
    var A = Erlang.trafficErlangs(callsPerHour, aht, 60);
    var req = Erlang.requiredAgents(A, aht, target, sl);
    if (req === null) return null;
    return { A: A, req: req, staff: Erlang.withShrinkage(req, shrink), occ: Erlang.metrics(req, A, aht, target).occupancy };
  }

  function render() {
    var monthly = num('monthly'), days = num('days'), hours = num('hours'), a0 = num('ahtNow'), a1 = num('ahtNew'),
        sl = num('sl') / 100, target = num('target'), shrink = num('shrink') / 100, cost = num('cost');
    var msg = $('msg');
    var bad = [monthly, days, hours, a0, a1, sl, target].some(function (x) { return !isFinite(x); }) ||
      monthly <= 0 || days <= 0 || hours <= 0 || a0 <= 0 || a1 <= 0 || sl <= 0 || sl >= 1 || target < 0;
    if (bad) { msg.style.display = 'block'; msg.textContent = '入力値を確認してください(着信数・日数・時間・AHTは正の数、目標サービスレベルは1〜99.9%)。'; $('out').style.display = 'none'; return; }
    if (!isFinite(shrink) || shrink < 0 || shrink >= 0.9) shrink = 0;
    msg.style.display = 'none'; $('out').style.display = '';

    var cph = monthly / days / hours;
    var p0 = plan(cph, a0, target, sl, shrink), p1 = plan(cph, a1, target, sl, shrink);
    if (!p0 || !p1) { $('stats').innerHTML = stat('算出できません', '—', '5,000人まで試しても目標に届きません'); $('tbl').querySelector('tbody').innerHTML = ''; return; }

    var workH = monthly * (a0 - a1) / 3600;
    var dReq = p1.req - p0.req, dStaff = p1.staff - p0.staff;
    var stats = '';
    stats += stat('AHTの変化', ((a1 - a0) / a0 * 100).toFixed(1) + '%', a0 + '秒 → ' + a1 + '秒');
    stats += stat('必要席数の差(営業時間の平均)', sgn(dReq, '人'), p0.req + '人 → ' + p1.req + '人', 'main');
    stats += stat('配置人数の差(シュリンケージ込み)', sgn(dStaff, '人'), p0.staff + '人 → ' + p1.staff + '人');
    stats += stat('月間の応対時間の差', sgn(-workH, '時間'), '着信数 × AHTの差');
    if (isFinite(cost) && cost >= 0) {
      stats += stat('月額コストの差(目安)', mark(dStaff) + yen(Math.abs(dStaff * cost)), '配置人数の差 × 1席あたりの月額コスト');
      stats += stat('年額コストの差(目安)', mark(dStaff) + yen(Math.abs(dStaff * cost * 12)), '月額の差 × 12');
    }
    if (dStaff === 0 && a1 < a0) stats += stat('注意', '人数は変わりません', 'AHTの短縮が小さいか、人数の切り上げで差が出ていません。占有率の低下として表れます', 'warn');
    $('stats').innerHTML = stats;

    var pct = function (x) { return (x * 100).toFixed(1) + '%'; };
    var rows = '';
    rows += '<tr><td>1時間あたりの着信数</td><td>' + cph.toFixed(1) + '件</td><td>' + cph.toFixed(1) + '件</td><td>—</td></tr>';
    rows += '<tr><td>呼量(アーラン)</td><td>' + p0.A.toFixed(2) + '</td><td>' + p1.A.toFixed(2) + '</td><td>' + sgn(p1.A - p0.A, '') + '</td></tr>';
    rows += '<tr class="hit"><td>必要席数</td><td>' + p0.req + '人</td><td>' + p1.req + '人</td><td>' + sgn(dReq, '人') + '</td></tr>';
    rows += '<tr><td>配置人数(シュリンケージ込み)</td><td>' + p0.staff + '人</td><td>' + p1.staff + '人</td><td>' + sgn(dStaff, '人') + '</td></tr>';
    rows += '<tr><td>占有率</td><td>' + pct(p0.occ) + '</td><td>' + pct(p1.occ) + '</td><td>' + sgn((p1.occ - p0.occ) * 100, 'ポイント') + '</td></tr>';
    $('tbl').querySelector('tbody').innerHTML = rows;
  }

  ids.forEach(function (id) { $(id).addEventListener('input', render); });
  render();
})();
