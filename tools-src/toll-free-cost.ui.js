(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ids = ['calls', 'mobile', 'sec', 'lines', 'fBase', 'fFixRate', 'fFixUnit', 'fMobRate', 'fMobUnit', 'nBase', 'nLine', 'nFixRate', 'nFixUnit', 'nMobRate', 'nMobUnit'];
  var num = function (id) { var v = $(id).value.trim(); return v === '' ? NaN : Number(v); };
  var yen = function (x) { return Math.round(x).toLocaleString('ja-JP') + '円'; };
  var yen1 = function (x) { return (Math.round(x * 10) / 10).toLocaleString('ja-JP') + '円'; };

  function stat(label, value, note, cls) {
    return '<div class="stat ' + (cls || '') + '"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' + (note ? '<div class="stat-note">' + note + '</div>' : '') + '</div>';
  }
  // 1通話の通話料 = 課金単位に切り上げた回数 × 料金
  var perCall = function (sec, rate, unit) { return Math.ceil(sec / unit) * rate; };

  function render() {
    var v = {}; ids.forEach(function (id) { v[id] = num(id); });
    var msg = $('msg');
    var bad = ids.some(function (id) { return !isFinite(v[id]) || v[id] < 0; }) || v.calls < 0 || v.sec <= 0 ||
      v.mobile > 100 || v.fFixUnit <= 0 || v.fMobUnit <= 0 || v.nFixUnit <= 0 || v.nMobUnit <= 0;
    if (bad) { msg.style.display = 'block'; msg.textContent = '入力値を確認してください(0以上の数で、通話時間と課金単位は正の数、携帯の割合は0〜100%)。'; $('out').style.display = 'none'; return; }
    msg.style.display = 'none'; $('out').style.display = '';

    var m = v.mobile / 100, mobCalls = v.calls * m, fixCalls = v.calls - mobCalls;
    var fMobFee = mobCalls * perCall(v.sec, v.fMobRate, v.fMobUnit), fFixFee = fixCalls * perCall(v.sec, v.fFixRate, v.fFixUnit);
    var nMobFee = mobCalls * perCall(v.sec, v.nMobRate, v.nMobUnit), nFixFee = fixCalls * perCall(v.sec, v.nFixRate, v.nFixUnit);
    var fCompany = v.fBase + fMobFee + fFixFee;
    var nCompany = v.nBase + v.nLine * v.lines;
    var nCaller = nMobFee + nFixFee;
    var callerMob = perCall(v.sec, v.nMobRate, v.nMobUnit), callerFix = perCall(v.sec, v.nFixRate, v.nFixUnit);

    var stats = '';
    stats += stat('フリーダイヤル: 企業の負担', yen(fCompany), '基本料 + 通話料(企業が負担)', 'main');
    stats += stat('ナビダイヤル: 企業の負担', yen(nCompany), '基本料 + 回線数の加算(通話料は発信者の負担)', 'main');
    stats += stat('ナビダイヤル: 顧客の負担(合計)', yen(nCaller), '発信者が支払う通話料の合計');
    stats += stat('ナビダイヤル: 顧客1人あたり', '携帯 ' + yen1(callerMob) + ' / 固定 ' + yen1(callerFix), v.sec + '秒の通話の場合');
    $('stats').innerHTML = stats;

    var diff = fCompany - nCompany;
    var rows = '';
    rows += '<tr><td>基本料(月額)</td><td>' + yen(v.fBase) + '</td><td>' + yen(v.nBase + v.nLine * v.lines) + '</td></tr>';
    rows += '<tr><td>通話料: 携帯からの着信(' + Math.round(mobCalls).toLocaleString('ja-JP') + '件)</td><td>企業 ' + yen(fMobFee) + '</td><td>顧客 ' + yen(nMobFee) + '</td></tr>';
    rows += '<tr><td>通話料: 固定からの着信(' + Math.round(fixCalls).toLocaleString('ja-JP') + '件)</td><td>企業 ' + yen(fFixFee) + '</td><td>顧客 ' + yen(nFixFee) + '</td></tr>';
    rows += '<tr class="hit"><td>企業の月額の負担</td><td>' + yen(fCompany) + '</td><td>' + yen(nCompany) + '</td></tr>';
    rows += '<tr><td>顧客の負担(合計)</td><td>0円</td><td>' + yen(nCaller) + '</td></tr>';
    rows += '<tr><td>企業の負担の差(フリー − ナビ)</td><td colspan="2">' + (diff >= 0 ? 'フリーダイヤルの方が、月に ' + yen(diff) + ' 多い' : 'ナビダイヤルの方が、月に ' + yen(-diff) + ' 多い') + '</td></tr>';
    $('tbl').querySelector('tbody').innerHTML = rows;
  }

  ids.forEach(function (id) { $(id).addEventListener('input', render); });
  render();
})();
