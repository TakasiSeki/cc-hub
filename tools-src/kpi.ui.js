(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ids = ['offered', 'answered', 'abandoned', 'short', 'insl', 'talk', 'hold', 'acw', 'login', 'fcrN', 'fcrOk', 'csatN', 'csatOk', 'npsP', 'npsN', 'npsD'];
  function v(id) { var s = $(id).value.trim(); return s === '' ? NaN : Number(s); }
  function ok() { for (var i = 0; i < arguments.length; i++) if (!isFinite(arguments[i]) || arguments[i] < 0) return false; return true; }
  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  function mmss(sec) { var m = Math.floor(sec / 60), s = Math.round(sec - m * 60); if (s === 60) { m++; s = 0; } return m + '分' + (s < 10 ? '0' : '') + s + '秒'; }

  function card(label, value, formula, note, href) {
    return '<div class="kpi"><div class="kpi-h"><span class="kpi-label">' + label + '</span><span class="kpi-value">' + value + '</span></div>' +
      '<div class="kpi-f">' + formula + '</div>' + (note ? '<div class="kpi-n">' + note + '</div>' : '') +
      (href ? '<a class="kpi-a" href="../entries/' + href + '.html">この指標の解説</a>' : '') + '</div>';
  }

  function render() {
    var off = v('offered'), ans = v('answered'), aba = v('abandoned'), sh = v('short'), insl = v('insl');
    var talk = v('talk'), hold = v('hold'), acw = v('acw'), login = v('login');
    var out = '';

    if (ok(off, ans) && off > 0) out += card('応答率', pct(ans / off), '応答数 ÷ 着信数', ans > off ? '応答数が着信数を上回っています。入力を確認してください' : '', 'response-rate');
    if (ok(off, aba) && off > 0) {
      out += card('放棄呼率', pct(aba / off), '放棄数 ÷ 着信数', '', 'abandon-rate');
      if (ok(sh) && sh > 0 && off - sh > 0) out += card('放棄呼率(短時間放棄を除外)', pct(Math.max(aba - sh, 0) / (off - sh)), '(放棄数 − 短時間放棄) ÷ (着信数 − 短時間放棄)', '除外する秒数や、分母の取り方は、各センターの定義による', 'abandon-rate');
    }
    if (ok(off, insl) && off > 0) {
      out += card('サービスレベル(放棄呼を含めて数える)', pct(insl / off), '目標時間内の応答数 ÷ 着信数', '放棄した人も分母に入れる、厳しめの定義', 'response-rate');
      if (ok(aba) && off - aba > 0) out += card('サービスレベル(放棄呼を除く)', pct(insl / (off - aba)), '目標時間内の応答数 ÷ (着信数 − 放棄数)', '放棄した人を分母から除く定義', 'response-rate');
    }
    if (ok(ans, talk, hold, acw) && ans > 0) {
      var aht = (talk + hold + acw) * 60 / ans;
      out += card('AHT(平均処理時間)', mmss(aht) + '(' + Math.round(aht) + '秒)', '(通話 + 保留 + 後処理)の合計 ÷ 応答数', '内訳: 通話 ' + mmss(talk * 60 / ans) + ' / 保留 ' + mmss(hold * 60 / ans) + ' / 後処理 ' + mmss(acw * 60 / ans), 'aht');
      out += card('ACW(平均後処理時間)', mmss(acw * 60 / ans), '後処理時間の合計 ÷ 応答数', 'AHT に占める割合: ' + pct(acw / (talk + hold + acw || 1)), 'acw');
    }
    if (ok(talk, hold, acw, login) && login > 0) out += card('占有率', pct((talk + hold + acw) / login), '(通話 + 保留 + 後処理)の合計 ÷ ログイン時間', (talk + hold + acw) > login ? 'ログイン時間を上回っています。入力を確認してください' : '定義によっては「稼働率」とも呼ばれます', 'occupancy-utilization');

    var fn = v('fcrN'), fo = v('fcrOk');
    if (ok(fn, fo) && fn > 0) out += card('一次解決率(FCR)', pct(fo / fn), '初回で解決した件数 ÷ 判定対象の件数', '再問い合わせの有効期間や、判定の方法は、各センターの定義による', 'fcr');
    var cn = v('csatN'), co = v('csatOk');
    if (ok(cn, co) && cn > 0) out += card('CSAT', pct(co / cn), '満足(4または5)の人数 ÷ 回答数', '上位何段階を満足とするかで数値が変わります', 'csat');
    var p = v('npsP'), n = v('npsN'), d = v('npsD');
    if (ok(p, n, d) && p + n + d > 0) out += card('NPS', ((p - d) / (p + n + d) * 100).toFixed(0), '推奨者の割合(%) − 批判者の割合(%)', '推奨者 ' + pct(p / (p + n + d)) + ' / 批判者 ' + pct(d / (p + n + d)) + '(範囲は −100〜+100)', 'nps');

    $('kpi').innerHTML = out || '<div class="notice draft">数値を入力すると、計算できる指標が表示されます。</div>';
  }

  ids.forEach(function (id) { $(id).addEventListener('input', render); });
  render();
})();
