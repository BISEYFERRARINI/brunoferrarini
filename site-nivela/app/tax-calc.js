/* Bisey — imposto estimado do ano (conta pura, sem tela; testes em tests/tax.js).
   É uma ESTIMATIVA para o dono saber quanto separar de cada pagamento — não substitui o contador (CPA).
   Entradas:
     taxCalc({
       year: 2026, today: "2026-10-27",
       entries: [{ date: "2026-10-01", amount: 1200, kind: "revenue"|"expense"|"labor" }, …],   // pagamentos recebidos, despesas (notas), mão de obra (ponto × valor/hora)
       otherDeductions: 0,                 // outras deduções do ano até hoje que não estão no app (seguro, celular, software, veículo…)
       settings: { mode: "detailed"|"simple", simplePct: 30, entity: "sole"|"partnership"|"scorp"|"ccorp",
                   federalRate: 12, seTax: true, stateRate: 5, ssWageBase: 184500 },
       payments: [{ q: 1..4, amount: 1500, paid: true }]
     })
   Regras (EUA):
     - Lucro = receita − despesas − mão de obra − outras deduções (nunca abaixo de 0 para imposto).
     - Self-employment tax (sole proprietor / LLC / sócios): 15,3% sobre 92,35% do lucro — 12,4% (Social Security) até o teto
       do ano (ssWageBase; US$ 184.500 em 2026) + 2,9% (Medicare) sem teto. Abaixo de US$ 400 de lucro não há SE tax.
       S-corp / C-corp: desligado (o imposto do salário sai na folha).
     - Federal: alíquota efetiva × (lucro − metade do SE tax). Estadual: alíquota × lucro.
     - Modo simples: imposto = simplePct% de cada pagamento recebido.
   Trimestres (IRS 1040-ES, método de renda anualizada): períodos jan–mar, abr–mai, jun–ago, set–dez com vencimento em
   15/abr, 15/jun, 15/set e 15/jan do ano seguinte (fim de semana → próximo dia útil). Valor do trimestre = imposto sobre o
   lucro acumulado até o fim do período − o do período anterior (passado = real; futuro = projeção no ritmo atual). */
