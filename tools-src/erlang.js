// アーランC式の計算(ブラウザと Node の両方で動く)。
// 前提: 到着はポアソン過程、処理時間は指数分布、待つ人は放棄しない、先着順、対象区間内で到着率は一定。
(function (root) {
  // 呼量(アーラン) = 区間内の着信数 × 平均処理時間 ÷ 区間の長さ
  function trafficErlangs(calls, ahtSec, intervalMin) {
    return (calls * ahtSec) / (intervalMin * 60);
  }

  // 待たされる確率(アーランC)。agents が呼量以下だと、待ち行列が発散するので 1 を返す。
  // アーランBの漸化式を使うので、人数が多くても桁あふれしない。
  function waitProbability(agents, traffic) {
    if (traffic <= 0) return 0;
    if (agents <= traffic) return 1;
    let b = 1;
    for (let n = 1; n <= agents; n++) b = (traffic * b) / (n + traffic * b);
    return (agents * b) / (agents - traffic * (1 - b));
  }

  // 人数を決めたときの各指標
  function metrics(agents, traffic, ahtSec, targetSec) {
    const pw = waitProbability(agents, traffic);
    const stable = agents > traffic;
    return {
      agents,
      stable,
      waitProb: pw,
      serviceLevel: stable ? 1 - pw * Math.exp((-(agents - traffic) * targetSec) / ahtSec) : 0,
      asaSec: stable ? (pw * ahtSec) / (agents - traffic) : Infinity,
      occupancy: Math.min(traffic / agents, 1),
    };
  }

  // 目標のサービスレベルを満たす最小の人数
  function requiredAgents(traffic, ahtSec, targetSec, targetSL, maxAgents) {
    const limit = maxAgents || 5000;
    let n = Math.max(1, Math.floor(traffic) + 1);
    while (n <= limit) {
      if (metrics(n, traffic, ahtSec, targetSec).serviceLevel >= targetSL) return n;
      n++;
    }
    return null;
  }

  // 休憩・研修・欠勤などの損失(シュリンケージ)を見込んだ配置人数
  function withShrinkage(agents, shrinkage) {
    return Math.ceil(agents / (1 - shrinkage));
  }

  const api = { trafficErlangs, waitProbability, metrics, requiredAgents, withShrinkage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Erlang = api;
})(typeof self !== 'undefined' ? self : this);
