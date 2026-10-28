/* Bisey — lista de material da proposta aceita (tela). Motor de preços: matlist-core.js (o mesmo do servidor).
   Quando o cliente aceita a proposta, a lista é montada sozinha (servidor: servicos → publicAccept; modo demonstração: data.js)
   e aqui aparece com o melhor preço de cada item: "Meus preços" (por loja) + promoções/ofertas, ou o link de busca das lojas.
   Papéis: dono vê tudo; gerente vê itens, quantidades e lojas e marca comprados, SEM preços nem totais; funcionário não vê
   (Propostas não aparecem para funcionário). Ações: marcar comprado (quem comprou), editar qtd / tirar / pôr item, exportar CSV,
   imprimir / PDF, pedir cotação ao fornecedor, usar como limite de material da obra e lançar o que foi comprado como despesa. */
(function () {
  "use strict";
  var E = window.EE, M = window.BiseyMat; if (!E || !E.prop || !M) return;
  var S = E.S, API = E.API, esc = E.esc, t = E.t, EXT = E.EXT, AC = EXT.actions, PR = E.prop;
  EXT.modals = EXT.modals || {};
  function $(s) { return document.querySelector(s); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function m2(n) { return PR.money2(n); }
  function canMoney() { return E.can("finance"); } // dono (o gerente não vê dinheiro)
  function sname(id) { var s = PR.storeOf(id); return (s && s.short) || id; }
  function links() { return M.storeLinks((window.APP_CONFIG || {}).STORE_LINKS); }
  function storesFor(p) { return PR.stores(p.companyId).map(function (s) { return { id: s.id, name: s.name, short: s.short, url: s.url("QQQ").replace("QQQ", "{q}") }; }); }
  // promoções que podem dar preço: as registradas / importadas pela empresa e feeds oficiais (o motor ignora as outras)
  function deals() { return S.deals || []; }
  function ctxFor(p) { return { materials: S.materials || [], deals: deals(), stores: storesFor(p), links: links(), today: E.todayISO() }; }
  function priced(p) { return M.priceList(p.materialList || { items: [] }, ctxFor(p)); }
  function byId(id) { return (S.proposals || []).find(function (x) { return x.id === id; }); }
  function cur() { var p = S.pdraft; return p && p.materialList ? p : null; }
  function now() { return new Date().toISOString(); }
  function who() { return { by: (S.user && S.user.id) || null, byName: (S.user && S.user.name) || "" }; }

  // ═══════════ aviso de lista pronta (no aparelho: o que já foi visto) ═══════════
  var SEEN = "bisey_ml_seen";
  function seenMap() { try { return JSON.parse(localStorage.getItem(SEEN) || "{}") || {}; } catch (e) { return {}; } }
  function markSeen(p) { if (!p || !p.materialList) return; var s = seenMap(); if (s[p.id] === p.materialList.at) return; s[p.id] = p.materialList.at; try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch (e) { } }
  function readyMsg(p) {
    var pr = priced(p), sv = pr.savings;
    return canMoney() && sv > 0 ? t("matlist.readySavings", "Lista de material pronta — economia estimada {v}", { v: m2(sv) }) : t("matlist.ready", "Lista de material pronta.");
  }
  function banner(all) {
    var s = seenMap(), fresh = (all || []).filter(function (p) { return p.materialList && p.materialList.auto && s[p.id] !== p.materialList.at && !PR.isInv(p); });
    if (!fresh.length) return "";
    var p = fresh[0];
    return '<div class="panel ml-banner" role="status"><span class="ml-banner-ic" aria-hidden="true">' + E.ic("check", 18) + '</span><div><b>' + esc(readyMsg(p)) + '</b><div class="small muted">' +
      esc(t("matlist.bannerSub", "Proposta {n} aceita · {c}", { n: p.number || "", c: (p.client || {}).address || (p.client || {}).name || "" })) + (fresh.length > 1 ? " · " + esc(t("matlist.bannerMore", "+{n} lista(s)", { n: fresh.length - 1 })) : "") +
      '</div></div><button type="button" class="btn sm" data-act="mlOpen" data-id="' + esc(p.id) + '">' + esc(t("matlist.seeList", "Ver lista")) + "</button></div>";
  }
  function rowBadge(p) {
    if (!p.materialList || PR.isInv(p)) return "";
    var n = (p.materialList.items || []).length, b = (p.materialList.items || []).filter(function (i) { return i.bought; }).length, sv = canMoney() ? ((p.materialList.pricing || {}).savings || 0) : 0;
    return '<div class="small ml-badge">' + E.ic("tag", 13) + " " + esc(b ? t("matlist.badgeBought", "Material: {b} de {n} comprados", { b: b, n: n }) : t("matlist.badge", "Lista de material · {n} itens", { n: n })) +
      (sv > 0 && !b ? ' <span class="v-good">' + esc(t("matlist.badgeSave", "economia {v}", { v: m2(sv) })) + "</span>" : "") + "</div>";
  }
  function afterSave(p, hadList) {
    if (!p || PR.isInv(p) || p.status !== "Aceita") return;
    if (p.materialList && !hadList) { E.toast(readyMsg(p)); return; }
    if (!p.materialList && API.mode !== "demo") build(p, true); // conta conectada: o aceite marcado no app também monta a lista
  }

  // ═══════════ montar / refazer ═══════════
  function build(p, auto) {
    if (!p.id) { E.toast(t("proposals.saveTheEstimateFirst", "Salve a proposta primeiro.")); return; }
    S.mlBusy = p.id; E.render();
    var done = function (ml, err) {
      S.mlBusy = null;
      if (!ml) { E.render(); E.toast(err); return; }
      var keep = {}; ((p.materialList || {}).items || []).forEach(function (i) { if (i.bought) keep[i.name.toLowerCase()] = i.bought; }); // refazer não apaga o que já foi comprado
      (ml.items || []).forEach(function (i) { var b = keep[String(i.name).toLowerCase()]; if (b) i.bought = b; });
      if (auto) ml.auto = true;
      commit(p, ml).then(function () { E.toast(readyMsg(p)); });
    };
    if (API.mode === "demo") {
      M.loadCatalog().then(function (cat) {
        var tr = PR.tradeKey(p.companyId), tc = cat.trades[tr] || cat.trades.electrical;
        var ml = { items: M.cleanTakeoff(M.mockTakeoff(tc, p, window.NV.lang)), notes: t("matlist.demoNote", "Lista de exemplo do modo demonstração (na conta conectada a IA lê o escopo da proposta)."), at: now(), trade: tr, source: "demo" };
        ml.pricing = M.snapshot(M.priceList(ml, ctxFor(p)));
        done(ml);
      }).catch(function () { done(null, t("matlist.catalogError", "Não deu para carregar o catálogo de materiais. Confira a conexão.")); });
      return;
    }
    API.services("materialList", { id: p.id }).then(function (r) { if (r && r.ok && r.list) done(r.list); else done(null, PR.svcMsg(r)); });
  }
  AC.pMatList = function () {
    var p = S.pdraft; if (!p) return;
    if (!p.id) { E.toast(t("proposals.saveTheEstimateFirst", "Salve a proposta primeiro.")); return; }
    var b = ((p.materialList || {}).items || []).some(function (i) { return i.bought; }), edited = p.materialList && p.materialList.edited;
    if (p.materialList && (b || edited)) { S.modal = { type: "confirm", title: t("matlist.rebuildTitle", "Refazer a lista"), text: t("matlist.rebuildText", "A lista nova substitui os itens e quantidades que você editou. O que já foi marcado como comprado continua marcado."), act: "mlRebuild", id: p.id, okLabel: t("proposals.rebuildList", "Refazer lista") }; E.render(); return; }
    build(p);
  };
  AC.mlRebuild = function () { S.modal = null; if (S.pdraft) build(S.pdraft); };

  // ═══════════ gravar (só a lista; o resto do rascunho continua como está) ═══════════
  function commit(p, ml) {
    ml.updatedAt = now();
    var wasClean = S.pdraft === p && !PR.isDirty();
    p.materialList = ml;
    var stored = byId(p.id), rec = Object.assign({}, clone(stored || p), { materialList: clone(ml) });
    return API.saveProposal(rec).then(function (saved) {
      var i = (S.proposals || []).findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) S.proposals[i] = saved; else S.proposals.unshift(saved);
      p.materialList = saved.materialList || ml;
      ["updatedAt", "updatedBy", "updatedByName"].forEach(function (k) { if (saved[k] !== undefined) p[k] = saved[k]; });
      if (wasClean) PR.markClean();
      E.render();
    }).catch(function (e) { E.toast((e && e.message) || t("proposals.errorSaving", "Erro ao salvar.")); E.render(); });
  }
  function edit(fn) { var p = cur(); if (!p) return; var ml = clone(p.materialList); fn(ml); commit(p, ml); }

  // ═══════════ painel ═══════════
  function panel(p) {
    if (!p || !p.id || PR.isInv(p)) return "";
    var ml = p.materialList, money = canMoney(), busy = S.mlBusy === p.id;
    if (ml) markSeen(p);
    var sub = ml ? t("matlist.builtOn", "Montada em {d}", { d: E.fmtDate(ml.at) }) + (ml.auto ? " · " + t("matlist.autoOnAccept", "sozinha, no aceite") : "")
      : p.status === "Aceita" ? t("matlist.notYet", "Proposta aceita — monte a lista agora") : t("matlist.buildsOnAccept", "É montada sozinha quando o cliente aceita a proposta");
    var head = '<div class="ml-head"><div><h3>' + esc(t("matlist.title", "Lista de material")) + '</h3><div class="muted small">' + esc(sub) + " · " + esc(t("matlist.private", "não aparece para o cliente nem para os funcionários")) + "</div></div>" +
      '<div class="row">' + (ml ? exportMenu() : "") + '<button type="button" class="btn ' + (ml ? "ghost " : "") + 'sm" data-act="pMatList"' + (busy ? " disabled" : "") + ">" +
      (busy ? '<span class="spin" aria-hidden="true"></span> ' + esc(t("proposals.building", "Montando…")) : esc(ml ? t("proposals.rebuildList", "Refazer lista") : t("proposals.buildListNow", "Montar lista agora"))) + "</button></div></div>";
    if (!ml || !(ml.items || []).length) return '<section class="panel ed-sec ml" id="ml">' + head + (ml ? '<div class="muted small">' + esc(t("matlist.empty", "A lista está vazia. Use “+ Item” em Editar lista ou refaça a lista.")) + "</div>" + editBar(true) : "") + "</section>";
    var pr = priced(p), f = S.mlFilter || "all", editing = S.mlEdit === p.id;
    var rows = pr.rows.filter(function (r) { return f === "all" || (f === "todo" ? !r.bought : !!r.bought); });
    // por categoria (na ordem em que aparecem)
    var cats = [], byCat = {};
    rows.forEach(function (r) { var c = r.item.category || t("matlist.other", "Outros"); if (!byCat[c]) { byCat[c] = []; cats.push(c); } byCat[c].push(r); });
    var list = cats.map(function (c) { return '<h4 class="ml-cat">' + esc(c) + ' <span class="muted">' + byCat[c].length + "</span></h4><ul class=\"ml-items\">" + byCat[c].map(function (r) { return itemRow(r, money, editing); }).join("") + "</ul>"; }).join("");
    var nb = pr.boughtCount, pct = pr.count ? Math.round(nb / pr.count * 100) : 0;
    var progress = '<div class="ml-progress"><div class="spread"><span class="small"><b>' + esc(t("matlist.boughtOf", "{b} de {n} comprados", { b: nb, n: pr.count })) + "</b></span>" +
      (money && pr.boughtTotal ? '<span class="small muted">' + esc(t("matlist.spent", "pago até agora {v}", { v: m2(pr.boughtTotal) })) + "</span>" : "") + '</div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(t("matlist.progress", "Comprados")) + '"><div style="width:' + pct + '%"></div></div></div>';
    var chips = '<div class="spread ml-tools"><div class="chips" role="group" aria-label="' + esc(t("matlist.filter", "Filtrar itens")) + '">' + [["all", t("matlist.fAll", "Todos")], ["todo", t("matlist.fTodo", "Falta comprar")], ["done", t("matlist.fDone", "Comprados")]].map(function (x) {
      return '<button type="button" class="chip' + (f === x[0] ? " on" : "") + '" data-act="mlFilter" data-id="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>" +
      '<button type="button" class="btn ghost sm" data-act="mlEdit" aria-pressed="' + editing + '">' + E.ic("edit", 15) + " " + esc(editing ? t("matlist.editDone", "Concluir edição") : t("matlist.edit", "Editar lista")) + "</button></div>";
    var affStores = []; pr.rows.forEach(function (r) { r.links.forEach(function (l) { if (affStores.indexOf(l.store) < 0) affStores.push(l.store); }); if (r.best && affStores.indexOf(r.best.store) < 0) affStores.push(r.best.store); });
    var aff = M.hasAffiliate(links(), affStores) ? '<p class="small muted ml-aff" role="note">' + esc(t("matlist.affiliate", "Alguns links podem ser de afiliados; o Bisey pode receber comissão — sem custo para você.")) + "</p>" : "";
    return '<section class="panel ed-sec ml" id="ml">' + head + (money ? summary(pr) : mgrNote(pr)) + progress + (money ? pending(pr) : "") + chips +
      aff + (list || '<div class="muted small">' + esc(t("matlist.noneHere", "Nenhum item neste filtro.")) + "</div>") + (editing ? editBar() : "") +
      (money && pr.byBest.length ? storesBlock(pr) : "") +
      (ml.notes ? '<div class="muted small">' + esc(ml.notes) + "</div>" : "") +
      '<p class="muted small ml-foot">' + esc(money ? t("matlist.footOwner", "Os preços vêm só dos seus preços (Preços → Meus preços), das promoções que você registrou ou importou e de feeds oficiais das lojas. Loja e preço podem mudar: confirme sempre no caixa. Sem preço, use “Ver preço na loja”.")
        : t("matlist.footMgr", "Preços e totais ficam só com o dono. Use os links para ver o item na loja e marque o que for comprando.")) + "</p></section>";
  }
  function exportMenu() {
    return '<details class="dd ml-dd"><summary class="btn ghost sm" aria-haspopup="menu">' + E.ic("upload", 15) + " " + esc(t("matlist.actions", "Exportar e enviar")) + '</summary><div class="dd-menu" role="menu">' +
      '<button type="button" role="menuitem" data-act="mlCsv">' + esc(t("matlist.csv", "Baixar CSV (planilha)")) + "</button>" +
      '<button type="button" role="menuitem" data-act="mlPrint">' + esc(t("matlist.print", "Imprimir / salvar PDF")) + "</button>" +
      '<button type="button" role="menuitem" data-act="mlQuote">' + esc(t("matlist.quote", "Pedir cotação ao fornecedor")) + "</button>" +
      (canMoney() ? '<button type="button" role="menuitem" data-act="mlBudget">' + esc(t("matlist.budget", "Usar como limite de material da obra")) + "</button>" : "") + "</div></details>";
  }
  function summary(pr) {
    var s = pr.single;
    var tile = function (label, value, sub, cls) { return '<div class="kpi ml-kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value ' + (cls || "") + '">' + value + "</div>" + (sub ? '<div class="kpi-sub">' + sub + "</div>" : "") + "</div>"; };
    return '<div class="kpis ml-kpis">' +
      tile(t("matlist.mix", "Mix mais barato"), esc(m2(pr.mix)), esc(t("matlist.pricedOf", "{p} de {n} itens com preço", { p: pr.priced, n: pr.count }))) +
      tile(s ? t("matlist.allAt", "Tudo na {s}", { s: sname(s.store) }) : t("matlist.allAtNone", "Tudo numa loja só"), s ? esc(m2(s.total)) : "—", s ? esc(s.full ? t("matlist.coversAll", "todos os itens com preço") : t("matlist.covers", "só {c} de {n} itens têm preço lá", { c: s.covered, n: pr.count })) : "") +
      tile(t("matlist.savings", "Economia estimada"), esc(m2(pr.savings)), s ? esc(t("matlist.savingsSub", "comprando cada item onde é mais barato, em vez de tudo na {s}", { s: sname(s.store) })) : "", "v-good") +
      tile(t("matlist.noPrice", "Sem preço"), String(pr.noPrice), esc(pr.noPrice ? t("matlist.noPriceSub", "use “Ver preço na loja”") : t("matlist.noPriceNone", "todos os itens têm preço")) + (pr.stale ? " · " + esc(t("matlist.staleN", "{n} com preço de mais de 30 dias", { n: pr.stale })) : ""), pr.noPrice ? "v-bad" : "") + "</div>";
  }
  function mgrNote(pr) { return '<div class="muted small">' + esc(t("matlist.mgrSummary", "{n} itens · {s} sem loja com preço", { n: pr.count, s: pr.noPrice })) + "</div>"; }
  function pending(pr) {
    if (!pr.pending.n) return "";
    return '<div class="note ml-pending"><div><b>' + esc(t("matlist.pendingTitle", "{n} item(ns) comprado(s) ainda fora das despesas", { n: pr.pending.n })) + "</b><div class=\"small\">" +
      esc(t("matlist.pendingSub", "Total pago {v}. Lance como despesa de material da obra para o financeiro ficar certo.", { v: m2(pr.pending.total) })) + '</div></div><button type="button" class="btn sm" data-act="mlExpense">' + esc(t("matlist.toExpense", "Lançar despesa")) + "</button></div>";
  }
  function flagPills(c) {
    var out = [];
    if (c.src === "promo") out.push('<span class="pill good">' + esc(srcLabel(c)) + "</span>");
    if (c.stale) out.push('<span class="pill warn">' + esc(t("matlist.stale", "preço de {n} dias", { n: c.age })) + "</span>");
    return out.join(" ");
  }
  // origem de cada preço (regra dos varejistas): seu preço · promoção registrada · feed oficial
  function srcLabel(c) {
    if (c.src === "promo") {
      var base = c.kind === "feed" ? t("matlist.srcFeed", "feed oficial") : t("matlist.srcDeal", "promoção registrada");
      return c.expired ? t("matlist.promoExpired", "{s} · vencida em {d}", { s: base, d: E.fmtDate(c.until) }) : c.until ? t("matlist.promoUntil", "{s} · até {d}", { s: base, d: E.fmtDate(c.until) }) : base;
    }
    return t("matlist.mine", "seu preço · {d}", { d: c.date ? E.fmtDate(c.date) : "—" }) + (c.stale ? " · " + t("matlist.old", "desatualizado") : "");
  }
  function itemRow(r, money, editing) {
    var it = r.item, b = r.bought, i = r.idx, best = r.best;
    var check = '<button type="button" class="ml-check' + (b ? " on" : "") + '" data-act="mlBuy" data-id="' + i + '" aria-pressed="' + !!b + '" aria-label="' + esc((b ? t("matlist.unmark", "Desmarcar comprado: ") : t("matlist.mark", "Marcar como comprado: ")) + it.name) + '">' + (b ? E.ic("check", 16) : "") + "</button>";
    var name = '<div class="ml-name"><b>' + esc(it.name) + "</b>" + (it.spec || it.brand ? ' <span class="muted small">' + esc([it.spec, it.brand].filter(Boolean).join(" · ")) + "</span>" : "") + "</div>";
    var qty = editing ? '<label class="ml-qty-ed"><span class="sr-only">' + esc(t("matlist.qty", "Quantidade")) + '</span><input type="number" min="0" step="any" inputmode="decimal" data-mlqty="' + i + '" value="' + esc(it.qty) + '"></label><span class="muted small">' + esc(it.unit || "") + '</span><button type="button" class="btn ghost sm" data-act="mlRm" data-id="' + i + '" aria-label="' + esc(t("matlist.remove", "Tirar da lista: ") + it.name) + '">✕</button>'
      : '<span class="ml-qty num">' + esc(it.qty) + " " + esc(it.unit || "") + "</span>";
    var price = "";
    if (money) price = best ? '<div class="ml-price"><span class="pill accent">' + esc(sname(best.store)) + '</span> <span class="num">' + esc(m2(best.unit)) + "</span> × " + esc(it.qty) + ' = <b class="num">' + esc(m2(r.total)) + "</b> " + flagPills(best) + "</div>"
      : '<div class="ml-price"><span class="pill warn">' + esc(t("matlist.noPriceItem", "sem preço")) + "</span></div>";
    else if (best) price = '<div class="ml-price small">' + esc(t("matlist.bestStore", "Melhor loja: {s}", { s: sname(best.store) })) + "</div>";
    if (money && best && best.src === "mine") price = price.replace(/<\/div>$/, ' <span class="muted small">' + esc(srcLabel(best)) + "</span></div>"); // origem do preço
    var buy = '<a class="btn ghost sm" href="' + esc(r.buyUrl) + '" target="_blank" rel="noopener">' + esc(best ? t("matlist.buyAt", "Comprar / ver na {s}", { s: sname(best.store) }) : t("matlist.seePriceAt", "Ver preço na {s}", { s: sname(r.links[0].store) })) + " ↗</a>";
    var alts = (money ? r.alts : []).map(function (c) {
      return '<li class="' + (c.expired ? "ml-exp" : "") + '"><span class="store-chip">' + esc(sname(c.store)) + '</span> <span class="num">' + esc(m2(c.unit)) + '</span> <span class="muted small">' + esc(srcLabel(c)) + '</span> <a href="' + esc(c.url) + '" target="_blank" rel="noopener" class="small">' + esc(t("matlist.view", "ver")) + " ↗</a></li>";
    }).join("");
    // lojas sem preço permitido: só o link ("Ver preço na loja"), nunca um preço tirado do site
    var others = r.links.filter(function (l) { return !best || l.store !== best.store; }).map(function (l) { return '<a class="chip ml-chip" href="' + esc(l.url) + '" target="_blank" rel="noopener" title="' + esc(t("matlist.seePriceAt", "Ver preço na {s}", { s: sname(l.store) })) + '">' + esc(sname(l.store)) + " ↗</a>"; }).join("");
    var nAlt = money ? r.alts.length : 0;
    var more = '<details class="ml-alts"><summary class="small">' + esc(nAlt ? t("matlist.alts", "{n} outro(s) preço(s) e lojas", { n: nAlt }) : t("matlist.otherStores", "Ver preço em outras lojas")) + "</summary>" + (alts ? '<ul class="ml-alt-list">' + alts + "</ul>" : "") + '<div class="chips">' + others + "</div></details>";
    var by = b ? '<div class="ml-by">' + E.byLine(t("matlist.boughtBy", "Comprado por {n}"), b.byName, b.at) + (money && b.price ? ' <span class="small muted">· ' + esc(t("matlist.paid", "pago {v} na {s}", { v: m2(b.price), s: sname(b.store || "") })) + "</span>" : "") +
      (money ? ' <button type="button" class="link-btn small" data-act="mlPaid" data-id="' + i + '">' + esc(b.expenseId ? t("matlist.inExpenses", "nas despesas") : t("matlist.editPaid", "valor pago")) + "</button>" : "") + "</div>" : "";
    return '<li class="ml-item' + (b ? " done" : "") + '">' + check + '<div class="ml-main"><div class="ml-top">' + name + '<div class="ml-q">' + qty + "</div></div>" + price + '<div class="ml-links">' + buy + more + "</div>" + by + "</div></li>";
  }
  function editBar(emptyList) {
    var units = ["ea", "un", "roll", "box", "ft", "sheet", "gal", "bag", "bundle"];
    return '<div class="ml-add"><label class="field"><span>' + esc(t("matlist.newItem", "Novo item")) + '</span><input type="text" id="mlNewName" list="mlNames" placeholder="' + esc(t("matlist.newItemPh", "ex.: caixa 4\" com tampa")) + '"></label>' +
      '<label class="field"><span>' + esc(t("matlist.qty", "Quantidade")) + '</span><input type="number" id="mlNewQty" min="0" step="any" inputmode="decimal" value="1"></label>' +
      '<label class="field"><span>' + esc(t("matlist.unit", "Unidade")) + '</span><input type="text" id="mlNewUnit" list="mlUnits" value="' + esc(emptyList ? "" : "") + '"></label>' +
      '<button type="button" class="btn sm" data-act="mlAdd">' + esc(t("matlist.add", "+ Item")) + "</button>" +
      '<datalist id="mlUnits">' + units.map(function (u) { return '<option value="' + u + '">'; }).join("") + "</datalist>" +
      '<datalist id="mlNames">' + (S.materials || []).map(function (m) { return '<option value="' + esc(m.name) + '">'; }).join("") + "</datalist></div>";
  }
  function storesBlock(pr) {
    return '<div class="ml-stores"><span class="label">' + esc(t("matlist.perStore", "Comprar em cada loja (mix mais barato)")) + "</span>" + pr.byBest.map(function (g) {
      return '<div class="sec-card"><div class="spread"><b>' + esc(sname(g.store)) + '</b><b class="num">' + esc(m2(g.total)) + '</b></div><div class="small">' + g.rows.map(function (r) { return esc(r.item.qty + " " + (r.item.unit || "") + " " + r.item.name); }).join(" · ") + "</div></div>";
    }).join("") + (pr.stores.length > 1 ? '<span class="label" style="margin-top:6px">' + esc(t("matlist.oneStore", "Tudo numa loja só")) + '</span><div class="bars">' + pr.stores.map(function (s) {
      return '<div class="bar-row"><span>' + esc(sname(s.store)) + '</span><span class="small muted">' + esc(s.missing ? t("matlist.missingN", "{n} sem preço", { n: s.missing }) : t("proposals.allItems", "todos os itens")) + '</span><span class="n">' + esc(m2(s.total)) + "</span></div>"; }).join("") + "</div>" : "") + "</div>";
  }

  // ═══════════ ações ═══════════
  AC.mlOpen = function (el) { E.runAct ? E.runAct("pOpen", el.dataset.id) : (AC.pOpen && AC.pOpen(el)); setTimeout(function () { var x = $("#ml"); if (x && x.scrollIntoView) x.scrollIntoView({ behavior: "smooth", block: "start" }); }, 250); };
  AC.mlFilter = function (el) { S.mlFilter = el.dataset.id; E.render(); };
  AC.mlEdit = function () { var p = cur(); S.mlEdit = S.mlEdit === (p && p.id) ? null : p && p.id; E.render(); };
  AC.mlBuy = function (el) {
    var i = Number(el.dataset.id), p = cur(); if (!p) return;
    var pr = priced(p), r = pr.rows[i]; if (!r) return;
    edit(function (ml) {
      var it = ml.items[i];
      if (it.bought) { delete it.bought; return; }
      var w = who(); it.bought = { by: w.by, byName: w.byName, at: now() };
      if (r.best) { it.bought.store = r.best.store; if (canMoney()) it.bought.price = r.total; } // gerente: registra a loja, não o valor
    });
  };
  AC.mlRm = function (el) { var i = Number(el.dataset.id); edit(function (ml) { ml.items.splice(i, 1); ml.edited = true; }); };
  AC.mlAdd = function () {
    var name = ($("#mlNewName") || {}).value, q = Number(($("#mlNewQty") || {}).value), u = ($("#mlNewUnit") || {}).value;
    name = String(name || "").trim(); if (!name || !(q > 0)) { E.toast(t("matlist.addNeed", "Escreva o item e a quantidade.")); return; }
    var m = (S.materials || []).find(function (x) { return x.name === name; });
    var p = cur();
    var add = function (ml) { ml.items.push({ id: "u" + Date.now().toString(36), name: name, qty: q, unit: String(u || (m && m.unit) || "").trim(), category: (m && m.category) || "", search: name, materialId: m ? m.id : undefined, added: true }); ml.edited = true; };
    if (!p && S.pdraft && S.pdraft.id) { var ml0 = { items: [], at: now(), source: "manual" }; add(ml0); commit(S.pdraft, ml0); return; }
    edit(add);
  };
  EXT.change.push(function (el) {
    if (el.dataset.mlqty == null) return false;
    var i = Number(el.dataset.mlqty), v = Number(el.value);
    if (!(v >= 0)) return true;
    edit(function (ml) { if (ml.items[i]) { ml.items[i].qty = v; ml.edited = true; } });
    return true;
  });
  EXT.input.push(function (el) { return el.dataset.mlqty != null; }); // grava ao sair do campo (change)

  // valor pago / loja (dono)
  AC.mlPaid = function (el) { var p = cur(); if (!p || !canMoney()) return; S.modal = { type: "mlPaid", title: t("matlist.paidTitle", "Compra do item"), idx: Number(el.dataset.id) }; E.render(); };
  EXT.modals.mlPaid = function (m) {
    var p = cur(), it = p.materialList.items[m.idx], b = it.bought || {}, st = storesFor(p).map(function (s) { return s.id; });
    if (b.store && st.indexOf(b.store) < 0) st.push(b.store);
    return '<form id="mlPaidForm" class="stack"><div><b>' + esc(it.name) + '</b><div class="muted small">' + esc(it.qty + " " + (it.unit || "")) + "</div></div>" +
      '<div class="grid2"><label class="field"><span>' + esc(t("matlist.store", "Loja")) + '</span><select id="mlpStore">' + st.map(function (s) { return '<option value="' + esc(s) + '"' + (s === b.store ? " selected" : "") + ">" + esc(sname(s)) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>' + esc(t("matlist.paidTotal", "Total pago $")) + '</span><input type="number" id="mlpPrice" step="0.01" min="0" inputmode="decimal" value="' + esc(b.price != null ? b.price : "") + '"></label></div>' +
      (b.expenseId ? '<div class="muted small">' + esc(t("matlist.alreadyExpense", "Já lançado nas despesas. Mudar aqui não altera a despesa.")) + "</div>" : "") +
      '<button class="btn" type="submit">' + esc(t("matlist.save", "Salvar")) + "</button></form>";
  };
  EXT.submit.mlPaidForm = function () {
    var i = S.modal.idx, store = $("#mlpStore").value, price = Number($("#mlpPrice").value);
    S.modal = null; edit(function (ml) { var it = ml.items[i]; if (!it) return; it.bought = Object.assign({}, it.bought || Object.assign(who(), { at: now() }), { store: store, price: price > 0 ? Math.round(price * 100) / 100 : null }); });
  };

  // ── despesa do que foi comprado (dono) ──
  function projOptions(p, sel) {
    var list = (E.companyProjects ? E.companyProjects() : S.projects || []).filter(function (x) { return x.companyId === p.companyId; });
    var addr = String((p.client || {}).address || "").toLowerCase().split(",")[0].trim();
    var pick = sel || p.projectId || ((list.find(function (x) { return addr && String(x.address || "").toLowerCase().indexOf(addr) === 0; }) || {}).id) || "";
    return { html: '<option value="">' + esc(t("matlist.noProject", "— escolha a obra —")) + "</option>" + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === pick ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join(""), pick: pick, n: list.length };
  }
  AC.mlExpense = function () { var p = cur(); if (!p || !canMoney()) return; S.modal = { type: "mlExpense", title: t("matlist.expenseTitle", "Lançar compra como despesa") }; E.render(); };
  EXT.modals.mlExpense = function () {
    var p = cur(), pr = priced(p), by = {}, po = projOptions(p);
    pr.pending.rows.forEach(function (r) { var s = r.bought.store || ""; by[s] = (by[s] || 0) + Number(r.bought.price); });
    return '<form id="mlExpForm" class="stack"><label class="field"><span>' + esc(t("matlist.project", "Obra")) + '</span><select id="mlxProj" required>' + po.html + "</select></label>" +
      '<div class="table-wrap"><table><tbody>' + Object.keys(by).map(function (s) { return "<tr><td>" + esc(s ? sname(s) : t("matlist.other", "Outros")) + '</td><td class="n"><b>' + esc(m2(by[s])) + "</b></td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="muted small">' + esc(t("matlist.expenseHelp", "Entra em Despesas como material, uma por loja, com a data de hoje. Você confere e edita lá.")) + "</div>" +
      '<button class="btn" type="submit">' + esc(t("matlist.toExpense", "Lançar despesa")) + "</button></form>";
  };
  EXT.submit.mlExpForm = function () {
    var p = cur(), proj = $("#mlxProj").value; if (!proj) { E.toast(t("matlist.pickProject", "Escolha a obra.")); return; }
    var pr = priced(p), by = {};
    pr.pending.rows.forEach(function (r) { var s = r.bought.store || ""; (by[s] = by[s] || []).push(r); });
    S.modal = null; E.render();
    var ids = {};
    Object.keys(by).reduce(function (pp, s) {
      var amt = Math.round(by[s].reduce(function (a, r) { return a + Number(r.bought.price); }, 0) * 100) / 100;
      return pp.then(function () {
        return API.addExpense({ companyId: p.companyId, kind: "expense", category: "material", amount: amt, projectId: proj, date: E.todayISO(), vendor: s ? PR.storeOf(s).name || sname(s) : "",
          note: t("matlist.expenseNote", "Lista de material da proposta {n}", { n: p.number || "" }) + ": " + by[s].map(function (r) { return r.item.qty + " " + (r.item.unit || "") + " " + r.item.name; }).join("; ").slice(0, 400) })
          .then(function (x) { by[s].forEach(function (r) { ids[r.idx] = (x && x.id) || "ok"; }); });
      });
    }, Promise.resolve()).then(function () {
      edit(function (ml) { Object.keys(ids).forEach(function (i) { if (ml.items[i] && ml.items[i].bought) ml.items[i].bought.expenseId = ids[i]; }); });
      if (E.refresh) E.refresh();
      E.toast(t("matlist.expenseDone", "Despesa lançada na obra."));
    }).catch(function (e) { E.toast((e && e.message) || t("proposals.errorSaving", "Erro ao salvar.")); });
  };

  // ── limite (orçamento) de material da obra (dono) ──
  AC.mlBudget = function () { var p = cur(); if (!p || !canMoney()) return; S.modal = { type: "mlBudget", title: t("matlist.budgetTitle", "Limite de material da obra") }; E.render(); };
  EXT.modals.mlBudget = function () {
    var p = cur(), pr = priced(p), po = projOptions(p), fi = (S.fin || {})[po.pick] || {};
    return '<form id="mlBudForm" class="stack"><div>' + esc(t("matlist.budgetText", "Usa o total do mix mais barato como “Quanto quero gastar em material (limite)” da obra. O painel e a obra passam a comparar as notas com esse valor.")) + "</div>" +
      '<label class="field"><span>' + esc(t("matlist.project", "Obra")) + '</span><select id="mlbProj" required>' + po.html + "</select></label>" +
      '<label class="field"><span>' + esc(t("matlist.budgetValue", "Limite de material $")) + '</span><input type="number" id="mlbVal" step="0.01" min="0" inputmode="decimal" value="' + esc(Math.ceil(pr.mix)) + '"></label>' +
      (fi.materialBudget ? '<div class="muted small">' + esc(t("matlist.budgetNow", "Hoje: {v}", { v: m2(fi.materialBudget) })) + "</div>" : "") +
      (pr.noPrice ? '<div class="pill warn" style="white-space:normal">' + esc(t("matlist.budgetMissing", "{n} item(ns) sem preço não entram no total.", { n: pr.noPrice })) + "</div>" : "") +
      '<button class="btn" type="submit">' + esc(t("matlist.budgetSave", "Salvar limite")) + "</button></form>";
  };
  EXT.submit.mlBudForm = function () {
    var proj = $("#mlbProj").value, v = Number($("#mlbVal").value); if (!proj) { E.toast(t("matlist.pickProject", "Escolha a obra.")); return; }
    var fi = Object.assign({}, (S.fin || {})[proj] || {}, { materialBudget: v });
    S.modal = null; E.render();
    API.saveFinancials(proj, fi).then(function () { if (S.fin) S.fin[proj] = Object.assign({}, S.fin[proj] || {}, fi); if (E.refresh) E.refresh(); E.toast(t("matlist.budgetDone", "Limite de material da obra atualizado.")); })
      .catch(function (e) { E.toast((e && e.message) || t("proposals.errorSaving", "Erro ao salvar.")); });
  };

  // ── exportar ──
  function csvHead(money) {
    return money ? [t("matlist.cItem", "Item"), t("matlist.cQty", "Qtd"), t("matlist.cUnit", "Unidade"), t("matlist.cCat", "Categoria"), t("matlist.cStore", "Melhor loja"), t("matlist.cUnitPrice", "Preço un."), t("matlist.cTotal", "Total"), t("matlist.cLink", "Link"), t("matlist.cBought", "Comprado por")]
      : [t("matlist.cItem", "Item"), t("matlist.cQty", "Qtd"), t("matlist.cUnit", "Unidade"), t("matlist.cCat", "Categoria"), t("matlist.cLink", "Link"), t("matlist.cBought", "Comprado por")];
  }
  function fileBase(p) { return "material-" + String(p.number || "lista").replace(/[^\w-]+/g, "") ; }
  AC.mlCsv = function () { var p = cur(); if (!p) return; var money = canMoney(); E.csvDownload(fileBase(p) + ".csv", M.csvRows(priced(p), { money: money, head: csvHead(money), storeName: sname })); };
  AC.mlPrint = function () {
    var p = cur(); if (!p) return;
    var pr = priced(p), money = canMoney(), c = PR.coFor(p.companyId, p);
    var html = '<style>@page{size:letter;margin:.5in}#print-root{font-family:Inter,Arial,sans-serif;color:#1C2230;font-size:10pt}#print-root h1{font-size:16pt;margin:0}#print-root table{width:100%;border-collapse:collapse;margin-top:10px}' +
      '#print-root th{background:#1C2230;color:#fff;text-align:left;padding:6px 8px;font-size:9pt}#print-root td{padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top}#print-root .n{text-align:right;white-space:nowrap}#print-root .box{display:inline-block;width:12px;height:12px;border:1.5px solid #1C2230;border-radius:2px}</style>' +
      "<h1>" + esc(t("matlist.title", "Lista de material")) + " · " + esc(p.number || "") + "</h1><div>" + esc(c.brand || "") + " · " + esc((p.client || {}).address || "") + " · " + esc(E.fmtDate(E.todayISO())) + "</div>" +
      "<table><thead><tr><th></th><th>" + esc(t("matlist.cItem", "Item")) + '</th><th class="n">' + esc(t("matlist.cQty", "Qtd")) + "</th>" + (money ? "<th>" + esc(t("matlist.cStore", "Melhor loja")) + '</th><th class="n">' + esc(t("matlist.cUnitPrice", "Preço un.")) + '</th><th class="n">' + esc(t("matlist.cTotal", "Total")) + "</th>" : "") + "</tr></thead><tbody>" +
      pr.rows.map(function (r) { return "<tr><td>" + (r.bought ? "✓" : '<span class="box"></span>') + "</td><td>" + esc(r.item.name) + (r.item.spec ? " — " + esc(r.item.spec) : "") + '</td><td class="n">' + esc(r.item.qty + " " + (r.item.unit || "")) + "</td>" +
        (money ? "<td>" + (r.best ? esc(sname(r.best.store)) : "—") + '</td><td class="n">' + (r.best ? esc(m2(r.best.unit)) : "") + '</td><td class="n">' + (r.total != null ? esc(m2(r.total)) : "") + "</td>" : "") + "</tr>"; }).join("") +
      (money ? '<tr><td></td><td colspan="4"><b>' + esc(t("matlist.mix", "Mix mais barato")) + '</b></td><td class="n"><b>' + esc(m2(pr.mix)) + "</b></td></tr>" : "") + "</tbody></table>" +
      '<p style="font-size:8.5pt;color:#555">' + esc(t("matlist.printFoot", "Preços de referência (seus preços e promoções). Confirme no caixa.")) + "</p>";
    var root = $("#print-root"); if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.appendChild(root); }
    root.innerHTML = html; document.body.classList.add("printing"); document.body.style.background = "#fff";
    var old = document.title; document.title = fileBase(p);
    var done = function () { document.body.classList.remove("printing"); document.body.style.background = ""; document.title = old; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(function () { window.print(); setTimeout(done, 1500); }, 60);
  };

  // ── pedir cotação ao fornecedor (e-mail com a lista; no demo só a prévia) ──
  AC.mlQuote = function () { var p = cur(); if (!p) return; S.modal = { type: "mlQuote", title: t("matlist.quoteTitle", "Pedir cotação") }; E.render(); };
  function quoteBody(p, note) {
    var c = PR.coFor(p.companyId, p), items = (p.materialList.items || []).filter(function (i) { return !i.bought; });
    return M.quoteText(items.length ? items : p.materialList.items, { job: (p.client || {}).address || "", company: c.brand || "", note: note || "" });
  }
  EXT.modals.mlQuote = function () {
    var p = cur(), demo = API.mode === "demo";
    return '<form id="mlQuoteForm" class="stack"><label class="field"><span>' + esc(t("matlist.supplierEmail", "E-mail do fornecedor")) + '</span><input type="email" id="mlqTo" autocapitalize="none" inputmode="email" placeholder="sales@supplier.com"' + (demo ? "" : " required") + "></label>" +
      '<label class="field"><span>' + esc(t("matlist.quoteNote", "Recado (opcional)")) + '</span><input type="text" id="mlqNote" placeholder="' + esc(t("matlist.quoteNotePh", "ex.: entrega na obra até sexta")) + '"></label>' +
      '<div><span class="label">' + esc(t("matlist.preview", "Prévia do e-mail (vai em inglês, só quantidades — sem os seus preços)")) + '</span><pre class="ml-pre" lang="en" id="mlqPrev">' + esc(quoteBody(p, "")) + "</pre></div>" +
      (demo ? '<div class="pill warn" style="white-space:normal">' + esc(t("matlist.quoteDemo", "Modo demonstração: nada é enviado. Na conta conectada o fornecedor recebe este e-mail e responde direto para você.")) + "</div>" : "") +
      '<div class="row"><button class="btn" type="submit">' + esc(demo ? t("matlist.copy", "Copiar texto") : t("matlist.send", "Enviar pedido")) + "</button></div></form>";
  };
  EXT.input.push(function (el) { if (el.id !== "mlqNote") return false; var pv = $("#mlqPrev"), p = cur(); if (pv && p) pv.textContent = quoteBody(p, el.value); return true; });
  EXT.submit.mlQuoteForm = function () {
    var p = cur(), to = String($("#mlqTo").value || "").trim(), note = $("#mlqNote").value;
    if (API.mode === "demo") {
      var txt = quoteBody(p, note);
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { E.toast(t("matlist.copied", "Texto copiado. Modo demonstração: nada foi enviado.")); }, function () { E.toast(t("proposals.demoModeNothingWas", "Modo demonstração: nada foi enviado.")); });
      S.modal = null; E.render(); return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { E.toast(t("matlist.needEmail", "Coloque o e-mail do fornecedor.")); return; }
    S.modal = null; E.render(); E.toast(t("proposals.sending", "Enviando…"));
    API.services("quoteRequest", { id: p.id, to: to, note: note }).then(function (r) { E.toast(r && r.ok ? t("matlist.quoteSent", "Pedido de cotação enviado para {e}.", { e: to }) : PR.svcMsg(r)); });
  };

  E.matList = { panel: panel, rowBadge: rowBadge, banner: banner, afterSave: afterSave, priced: priced, build: build };
})();
