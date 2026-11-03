(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SAMPLE = [40, 70, 95, 110, 100, 80, 60, 75, 90, 100, 95, 80, 60, 45, 35, 30, 25, 20];
  var calls = []; // 時間帯ごとの着信数(画面の表と同じ順)
  var rows = [];  // 直近の計算結果(CSV用)

  function hhmm(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  function num(id) { var v = $(id).value.trim(); return v === '' ? NaN : Number(v); }

  // 時刻の選択肢(0:00〜24:00、30分刻み)
  (function fill() {
    var a = '', b = '';
    for (var t = 0; t <= 24 * 60; t += 30) {
      if (t < 24 * 60) a += '<option value="' + t + '"' + (t === 540 ? ' selected' : '') + '>' + hhmm(t) + '</option>';
      if (t > 0) b += '<option value="' + t + '"' + (t === 1080 ? ' selected' : '') + '>' + hhmm(t) + '</option>';
    }
    $('start').innerHTML = a; $('end').innerHTML = b;
  })();

  function slots() {
    var s = Number($('start').value), e = Number($('end').value), step = Number($('step').value), list = [];
    for (var t = s; t + step <= e; t += step) list.push(t);
    return { list: list, step: step };
  }

  // 時間帯の数が変わったら、着信数の配列を作り直す(足りない分はサンプルの繰り返し、または0)
  function syncCalls() {
    var n = slots().list.length;
    while (calls.length < n) calls.push(SAMPLE[calls.length % SAMPLE.length] * (Number($('step').value) / 30));
    calls.length = n;
  }

  function render(rebuildInputs) {
    syncCalls();
    var sl = slots(), list = sl.list, step = sl.step;
    var aht = num('aht'), slv = num('sl') / 100, target = num('target'), shrink = num('shrink') / 100;
    var msg = $('msg');
    if (!isFinite(aht) || aht <= 0 || !isFinite(slv) || slv <= 0 || slv >= 1 || !isFinite(target) || target < 0 || !list.length) {
      msg.style.display = 'block'; msg.textContent = '条件を確認してください(終了時刻は開始時刻より後、AHTは正の数、目標サービスレベルは1〜99.9%)。';
      $('out').style.display = 'none'; return;
    }
    if (!isFinite(shrink) || shrink < 0 || shrink >= 0.9) shrink = 0;
    msg.style.display = 'none'; $('out').style.display = '';

    rows = []; var totalCalls = 0, peak = 0, peakAt = '', reqHours = 0, schedHours = 0, maxSched = 1, i;
    for (i = 0; i < list.length; i++) {
      var c = Math.max(0, Number(calls[i]) || 0), req = 0, sched = 0, m = null;
      if (c > 0) {
        var A = Erlang.trafficErlangs(c, aht, step);
        req = Erlang.requiredAgents(A, aht, target, slv);
        if (req === null) { req = 0; }
        else { m = Erlang.metrics(req, A, aht, target); sched = Erlang.withShrinkage(req, shrink); }
      }
      totalCalls += c; reqHours += req * step / 60; schedHours += sched * step / 60;
      if (sched > peak) { peak = sched; peakAt = hhmm(list[i]); }
      maxSched = Math.max(maxSched, sched);
      rows.push({ label: hhmm(list[i]) + '–' + hhmm(list[i] + step), calls: c, req: req, sched: sched, sl: m ? m.serviceLevel : null, occ: m ? m.occupancy : null });
    }

    $('sum').innerHTML =
      '<div class="stat main"><div class="stat-label">ピークの配置人数</div><div class="stat-value">' + peak + ' 人</div><div class="stat-note">' + (peakAt ? peakAt + ' からの時間帯' : '—') + '</div></div>' +
      '<div class="stat"><div class="stat-label">総着信数</div><div class="stat-value">' + Math.round(totalCalls) + ' 件</div></div>' +
      '<div class="stat"><div class="stat-label">必要人時(席数ベース)</div><div class="stat-value">' + reqHours.toFixed(1) + ' 時間</div><div class="stat-note">必要席数 × 区間の合計</div></div>' +
      '<div class="stat"><div class="stat-label">配置人時(シュリンケージ込み)</div><div class="stat-value">' + schedHours.toFixed(1) + ' 時間</div><div class="stat-note">シュリンケージ ' + (shrink * 100).toFixed(0) + '%</div></div>';

    var bars = '', body = '';
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      bars += '<div class="bar" title="' + r.label + ' 配置' + r.sched + '人"><div class="bar-fill" style="height:' + Math.round(r.sched / maxSched * 100) + '%"></div><div class="bar-n">' + r.sched + '</div><div class="bar-t">' + r.label.slice(0, 5) + '</div></div>';
      body += '<tr><td>' + r.label + '</td><td><input class="cell" type="number" inputmode="decimal" min="0" step="any" data-i="' + i + '" value="' + r.calls + '" aria-label="' + r.label + ' の着信数"></td><td>' + r.req + '</td><td>' + r.sched + '</td><td>' + (r.sl === null ? '—' : pct(r.sl)) + '</td><td>' + (r.occ === null ? '—' : pct(r.occ)) + '</td></tr>';
    }
    $('bars').innerHTML = bars;
    if (rebuildInputs !== false) $('tbl').querySelector('tbody').innerHTML = body;
    else { // 入力中は表の入力欄を作り直さない(フォーカスを保つ)
      var trs = $('tbl').querySelectorAll('tbody tr');
      for (i = 0; i < trs.length && i < rows.length; i++) {
        var tds = trs[i].children;
        tds[2].textContent = rows[i].req; tds[3].textContent = rows[i].sched;
        tds[4].textContent = rows[i].sl === null ? '—' : pct(rows[i].sl); tds[5].textContent = rows[i].occ === null ? '—' : pct(rows[i].occ);
      }
    }
  }

  // 表の着信数を直接編集
  $('tbl').addEventListener('input', function (e) {
    var t = e.target; if (!t.classList.contains('cell')) return;
    calls[Number(t.getAttribute('data-i'))] = t.value === '' ? 0 : Number(t.value);
    render(false);
  });
  ['start', 'end', 'step', 'aht', 'sl', 'target', 'shrink'].forEach(function (id) {
    $(id).addEventListener(id === 'start' || id === 'end' || id === 'step' ? 'change' : 'input', function () { render(true); });
  });

  $('apply').addEventListener('click', function () {
    var vals = $('paste').value.split(/[\s,;\t]+/).filter(function (x) { return x !== ''; }).map(Number).filter(function (x) { return isFinite(x) && x >= 0; });
    if (!vals.length) return;
    syncCalls();
    for (var i = 0; i < calls.length; i++) calls[i] = i < vals.length ? vals[i] : 0;
    render(true);
  });
  $('sample').addEventListener('click', function () { calls = []; render(true); });
  $('clear').addEventListener('click', function () { syncCalls(); for (var i = 0; i < calls.length; i++) calls[i] = 0; render(true); });

  $('csv').addEventListener('click', function () {
    var lines = ['時間帯,着信数,必要席数,配置人数,サービスレベル,占有率'];
    rows.forEach(function (r) { lines.push([r.label, r.calls, r.req, r.sched, r.sl === null ? '' : (r.sl * 100).toFixed(1) + '%', r.occ === null ? '' : (r.occ * 100).toFixed(1) + '%'].join(',')); });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'staffing.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  render(true);
})();