(function (root) {
  "use strict";
  var DAY = 864e5;
  function iso(d) { return d.toISOString().slice(0, 10); }
  function parse(s) { return new Date(String(s).slice(0, 10) + "T12:00:00Z"); }
  function days(a, b) { return Math.round((parse(b) - parse(a)) / DAY); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function num(n, d) { n = Number(n); return isFinite(n) ? n : d; }

  var DEFAULTS = { mode: "detailed", simplePct: 30, entity: "sole", federalRate: 12, seTax: true, state: "MA", stateRate: 5, ssWageBase: 184500, includePaidInvoices: false };
  // alíquota estadual sugerida por estado e tipo de empresa (o dono pode digitar outra)
  // MA: 5% sobre a renda (pessoa física; S-corp/LLC passam o lucro para o dono); C-corp: 8% (corporate excise).
  // NH: sem imposto de renda sobre salário; empresas acima do limite de receita pagam o Business Profits Tax (7,5%) — sugerimos 0 e avisamos.
  function suggestedStateRate(state, entity) {
    if (state === "MA") return entity === "ccorp" ? 8 : 5;
    if (state === "NH") return entity === "ccorp" ? 7.5 : 0;
    return null;
  }
  function settingsFor(s) {
    var o = Object.assign({}, DEFAULTS, s || {});
    o.federalRate = Math.max(0, Math.min(60, num(o.federalRate, DEFAULTS.federalRate)));
    o.stateRate = Math.max(0, Math.min(20, num(o.stateRate, DEFAULTS.stateRate)));
    o.simplePct = Math.max(0, Math.min(80, num(o.simplePct, DEFAULTS.simplePct)));
    o.ssWageBase = Math.max(0, num(o.ssWageBase, DEFAULTS.ssWageBase));
    if (o.entity === "scorp" || o.entity === "ccorp") o.seTax = false;
    return o;
  }

  // imposto sobre um lucro (e uma receita, no modo simples) do ano
  function taxOn(profit, revenue, s) {
    if (s.mode === "simple") { var t = Math.max(0, revenue) * s.simplePct / 100; return { se: 0, federal: 0, state: 0, simple: t, total: t }; }
    var p = Math.max(0, profit), se = 0;
    if (s.seTax) {
      var base = p * 0.9235;
      if (base >= 400) se = Math.min(base, s.ssWageBase) * 0.124 + base * 0.029;
    }
    var federal = Math.max(0, p - se / 2) * s.federalRate / 100, state = p * s.stateRate / 100;
    return { se: se, federal: federal, state: state, simple: 0, total: se + federal + state };
  }
  function roundTax(x) { return { se: round2(x.se), federal: round2(x.federal), state: round2(x.state), simple: round2(x.simple), total: round2(x.total) }; }

  // vencimentos do 1040-ES do ano (sábado/domingo → segunda)
  function dueDates(year) {
    return [[year, 4, 15], [year, 6, 15], [year, 9, 15], [year + 1, 1, 15]].map(function (x) {
      var d = new Date(Date.UTC(x[0], x[1] - 1, x[2], 12)); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + DAY);
      return iso(d);
    });
  }
  function periods(year) {
    var y = String(year), due = dueDates(year);
    return [[y + "-01-01", y + "-03-31"], [y + "-04-01", y + "-05-31"], [y + "-06-01", y + "-08-31"], [y + "-09-01", y + "-12-31"]].map(function (p, i) { return { q: i + 1, from: p[0], to: p[1], due: due[i] }; });
  }

  function taxCalc(input) {
    input = input || {};
    var s = settingsFor(input.settings), year = Number(input.year) || new Date().getFullYear();
    var today = String(input.today || iso(new Date())).slice(0, 10), y0 = year + "-01-01", y1 = year + "-12-31";
    var cut = today < y0 ? y0 : today > y1 ? y1 : today; // ano passado: tudo é real; ano que vem: nada aconteceu
    var list = (input.entries || []).filter(function (e) { var d = String(e.date || "").slice(0, 10); return d >= y0 && d <= cut && Number(e.amount) > 0; });
    var other = Math.max(0, num(input.otherDeductions, 0));
    function sumUntil(kind, until) { return list.reduce(function (a, e) { return a + (e.kind === kind && String(e.date).slice(0, 10) <= until ? Number(e.amount) : 0); }, 0); }
    var ytd = { revenue: sumUntil("revenue", cut), expenses: sumUntil("expense", cut), labor: sumUntil("labor", cut), other: other };
    ytd.deductions = ytd.expenses + ytd.labor + ytd.other;
    ytd.profit = ytd.revenue - ytd.deductions;
    var tax = taxOn(ytd.profit, ytd.revenue, s);

    // ritmo: desde o 1º lançamento do ano (empresa que começou no meio do ano não fica com projeção baixa)
    var first = list.reduce(function (a, e) { var d = String(e.date).slice(0, 10); return !a || d < a ? d : a; }, null) || cut;
    var elapsed = Math.max(1, days(first, cut) + 1), total = Math.max(elapsed, days(first, y1) + 1), factor = total / elapsed;
    var proj = { revenue: ytd.revenue * factor, deductions: (ytd.expenses + ytd.labor) * factor + other, factor: factor, daysOfData: elapsed, lowData: elapsed < 30 || list.length < 3 };
    proj.profit = proj.revenue - proj.deductions;
    var projTax = taxOn(proj.profit, proj.revenue, s);

    // acumulado no fim de cada período: real até hoje + ritmo diário depois de hoje
    var rateRev = ytd.revenue / elapsed, rateCost = (ytd.expenses + ytd.labor) / elapsed;
    function cumAt(until) {
      if (until <= cut) { var r = sumUntil("revenue", until), c = sumUntil("expense", until) + sumUntil("labor", until); return { revenue: r, profit: r - c - other * Math.min(1, Math.max(0, (days(first, until) + 1) / elapsed)) }; } // outras deduções: espalhadas no período
      var extra = days(cut, until); return { revenue: ytd.revenue + rateRev * extra, profit: ytd.revenue + rateRev * extra - (ytd.expenses + ytd.labor + rateCost * extra) - other };
    }
    var paid = {}; (input.payments || []).forEach(function (p) { if (p && p.paid && p.q >= 1 && p.q <= 4) paid[p.q] = Math.max(0, num(p.amount, 0)); });
    var prevTax = 0, quarters = periods(year).map(function (p) {
      var c = cumAt(p.to), tt = taxOn(c.profit, c.revenue, s).total, amt = Math.max(0, tt - prevTax);
      prevTax = Math.max(prevTax, tt);
      return { q: p.q, from: p.from, to: p.to, due: p.due, amount: round2(amt), status: p.to < today ? "past" : p.from > today ? "future" : "current", estimated: p.to > cut, overdue: p.due < today && paid[p.q] == null && amt > 0.5, paid: paid[p.q] != null, paidAmount: paid[p.q] != null ? round2(paid[p.q]) : null };
    });
    var paidTotal = Object.keys(paid).reduce(function (a, k) { return a + paid[k]; }, 0);
    var setAsidePct = ytd.revenue > 0 ? tax.total / ytd.revenue * 100 : (s.mode === "simple" ? s.simplePct : 0);
    var next = quarters.filter(function (q) { return !q.paid && q.due >= today && q.amount > 0; })[0] || null;
    return {
      year: year, today: today, settings: s, ytd: roundObj(ytd), tax: roundTax(tax), setAsidePct: Math.round(setAsidePct * 10) / 10,
      perThousand: round2(setAsidePct * 10), effectiveOnProfit: ytd.profit > 0 ? Math.round(tax.total / ytd.profit * 1000) / 10 : 0,
      projection: Object.assign(roundObj(proj), { tax: roundTax(projTax) }), quarters: quarters, paidTotal: round2(paidTotal),
      stillToSetAside: round2(Math.max(0, tax.total - paidTotal)), remainingForYear: round2(Math.max(0, projTax.total - paidTotal)), next: next
    };
  }
  function roundObj(o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = typeof o[k] === "number" && k !== "factor" ? round2(o[k]) : o[k]; }); return r; }

  var api = { taxCalc: taxCalc, taxOn: function (p, r, s) { return roundTax(taxOn(p, r, settingsFor(s))); }, dueDates: dueDates, periods: periods, suggestedStateRate: suggestedStateRate, TAX_DEFAULTS: DEFAULTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.NV = root.NV || {}; Object.keys(api).forEach(function (k) { root.NV[k] = api[k]; }); }
})(typeof window !== "undefined" ? window : null);
