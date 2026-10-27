/* Imposto estimado do ano (só o dono — Finanças → Impostos).
   Soma o que já está no app (pagamentos recebidos, despesas/notas e mão de obra do ponto), aplica as taxas que o dono escolhe
   (federal efetiva, self-employment tax, estadual ou "só guardar X%") e mostra: imposto até agora, quanto guardar de cada
   pagamento, projeção até 31/dez e os 4 vencimentos do IRS 1040-ES com "marcar como pago" (quem marcou e quando).
   A conta fica em tax-calc.js (NV.taxCalc, testada em tests/tax.js). É estimativa — confirme com o contador (CPA). */
(function () {
  "use strict";
  var E = window.EE; if (!E) return;
  var S = E.S, API = E.API, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions, money = E.money, NV = window.NV;
  EXT.modals = EXT.modals || {};

  function year() { return S.taxYear || new Date().getFullYear(); }
  var cache = { key: "", data: null, loading: "" };
  function key() { return S.company + "-" + year(); }
  function ensure() {
    var k = key();
    if (cache.key === k && cache.data) return cache.data;
    if (cache.loading === k || !API.getTaxData) return null;
    cache.loading = k;
    API.getTaxData(S.company, year()).then(function (d) { cache = { key: k, data: d || {}, loading: "" }; if (S.view === "impostos" || S.view === "dashboard") E.render(); })
      .catch(function () { cache = { key: k, data: { settings: null, otherDeductions: 0, payments: {} }, loading: "" }; E.render(); });
    return null;
  }
  function reload() { cache.key = ""; cache.data = null; return new Promise(function (ok) { var k = key(); API.getTaxData(S.company, year()).then(function (d) { cache = { key: k, data: d || {}, loading: "" }; ok(); }).catch(function () { ok(); }); }); }
  EXT.load.push(function () { cache.key = ""; cache.data = null; return Promise.resolve(); });

  function co() { return API.companies.find(function (c) { return c.id === S.company; }) || {}; }
  function settingsOf(d) {
    var st = (d && d.settings) || {}, base = Object.assign({}, NV.TAX_DEFAULTS);
    if (!st.state) { var cs = co().state; base.state = cs === "NH" ? "NH" : cs && cs !== "MA" ? "other" : "MA"; var sr = NV.suggestedStateRate(base.state, base.entity); base.stateRate = sr == null ? 5 : sr; }
    return Object.assign(base, st);
  }
  // lançamentos do ano: pagamentos recebidos, despesas (notas e manuais) e mão de obra (horas × valor/hora de cada ponto)
  function entries(st) {
    var y = String(year()), out = [];
    (S.expenses || []).forEach(function (x) { if (x.companyId !== S.company || String(x.date || "").slice(0, 4) !== y) return; out.push({ date: x.date, amount: x.amount, kind: x.kind === "revenue" ? "revenue" : "expense" }); });
    (S.time || []).forEach(function (x) { if (x.companyId !== S.company || !x.checkOut) return; var d = E.isoLocal(new Date(x.checkIn)); if (d.slice(0, 4) !== y) return; out.push({ date: d, amount: E.hoursOf(x) * (x.rate || 0), kind: "labor" }); });
    if (st.includePaidInvoices) paidInvoices().forEach(function (p) { out.push({ date: p.date, amount: p.total, kind: "revenue" }); });
    return out;
  }
  function paidInvoices() { var y = String(year()); return (S.proposals || []).filter(function (p) { return p.companyId === S.company && p.docType === "invoice" && p.status === "Paga" && String(p.date || "").slice(0, 4) === y && p.total > 0; }); }
  function compute(d) {
    var st = settingsOf(d), pays = Object.keys((d && d.payments) || {}).map(function (k) { return d.payments[k]; });
    return NV.taxCalc({ year: year(), today: E.todayISO(), entries: entries(st), otherDeductions: (d && d.otherDeductions) || 0, settings: st, payments: pays });
  }
  function pct(n) { return (Math.round(n * 10) / 10).toLocaleString(E.LOCALE, { maximumFractionDigits: 1 }) + "%"; }
  var MON = t("who.months", "jan,fev,mar,abr,mai,jun,jul,ago,set,out,nov,dez").split(",");
  function dueLabel(iso) { var d = new Date(iso + "T12:00:00"), y = d.getFullYear() !== year() ? " " + d.getFullYear() : ""; return (E.LANG === "en" ? MON[d.getMonth()] + " " + d.getDate() : d.getDate() + " " + MON[d.getMonth()]) + y; }
  function periodLabel(q) { return MON[Number(q.from.slice(5, 7)) - 1] + "–" + MON[Number(q.to.slice(5, 7)) - 1]; }

  // ═══════════ tela ═══════════
  EXT.views.impostos = function () {
    var d = ensure();
    var head = '<div class="page-head"><div><h1>' + esc(t("tax.title", "Imposto estimado do ano")) + "</h1><p>" + esc(year() + " · " + E.companyName(S.company) + " · " + t("tax.sub", "calculado com o que está lançado no app")) + "</p></div>" +
      '<div class="row"><button type="button" class="btn ghost sm" data-act="taxYear" data-id="-1" aria-label="' + esc(t("tax.prevYear", "Ano anterior")) + '">' + ic("chevl", 16) + (year() - 1) + "</button>" + (year() < new Date().getFullYear() ? '<button type="button" class="btn ghost sm" data-act="taxYear" data-id="1">' + (year() + 1) + ic("chevr", 16) + "</button>" : "") + "</div></div>";
    var disc = '<div class="tax-disc" role="note">' + ic("info", 18) + "<span><b>" + esc(t("tax.disclaimerB", "Estimativa — confirme com seu contador (CPA).")) + "</b> " + esc(t("tax.disclaimer", "Serve para você separar o dinheiro do imposto ao longo do ano. Não é declaração nem aconselhamento fiscal.")) + "</span></div>";
    if (!d) return head + disc + '<div class="panel" aria-busy="true"><span class="spin" aria-hidden="true"></span> ' + esc(t("tax.loading", "Calculando…")) + "</div>";
    var r = compute(d), st = r.settings, simple = st.mode === "simple";
    // destaque: quanto guardar de cada pagamento
    var lastPay = (S.expenses || []).filter(function (x) { return x.companyId === S.company && x.kind === "revenue"; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    var hero = '<section class="panel tax-hero"><div class="tax-hero-main"><span class="label">' + esc(t("tax.setAside", "Guarde de cada pagamento recebido")) + '</span><div class="tax-big num">' + pct(r.setAsidePct) + "</div>" +
      '<div class="muted small">' + esc(t("tax.perThousand", "≈ {m} a cada $1.000 que entrar", { m: money(r.perThousand, 0) })) + "</div>" +
      (lastPay ? '<div class="tax-example">' + ic("money", 16) + "<span>" + esc(t("tax.example", "Último pagamento: {p} → separe {s}", { p: money(lastPay.amount, 2), s: money(lastPay.amount * r.setAsidePct / 100, 2) })) + "</span></div>" : "") + "</div>" +
      '<div class="tax-hero-side"><div><span class="label">' + esc(t("tax.owedSoFar", "Imposto estimado até agora")) + '</span><b class="num">' + money(r.tax.total, 0) + "</b></div>" +
      "<div><span class=\"label\">" + esc(t("tax.paidSoFar", "Já pago nos trimestres")) + '</span><b class="num v-good">' + money(r.paidTotal, 0) + "</b></div>" +
      "<div><span class=\"label\">" + esc(t("tax.keepNow", "Deveria estar guardado hoje")) + '</span><b class="num">' + money(r.stillToSetAside, 0) + "</b></div></div>" +
      E.level(r.tax.total > 0 ? Math.min(100, r.paidTotal / r.tax.total * 100) : 0, { sm: true, bubble: false, color: "var(--good)", label: t("tax.paidOfOwed", "Pago {p} de {o}", { p: money(r.paidTotal, 0), o: money(r.tax.total, 0) }) }) + "</section>";
    // conta passo a passo
    var row = function (label, v, cls, sub) { return '<div class="tax-row' + (cls ? " " + cls : "") + '"><span>' + esc(label) + (sub ? '<small class="muted">' + esc(sub) + "</small>" : "") + '</span><b class="num">' + v + "</b></div>"; };
    var calc = '<section class="panel"><div class="panel-head"><h3>' + esc(t("tax.howTitle", "Como chegamos nesse valor")) + '</h3><span class="muted small">' + esc(t("tax.ytd", "1º de jan até hoje")) + "</span></div>" +
      row(t("tax.revenue", "Pagamentos recebidos"), money(r.ytd.revenue, 2), "", st.includePaidInvoices ? t("tax.revenueInv", "inclui invoices marcados como pagos") : t("tax.revenueSub", "lançados como receita")) +
      row(t("tax.expenses", "− Material e despesas"), money(-r.ytd.expenses, 2), "", t("tax.expensesSub", "notas e lançamentos manuais")) +
      row(t("tax.labor", "− Mão de obra"), money(-r.ytd.labor, 2), "", t("tax.laborSub", "horas do ponto × valor/hora")) +
      row(t("tax.other", "− Outras deduções"), money(-r.ytd.other, 2), "", t("tax.otherSub", "seguro, veículo, celular… (ajuste abaixo)")) +
      row(t("tax.profit", "= Lucro estimado"), money(r.ytd.profit, 2), "sum") +
      (simple ? row(t("tax.simpleLine", "Guardar {p} do recebido", { p: pct(st.simplePct) }), money(r.tax.simple, 2), "tax") :
        (st.seTax ? row(t("tax.se", "Self-employment tax (Social Security + Medicare)"), money(r.tax.se, 2), "tax", t("tax.seSub", "15,3% sobre 92,35% do lucro")) : "") +
        row(t("tax.federal", "Imposto federal"), money(r.tax.federal, 2), "tax", t("tax.federalSub", "{p} efetivo", { p: pct(st.federalRate) })) +
        row(t("tax.state", "Imposto estadual"), money(r.tax.state, 2), "tax", (st.state === "MA" ? "MA · " : st.state === "NH" ? "NH · " : "") + pct(st.stateRate))) +
      row(t("tax.total", "= Imposto estimado"), money(r.tax.total, 2), "sum total") + "</section>";
    // projeção
    var proj = '<section class="panel"><div class="panel-head"><h3>' + esc(t("tax.projTitle", "Se continuar neste ritmo até 31 de dezembro")) + "</h3></div>" +
      '<div class="tax-proj"><div><span class="label">' + esc(t("tax.projRevenue", "Recebido no ano")) + '</span><b class="num">' + money(r.projection.revenue, 0) + "</b></div>" +
      "<div><span class=\"label\">" + esc(t("tax.projProfit", "Lucro no ano")) + '</span><b class="num">' + money(r.projection.profit, 0) + "</b></div>" +
      "<div><span class=\"label\">" + esc(t("tax.projTax", "Imposto do ano")) + '</span><b class="num">' + money(r.projection.tax.total, 0) + "</b></div>" +
      "<div><span class=\"label\">" + esc(t("tax.projLeft", "Falta pagar no ano")) + '</span><b class="num">' + money(r.remainingForYear, 0) + "</b></div></div>" +
      (r.projection.lowData ? '<p class="muted small" style="margin:10px 0 0">' + esc(t("tax.lowData", "Ainda há poucos lançamentos no ano: a projeção vai ficando melhor com o tempo.")) + "</p>" : "") + "</section>";
    // trimestres
    var pays = (d && d.payments) || {};
    var qs = '<div class="section-title"><h2>' + esc(t("tax.qTitle", "Pagamentos trimestrais (IRS 1040-ES)")) + '</h2><span class="muted small">' + esc(t("tax.qSub", "Valor sugerido = imposto do lucro de cada período (real até hoje, projeção depois)")) + "</span></div>" +
      '<div class="tax-qs">' + r.quarters.map(function (q) {
        var p = pays[q.q], st0 = q.paid ? "good" : q.overdue ? "bad" : q.status === "current" ? "accent" : "neutral";
        var pill = q.paid ? t("tax.qPaid", "Pago") : q.overdue ? t("tax.qOverdue", "Vencido") : q.status === "current" ? t("tax.qCurrent", "Período atual") : q.status === "future" ? t("tax.qFuture", "A vencer") : q.amount > 0.5 ? t("tax.qOpen", "Em aberto") : t("tax.qNothing", "Nada a pagar");
        return '<section class="panel tax-q' + (q.paid ? " paid" : "") + '"><div class="spread"><b>' + esc(t("tax.qN", "{n}º trimestre", { n: q.q })) + '</b><span class="pill ' + st0 + '">' + esc(pill) + "</span></div>" +
          '<div class="muted small">' + esc(t("tax.qPeriod", "Lucro de {p}", { p: periodLabel(q) })) + " · " + esc(t("tax.qDue", "vence {d}", { d: dueLabel(q.due) })) + "</div>" +
          '<div class="tax-q-amt num">' + money(q.paid ? q.paidAmount : q.amount, 0) + (q.estimated && !q.paid ? ' <span class="muted small">' + esc(t("tax.qEst", "previsto")) + "</span>" : "") + "</div>" +
          (q.paid && p ? '<div class="by">' + E.byLine(t("tax.qMarkedBy", "Marcado como pago por {n}"), p.byName, p.at) + "</div>" : "") +
          '<label class="tax-check"><input type="checkbox" data-act="taxPaid" data-id="' + q.q + '"' + (q.paid ? " checked" : "") + "> " + esc(t("tax.qMark", "Já paguei este trimestre")) + "</label></section>";
      }).join("") + "</div>" +
      '<p class="muted small">' + esc(t("tax.qNote", "Os mesmos 4 vencimentos valem para o estimado de MA (Form 1-ES). Pagar 100% do imposto do ano passado (110% se a renda passou de US$ 150 mil) em 4 partes também evita multa do IRS.")) + "</p>";
    // ajustes
    var opt = function (v, cur, label) { return '<option value="' + v + '"' + (cur === v ? " selected" : "") + ">" + esc(label) + "</option>"; };
    var form = '<details class="panel tax-set"' + (S.taxOpen ? " open" : "") + '><summary data-act="taxToggle"><span><b>' + esc(t("tax.setTitle", "Ajustar as taxas")) + '</b><span class="muted small">' + esc(simple ? t("tax.setSumSimple", "Modo simples: guardar {p} de cada pagamento", { p: pct(st.simplePct) }) : t("tax.setSum", "Federal {f} · estadual {s} · self-employment {se}", { f: pct(st.federalRate), s: pct(st.stateRate), se: st.seTax ? t("tax.on", "ligado") : t("tax.off", "desligado") })) + "</span></span>" + ic("chevd", 18) + "</summary>" +
      '<form id="taxForm" class="stack" style="margin-top:12px">' +
      '<div class="seg" role="radiogroup" aria-label="' + esc(t("tax.mode", "Como calcular")) + '"><button type="button" role="radio" aria-checked="' + !simple + '" class="' + (!simple ? "on" : "") + '" data-act="taxMode" data-id="detailed"><b>' + esc(t("tax.modeDetailed", "Detalhado")) + "</b><span>" + esc(t("tax.modeDetailedSub", "federal + self-employment + estado")) + '</span></button><button type="button" role="radio" aria-checked="' + simple + '" class="' + (simple ? "on" : "") + '" data-act="taxMode" data-id="simple"><b>' + esc(t("tax.modeSimple", "Simples")) + "</b><span>" + esc(t("tax.modeSimpleSub", "só guardar um % de cada pagamento")) + "</span></button></div>" +
      (simple ? '<label class="field" style="max-width:240px"><span>' + esc(t("tax.simplePct", "Guardar de cada pagamento (%)")) + '</span><input type="number" id="txSimple" min="0" max="80" step="0.5" inputmode="decimal" value="' + esc(st.simplePct) + '"></label>' :
        '<div class="grid2"><label class="field"><span>' + esc(t("tax.entity", "Tipo de empresa")) + '</span><select id="txEntity">' + opt("sole", st.entity, t("tax.eSole", "Sole proprietor / LLC de um dono")) + opt("partnership", st.entity, t("tax.ePart", "LLC com sócios (partnership)")) + opt("scorp", st.entity, t("tax.eScorp", "S-corp")) + opt("ccorp", st.entity, t("tax.eCcorp", "C-corp")) + "</select></label>" +
        '<label class="field"><span>' + esc(t("tax.stateSel", "Estado")) + '</span><select id="txState">' + opt("MA", st.state, "Massachusetts (MA)") + opt("NH", st.state, "New Hampshire (NH)").replace("<option", '<option lang="en"') + opt("other", st.state, t("tax.otherState", "Outro estado (digite a taxa)")) + "</select></label></div>" +
        '<div class="grid3"><label class="field"><span>' + esc(t("tax.fedRate", "Federal efetivo (%)")) + '</span><input type="number" id="txFed" min="0" max="60" step="0.5" inputmode="decimal" value="' + esc(st.federalRate) + '"></label>' +
        '<label class="field"><span>' + esc(t("tax.stateRate", "Estadual (%)")) + '</span><input type="number" id="txStateRate" min="0" max="20" step="0.05" inputmode="decimal" value="' + esc(st.stateRate) + '"></label>' +
        '<label class="set-toggle tax-se"><span><b>' + esc(t("tax.seToggle", "Self-employment tax")) + "</b><span>" + esc(st.entity === "scorp" || st.entity === "ccorp" ? t("tax.seCorp", "S-corp e C-corp pagam pela folha") : t("tax.seToggleSub", "15,3% — dono de LLC e sole proprietor")) + '</span></span><input type="checkbox" role="switch" id="txSE"' + (st.seTax ? " checked" : "") + (st.entity === "scorp" || st.entity === "ccorp" ? " disabled" : "") + '><span class="sw-ui" aria-hidden="true"></span></label></div>' +
        '<p class="muted small" style="margin:0">' + esc(t("tax.fedHint", "Federal efetivo: o quanto do lucro vai para o IRS depois das deduções (padrão 12%; quem lucra mais costuma ficar entre 15% e 22%). Pergunte ao seu contador o número da sua declaração do ano passado.")) + "</p>" +
        (st.state === "NH" ? '<p class="muted small" style="margin:0">' + esc(t("tax.nhHint", "NH não cobra imposto de renda sobre salário, mas empresas acima do limite de receita do estado pagam o Business Profits Tax (7,5%) e o Business Enterprise Tax. Confirme com seu contador e ajuste a taxa estadual.")) + "</p>" : "") +
        (st.state === "MA" ? '<p class="muted small" style="margin:0">' + esc(t("tax.maHint", "MA: 5% sobre a renda; quem passa de ~US$ 1 milhão no ano paga mais 4% (surtax). C-corp: 8% (corporate excise).")) + "</p>" : "")) +
      '<div class="grid2"><label class="field"><span>' + esc(t("tax.otherField", "Outras deduções do ano até hoje ($)")) + '</span><input type="number" id="txOther" min="0" step="1" inputmode="decimal" value="' + esc((d && d.otherDeductions) || 0) + '"><span class="hint">' + esc(t("tax.otherHint", "O que não passa pelo app: seguro, veículo, celular, software, contador.")) + "</span></label>" +
      (paidInvoices().length || st.includePaidInvoices ? '<label class="set-toggle"><span><b>' + esc(t("tax.inclInv", "Contar invoices marcados como pagos")) + "</b><span>" + esc(t("tax.inclInvSub", "Use se você não lança esses pagamentos como receita (senão conta duas vezes).")) + '</span></span><input type="checkbox" role="switch" id="txInv"' + (st.includePaidInvoices ? " checked" : "") + '><span class="sw-ui" aria-hidden="true"></span></label>' : "") + "</div>" +
      '<div class="row"><button type="submit" class="btn">' + ic("check", 18) + esc(t("tax.save", "Salvar taxas")) + "</button>" + (d && d.updatedByName ? E.byLine(t("who.editedBy", "Editado por {n}"), d.updatedByName, d.updatedAt) : "") + "</div></form></details>";
    var links = '<p class="muted small tax-links">' + esc(t("tax.links", "Onde pagar:")) + ' <a href="https://www.irs.gov/payments/direct-pay" target="_blank" rel="noopener">IRS Direct Pay</a> · <a href="https://mtc.dor.state.ma.us/mtc/_/" target="_blank" rel="noopener">MassTaxConnect (MA)</a> · <a href="https://www.revenue.nh.gov/" target="_blank" rel="noopener">NH DRA</a></p>';
    return head + disc + hero + '<div class="grid2 tax-grid">' + calc + proj + "</div>" + qs + form + links;
  };

  // ═══════════ ações ═══════════
  function draftSettings() { return settingsOf(cache.data); }
  function saveSettings(patch, other) {
    var st = Object.assign(draftSettings(), patch);
    return API.saveTaxSettings(S.company, year(), { settings: st, otherDeductions: other }).then(reload).then(function () { E.render(); });
  }
  AC.taxYear = function (el) { S.taxYear = year() + Number(el.dataset.id); E.render(); };
  AC.taxToggle = function () { S.taxOpen = !S.taxOpen; E.render(); };
  AC.taxMode = function (el) { S.taxOpen = true; saveSettings({ mode: el.dataset.id }); };
  EXT.change.push(function (el) {
    if (S.view !== "impostos") return false;
    if (el.id === "txState" || el.id === "txEntity") { // troca de estado/tipo: sugere a taxa estadual (e desliga o SE tax em corporação)
      var stt = $v("txState") || draftSettings().state, ent = $v("txEntity") || draftSettings().entity, sr = NV.suggestedStateRate(stt, ent), inp = document.getElementById("txStateRate");
      if (sr != null && inp) inp.value = sr;
      if (el.id === "txEntity") { var fed = document.getElementById("txFed"); if (fed && ent === "ccorp" && Number(fed.value) === 12) fed.value = 21; if (fed && ent !== "ccorp" && Number(fed.value) === 21) fed.value = 12; }
      return true;
    }
    if (el.dataset.act === "taxPaid") { AC.taxPaid(el); return true; }
    return false;
  });
  function $v(id) { var x = document.getElementById(id); return x ? x.value : ""; }
  EXT.submit.taxForm = function () {
    var simple = draftSettings().mode === "simple", patch = {};
    if (simple) patch.simplePct = Number($v("txSimple")) || 0;
    else {
      var ent = $v("txEntity"); patch = { entity: ent, state: $v("txState"), federalRate: Number($v("txFed")) || 0, stateRate: Number($v("txStateRate")) || 0, seTax: !!(document.getElementById("txSE") || {}).checked && ent !== "scorp" && ent !== "ccorp" };
    }
    var inv = document.getElementById("txInv"); if (inv) patch.includePaidInvoices = inv.checked;
    S.taxOpen = true;
    saveSettings(patch, Math.max(0, Number($v("txOther")) || 0)).then(function () { E.toast(t("tax.saved", "Taxas salvas. O cálculo foi refeito.")); }).catch(function (e) { E.toast(e.message || t("tax.err", "Não deu para salvar.")); });
  };
  AC.taxPaid = function (el) {
    var q = Number(el.dataset.id), on = el.checked, r = compute(cache.data), qq = r.quarters[q - 1];
    if (on) { S.modal = { type: "taxPay", title: t("tax.payTitle", "{n}º trimestre pago", { n: q }), q: q, amount: Math.round(qq.amount) }; E.render(); return; }
    API.setTaxPayment(S.company, year(), q, { paid: false }).then(reload).then(function () { E.render(); E.toast(t("tax.unmarked", "Desmarcado.")); });
  };
  EXT.modals.taxPay = function (m) {
    return '<form id="taxPayForm" class="stack"><p class="muted small" style="margin:0">' + esc(t("tax.payText", "Quanto você pagou ao IRS neste trimestre? Fica registrado quem marcou e quando.")) + "</p>" +
      '<div class="grid2"><label class="field"><span>' + esc(t("tax.payAmount", "Valor pago ($)")) + '</span><input type="number" id="tpAmt" min="0" step="0.01" inputmode="decimal" required value="' + esc(m.amount) + '"></label>' +
      '<label class="field"><span>' + esc(t("tax.payDate", "Data do pagamento")) + '</span><input type="date" id="tpDate" value="' + esc(E.todayISO()) + '"></label></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">' + esc(t("tax.cancel", "Cancelar")) + '</button><button type="submit" class="btn">' + ic("check", 18) + esc(t("tax.payOk", "Marcar como pago")) + "</button></div></form>";
  };
  EXT.submit.taxPayForm = function () {
    var m = S.modal; if (!m) return;
    API.setTaxPayment(S.company, year(), m.q, { paid: true, amount: Number($v("tpAmt")) || 0, paidOn: $v("tpDate") }).then(reload).then(function () { S.modal = null; E.render(); E.toast(t("tax.marked", "Trimestre marcado como pago.")); })
      .catch(function (e) { E.toast(e.message || t("tax.err", "Não deu para salvar.")); });
  };

  // lembrete no Painel do dono: próximo vencimento em até 30 dias e ainda não pago
  EXT.dashTop.push(function () {
    if (!E.can("finance") || S.view !== "dashboard" || year() !== new Date().getFullYear()) return "";
    var d = ensure(); if (!d) return "";
    var r = compute(d), n = r.next; if (!n) return "";
    var left = Math.round((new Date(n.due + "T12:00:00") - new Date(E.todayISO() + "T12:00:00")) / 864e5);
    if (left > 30 || n.amount < 1) return "";
    return '<div class="tour-offer tax-remind"><span class="em-ic">' + ic("percent", 20) + "</span><div><b>" + esc(t("tax.remind", "Imposto estimado: {m} vence em {d}", { m: E.money(n.amount, 0), d: dueLabel(n.due) })) + '</b><span class="muted small">' + esc(t("tax.remindSub", "Guarde {p} de cada pagamento para não apertar no fim do ano.", { p: pct(r.setAsidePct) })) + '</span></div><span class="sp"></span><button type="button" class="btn sm" data-act="nav" data-id="impostos">' + esc(t("tax.remindGo", "Ver impostos")) + "</button></div>";
  });
})();
