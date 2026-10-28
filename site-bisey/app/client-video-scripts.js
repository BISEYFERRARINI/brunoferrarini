/* Bisey — roteiro do "vídeo da empresa" (client-video.js): textos do vídeo e etapas de cada ramo, em PT / EN / ES.
   O vídeo sai no idioma do CLIENTE (não no idioma do app), por isso os textos ficam aqui e não no i18n.*.js.
   Cada ramo de trades.js tem uma entrada em TRADES com:
     name  { pt, en, es }            nome do ramo no vídeo
     value                            valor de contrato FICTÍCIO usado na cena do painel (sempre com o selo "Exemplo · números ilustrativos")
     steps [{ icon, pay?, pt:[título, frase], en:[…], es:[…] }]
       icon  check | money | box | doc | cal | tool | inspect | spark | shield | home | invoice | layers | paint | drop | truck | roof
       pay   "deposit" | "progress" | "final" → onde entra cada pagamento no painel (30 / 40 / 30)
   Regras do conteúdo: etapas reais de obra residencial nos EUA, frases curtas (lidas em ~3,5 s), nada que o app não possa
   comprovar (sem "licensed & insured", sem parceria com loja, sem logo de loja). tests/client-video.js confere a paridade. */
(function () {
  "use strict";
  var ACC = { pt: ["Proposta aprovada", "A proposta assinada fixa o escopo e o preço."], en: ["Estimate accepted", "Your signed proposal locks in the scope and the price."], es: ["Estimado aprobado", "La propuesta firmada fija el alcance y el precio."] };
  var DEP = { pt: ["Depósito", "O depósito garante a data de início e o material."], en: ["Deposit", "The deposit reserves your start date and the materials."], es: ["Depósito", "El depósito reserva la fecha de inicio y los materiales."] };
  var SCHED = { pt: ["Agendamento", "As datas da equipe são marcadas e confirmadas com você."], en: ["Scheduling", "Crew dates are set and confirmed with you."], es: ["Programación", "Se fijan las fechas del equipo y se confirman contigo."] };
  var FINAL_INSP = { pt: ["Inspeção final", "O inspetor aprova o trabalho terminado."], en: ["Final inspection", "The inspector signs off on the finished work."], es: ["Inspección final", "El inspector aprueba el trabajo terminado."] };
  var INV = { pt: ["Invoice final", "O invoice final vem depois que tudo é aprovado."], en: ["Final invoice", "The final invoice comes once everything is approved."], es: ["Factura final", "La factura final llega cuando todo está aprobado."] };
  var PERMIT_BLDG = { pt: ["Permit de construção", "Tiramos o permit de construção na prefeitura."], en: ["Building permit", "We file the building permit with your town."], es: ["Permiso de construcción", "Tramitamos el permiso de construcción con tu municipio."] };
  function s(icon, x, pay) { var o = { icon: icon, pt: x.pt, en: x.en, es: x.es }; if (pay) o.pay = pay; return o; }
  function L(pt, en, es) { return { pt: pt, en: en, es: es }; }
  var accepted = function () { return s("check", ACC); }, deposit = function () { return s("money", DEP, "deposit"); }, sched = function () { return s("cal", SCHED); },
    finalInsp = function () { return s("shield", FINAL_INSP); }, invoice = function () { return s("invoice", INV, "final"); };

  var TRADES = {
    electrical: { name: L("Elétrica", "Electrical", "Eléctrica"), value: 18500, steps: [
      accepted(), deposit(),
      s("box", L(["Lista de material encomendada", "Tudo da lista de material da sua obra é encomendado."], ["Material list ordered", "Everything on your job's material list is ordered."], ["Lista de materiales pedida", "Se pide todo lo de la lista de materiales de tu obra."])),
      s("doc", L(["Permit tirado", "Tiramos o permit elétrico na prefeitura da sua cidade."], ["Permit pulled", "We file the electrical permit with your town."], ["Permiso tramitado", "Tramitamos el permiso eléctrico con tu municipio."])),
      sched(),
      s("tool", L(["Rough-in", "Caixas, fiação e painel enquanto as paredes estão abertas."], ["Rough-in", "Boxes, wiring and panel work while the walls are open."], ["Rough-in (instalación preliminar)", "Cajas, cableado y panel mientras las paredes están abiertas."])),
      s("inspect", L(["Inspeção", "O inspetor elétrico da cidade confere o rough-in."], ["Inspection", "The town wiring inspector checks the rough-in."], ["Inspección", "El inspector eléctrico del municipio revisa el rough-in."]), "progress"),
      s("spark", L(["Acabamento (finish)", "Tomadas, interruptores, luminárias e identificação do painel."], ["Finish", "Devices, fixtures and the panel directory go in."], ["Acabado (finish)", "Tomacorrientes, interruptores, lámparas y rotulado del panel."])),
      finalInsp(),
      s("home", L(["Vistoria com você", "Percorremos a obra com você e testamos tudo."], ["Walkthrough", "We walk the job with you and test everything."], ["Recorrido final", "Recorremos la obra contigo y probamos todo."])),
      invoice()
    ] },
    hvac: { name: L("HVAC", "HVAC", "HVAC"), value: 16800, steps: [
      accepted(), deposit(),
      s("box", L(["Equipamento encomendado", "O equipamento e o material do seu sistema são encomendados."], ["Equipment ordered", "Your system's equipment and materials are ordered."], ["Equipo pedido", "Se piden el equipo y los materiales de tu sistema."])),
      s("doc", L(["Permit tirado", "Tiramos o permit mecânico na prefeitura."], ["Permit pulled", "We file the mechanical permit with your town."], ["Permiso tramitado", "Tramitamos el permiso mecánico con tu municipio."])),
      sched(),
      s("tool", L(["Rough-in", "Dutos, linhas de refrigerante e drenos são instalados."], ["Rough-in", "Ductwork, line sets and drain lines are run."], ["Rough-in (instalación preliminar)", "Se instalan ductos, líneas de refrigerante y drenajes."])),
      s("inspect", L(["Inspeção do rough-in", "O inspetor confere antes de fechar as paredes."], ["Rough inspection", "The inspector checks the work before walls close."], ["Inspección del rough-in", "El inspector revisa antes de cerrar las paredes."]), "progress"),
      s("box", L(["Equipamento instalado", "As unidades interna e externa são instaladas e conectadas."], ["Equipment set", "Indoor and outdoor units are set and connected."], ["Equipo instalado", "Se instalan y conectan las unidades interior y exterior."])),
      s("spark", L(["Partida e testes", "Carga de gás, fluxo de ar e controles são conferidos e ajustados."], ["Start-up & testing", "Charge, airflow and controls are checked and adjusted."], ["Arranque y pruebas", "Se revisan y ajustan la carga, el flujo de aire y los controles."])),
      finalInsp(),
      s("home", L(["Vistoria com você", "Mostramos o termostato, os filtros e a manutenção."], ["Walkthrough", "We show you the thermostat, filters and upkeep."], ["Recorrido final", "Te mostramos el termostato, los filtros y el mantenimiento."])),
      invoice()
    ] },
    plumbing: { name: L("Hidráulica (plumbing)", "Plumbing", "Plomería"), value: 14200, steps: [
      accepted(), deposit(),
      s("box", L(["Peças e material encomendados", "As peças escolhidas e a tubulação são encomendadas."], ["Fixtures & material ordered", "Your selected fixtures and the piping are ordered."], ["Accesorios y materiales pedidos", "Se piden los accesorios elegidos y la tubería."])),
      s("doc", L(["Permit tirado", "Tiramos o permit de plumbing (e de gás, se precisar)."], ["Permit pulled", "We file the plumbing permit (and gas, if needed)."], ["Permiso tramitado", "Tramitamos el permiso de plomería (y de gas, si hace falta)."])),
      sched(),
      s("tool", L(["Rough-in", "Água, esgoto e ventilação com as paredes abertas."], ["Rough-in", "Supply, drain and vent piping while walls are open."], ["Rough-in (instalación preliminar)", "Agua, drenaje y ventilación con las paredes abiertas."])),
      s("inspect", L(["Inspeção e teste do rough-in", "O inspetor confere a tubulação com teste de pressão."], ["Rough inspection & test", "The inspector checks the piping under a pressure test."], ["Inspección y prueba", "El inspector revisa la tubería con una prueba de presión."]), "progress"),
      s("drop", L(["Acabamento (finish)", "Louças, torneiras e aquecedor de água são instalados."], ["Finish", "Fixtures, faucets and the water heater are set."], ["Acabado (finish)", "Se instalan sanitarios, llaves y el calentador de agua."])),
      finalInsp(),
      s("home", L(["Vistoria com você", "Testamos cada peça com você e conferimos vazamentos."], ["Walkthrough", "We run every fixture with you and check for leaks."], ["Recorrido final", "Probamos cada accesorio contigo y revisamos fugas."])),
      invoice()
    ] },
    sprinkler: { name: L("Sprinkler (incêndio)", "Fire sprinkler", "Rociadores contra incendios"), value: 21500, steps: [
      accepted(), deposit(),
      s("doc", L(["Projeto e cálculos", "Layout dos sprinklers e cálculo hidráulico são preparados."], ["Design & calculations", "Sprinkler layout and hydraulic calculations are prepared."], ["Diseño y cálculos", "Se preparan el diseño y el cálculo hidráulico."])),
      s("doc", L(["Aprovação do Fire Department", "O projeto vai ao Fire Department para aprovação e permit."], ["Fire Department review", "Plans go to the Fire Department for approval and permit."], ["Revisión de Bomberos", "Los planos van a Bomberos para aprobación y permiso."])),
      s("box", L(["Material encomendado", "Tubos, bicos (heads) e o riser são encomendados."], ["Material ordered", "Pipe, heads and the riser are ordered."], ["Material pedido", "Se piden la tubería, los rociadores y el riser."])),
      sched(),
      s("tool", L(["Tubulação (rough-in)", "Tubos e bicos entram antes de fechar o forro."], ["Rough-in piping", "Pipe and heads go in before ceilings are closed."], ["Tubería (rough-in)", "Se instalan tubería y rociadores antes de cerrar los techos."])),
      s("inspect", L(["Teste de pressão e inspeção", "O sistema passa por teste de pressão e inspeção."], ["Pressure test & inspection", "The system is pressure-tested and inspected."], ["Prueba de presión e inspección", "El sistema se prueba a presión y se inspecciona."]), "progress"),
      s("spark", L(["Acabamento", "Bicos e canoplas são colocados depois do acabamento do forro."], ["Trim", "Heads and cover plates are set after ceilings are finished."], ["Acabado", "Se colocan rociadores y tapas después del acabado de techos."])),
      s("shield", L(["Teste final de aceitação", "Inspeção final e teste de vazão com o Fire Department."], ["Final acceptance test", "Final inspection and flow test with the Fire Department."], ["Prueba final de aceptación", "Inspección final y prueba de flujo con Bomberos."])),
      s("home", L(["Vistoria com você", "Mostramos a válvula principal e como o sistema funciona."], ["Walkthrough", "We show you the main valve and how the system works."], ["Recorrido final", "Te mostramos la válvula principal y cómo funciona el sistema."])),
      invoice()
    ] },
    gc: { name: L("Construção e reforma", "General contracting", "Construcción y remodelación"), value: 86000, steps: [
      accepted(), deposit(),
      s("box", L(["Escolhas e pedidos", "Itens demorados, como janelas e armários, são encomendados."], ["Selections & ordering", "Long-lead items like windows and cabinets are ordered."], ["Selecciones y pedidos", "Se piden los artículos que tardan, como ventanas y gabinetes."])),
      s("doc", PERMIT_BLDG),
      s("cal", L(["Agenda das equipes", "Cada equipe é agendada na ordem certa."], ["Scheduling the trades", "Each trade is scheduled in the right order."], ["Programación de los oficios", "Cada oficio se programa en el orden correcto."])),
      s("shield", L(["Proteção e demolição", "Sua casa é protegida e o que vai sair é demolido."], ["Protection & demolition", "Your home is protected; old work is removed."], ["Protección y demolición", "Se protege tu casa y se retira lo viejo."])),
      s("tool", L(["Estrutura (framing)", "Estrutura e paredes novas são levantadas."], ["Framing", "Structural work and new walls are built."], ["Estructura (framing)", "Se construyen la estructura y las paredes nuevas."])),
      s("inspect", L(["Rough-ins e inspeções", "Elétrica, hidráulica e HVAC; depois a inspeção de framing."], ["Rough-ins & inspections", "Electrical, plumbing and HVAC, then the framing inspection."], ["Rough-ins e inspecciones", "Electricidad, plomería y HVAC; luego la inspección de framing."]), "progress"),
      s("layers", L(["Isolamento e drywall", "O isolamento é inspecionado e as paredes são fechadas."], ["Insulation & drywall", "Insulation is inspected, then walls are closed."], ["Aislamiento y drywall", "Se inspecciona el aislamiento y se cierran las paredes."])),
      s("spark", L(["Acabamentos", "Armários, rodapés, piso, pintura e peças."], ["Finishes", "Cabinets, trim, flooring, paint and fixtures."], ["Acabados", "Gabinetes, molduras, pisos, pintura y accesorios."])),
      s("home", L(["Inspeção final e vistoria", "Aprovação final e lista de pendências revisada com você."], ["Final inspection & walkthrough", "Final sign-off, then a punch-list walkthrough with you."], ["Inspección final y recorrido", "Aprobación final y recorrido de pendientes contigo."])),
      invoice()
    ] },
    drywall: { name: L("Drywall", "Drywall", "Drywall"), value: 9800, steps: [
      accepted(), deposit(),
      s("truck", L(["Material entregue", "Placas, fita, massa e cantoneiras chegam na obra."], ["Material delivered", "Board, tape, compound and corner bead arrive on site."], ["Material entregado", "Llegan a la obra placas, cinta, compuesto y esquineros."])),
      s("inspect", L(["Inspeções conferidas", "Conferimos que as inspeções de framing e isolamento passaram."], ["Inspections checked", "We confirm framing and insulation inspections passed."], ["Inspecciones verificadas", "Confirmamos que pasaron las inspecciones de framing y aislamiento."])),
      sched(),
      s("layers", L(["Instalação das placas", "As placas são instaladas e parafusadas conforme o código."], ["Hanging", "Sheets are hung and fastened to code."], ["Colocación de placas", "Se cuelgan y atornillan las placas según el código."]), "progress"),
      s("tool", L(["Fita e massa", "Fita e demãos de massa, com tempo de secagem entre elas."], ["Taping & compound", "Tape and coats of compound, with drying time between."], ["Cinta y compuesto", "Cinta y capas de compuesto, con tiempo de secado entre ellas."])),
      s("spark", L(["Lixa e acabamento", "Lixado liso no nível de acabamento combinado."], ["Sanding & finish", "Sanded smooth to the agreed finish level."], ["Lijado y acabado", "Lijado liso al nivel de acabado acordado."])),
      s("home", L(["Vistoria com você", "Conferimos as paredes com você sob boa luz."], ["Walkthrough", "We check the walls with you under good light."], ["Recorrido final", "Revisamos las paredes contigo con buena luz."])),
      invoice()
    ] },
    painting: { name: L("Pintura", "Painting", "Pintura"), value: 7400, steps: [
      accepted(), deposit(),
      s("paint", L(["Cores e tinta encomendadas", "Você confirma as cores; tinta e material são encomendados."], ["Colors & paint ordered", "You confirm colors; paint and supplies are ordered."], ["Colores y pintura pedidos", "Confirmas los colores; se piden la pintura y los materiales."])),
      sched(),
      s("inspect", L(["Verificação de chumbo", "Casas de antes de 1978 seguem práticas seguras contra chumbo."], ["Lead-safe check", "Homes built before 1978 follow lead-safe work practices."], ["Revisión de plomo", "Las casas de antes de 1978 siguen prácticas seguras contra el plomo."])),
      s("shield", L(["Proteção e preparo", "Piso e móveis são cobertos; as superfícies são reparadas."], ["Protection & prep", "Floors and furniture are covered; surfaces are patched."], ["Protección y preparación", "Se cubren pisos y muebles; se reparan las superficies."])),
      s("layers", L(["Primer (fundo)", "Reparos e partes sem tinta recebem primer."], ["Primer", "Repairs and bare spots are primed."], ["Imprimación (primer)", "Se aplica primer en reparaciones y zonas sin pintura."])),
      s("paint", L(["Primeira demão", "A primeira demão completa é aplicada."], ["First coat", "The first full coat goes on."], ["Primera mano", "Se aplica la primera mano completa."]), "progress"),
      s("paint", L(["Segunda demão", "Segunda demão para uma cor uniforme e durável."], ["Second coat", "A second coat for even, lasting color."], ["Segunda mano", "Segunda mano para un color parejo y duradero."])),
      s("home", L(["Vistoria e retoques", "Revisamos cada cômodo com você e fazemos retoques."], ["Walkthrough & touch-ups", "We review every room with you and touch up."], ["Recorrido y retoques", "Revisamos cada cuarto contigo y retocamos."])),
      invoice()
    ] },
    flooring: { name: L("Piso", "Flooring", "Pisos"), value: 12600, steps: [
      accepted(), deposit(),
      s("box", L(["Material encomendado", "Piso, manta (underlayment) e acabamentos são encomendados."], ["Material ordered", "Flooring, underlayment and trim are ordered."], ["Material pedido", "Se piden el piso, el underlayment y las molduras."])),
      sched(),
      s("truck", L(["Entrega e aclimatação", "O piso de madeira descansa na sua casa antes de instalar."], ["Delivery & acclimation", "Wood flooring rests in your home before install."], ["Entrega y aclimatación", "El piso de madera reposa en tu casa antes de instalarse."])),
      s("tool", L(["Remoção e preparo", "O piso antigo sai; o contrapiso é conferido e nivelado."], ["Removal & prep", "Old flooring comes out; the subfloor is checked and leveled."], ["Retiro y preparación", "Se retira el piso viejo; se revisa y nivela el contrapiso."])),
      s("drop", L(["Teste de umidade", "A umidade do contrapiso ou da laje é medida e anotada."], ["Moisture test", "Subfloor or slab moisture is tested and recorded."], ["Prueba de humedad", "Se mide y anota la humedad del contrapiso o la losa."])),
      s("layers", L(["Instalação", "O piso é instalado conforme o fabricante."], ["Installation", "Flooring is installed to the manufacturer's specs."], ["Instalación", "El piso se instala según el fabricante."]), "progress"),
      s("spark", L(["Rodapés e transições", "Rodapés, cordões e transições são colocados."], ["Trim & transitions", "Baseboard, shoe molding and transitions go in."], ["Molduras y transiciones", "Se colocan zócalos, molduras y transiciones."])),
      s("home", L(["Vistoria com você", "Revisamos o piso com você e limpamos tudo."], ["Walkthrough", "We review the floors with you and clean up."], ["Recorrido final", "Revisamos los pisos contigo y limpiamos."])),
      invoice()
    ] },
    siding: { name: L("Siding", "Siding", "Revestimiento exterior (siding)"), value: 32500, steps: [
      accepted(), deposit(),
      s("box", L(["Material encomendado", "Siding, acabamentos e as cores escolhidas são encomendados."], ["Material ordered", "Siding, trim and your chosen colors are ordered."], ["Material pedido", "Se piden el siding, las molduras y los colores elegidos."])),
      s("doc", PERMIT_BLDG),
      sched(),
      s("tool", L(["Remoção do siding antigo", "O siding antigo sai; o compensado (sheathing) é conferido."], ["Removal", "Old siding comes off; the sheathing is inspected."], ["Retiro del siding viejo", "Se retira el siding viejo; se revisa el sheathing."])),
      s("shield", L(["House wrap e flashing", "Barreira contra água e flashing em janelas e portas."], ["House wrap & flashing", "Weather barrier and flashing at windows and doors."], ["Barrera y tapajuntas", "Barrera contra el agua y tapajuntas en ventanas y puertas."]), "progress"),
      s("layers", L(["Instalação do siding", "O siding novo é instalado conforme o fabricante."], ["Siding installation", "New siding is installed to the manufacturer's specs."], ["Instalación del siding", "El siding nuevo se instala según el fabricante."])),
      s("spark", L(["Acabamentos e vedação", "Cantos, molduras, soffit e fascia são acabados e vedados."], ["Trim, soffit & caulking", "Corners, trim, soffit and fascia are finished and sealed."], ["Molduras, plafón y sellado", "Se terminan y sellan esquinas, molduras, plafón y fascia."])),
      s("inspect", L(["Inspeção final e limpeza", "Inspeção final, varredura de pregos e retirada do entulho."], ["Final inspection & cleanup", "Final inspection, nail sweep and debris removal."], ["Inspección final y limpieza", "Inspección final, barrido de clavos y retiro de escombros."])),
      s("home", L(["Vistoria com você", "Damos a volta na casa com você."], ["Walkthrough", "We walk around the house with you."], ["Recorrido final", "Recorremos la casa por fuera contigo."])),
      invoice()
    ] },
    roofing: { name: L("Telhado", "Roofing", "Techos"), value: 19800, steps: [
      accepted(), deposit(),
      s("truck", L(["Material entregue", "Telhas, manta e flashing são entregues."], ["Material delivered", "Shingles, underlayment and flashing are delivered."], ["Material entregado", "Se entregan tejas, membrana y tapajuntas."])),
      s("doc", L(["Permit tirado", "Tiramos o permit do telhado na prefeitura."], ["Permit pulled", "We file the re-roof permit with your town."], ["Permiso tramitado", "Tramitamos el permiso del techo con tu municipio."])),
      s("cal", L(["Agendamento", "As datas são marcadas de acordo com a previsão do tempo."], ["Scheduling", "Dates are set around the weather forecast."], ["Programación", "Las fechas se fijan según el pronóstico del tiempo."])),
      s("tool", L(["Remoção (tear-off)", "O telhado antigo sai e o deck é conferido."], ["Tear-off & deck check", "Old roofing comes off; the deck is checked."], ["Retiro (tear-off)", "Se retira el techo viejo y se revisa la base (deck)."])),
      s("layers", L(["Reparo do deck", "O compensado danificado é trocado se precisar."], ["Deck repairs", "Damaged sheathing is replaced as needed."], ["Reparación del deck", "Se cambia la base dañada si hace falta."])),
      s("shield", L(["Ice & water e manta", "Ice & water nos beirais e águas-furtadas, depois a manta."], ["Ice & water + underlayment", "Ice & water shield at eaves and valleys, then underlayment."], ["Ice & water y membrana", "Ice & water en aleros y limahoyas, luego la membrana."]), "progress"),
      s("roof", L(["Telhas e flashing", "Telhas, flashing, cumeeira e ventilação são instalados."], ["Shingles & flashing", "Shingles, flashing, ridge and vents are installed."], ["Tejas y tapajuntas", "Se instalan tejas, tapajuntas, cumbrera y ventilación."])),
      s("spark", L(["Limpeza com ímã", "O entulho sai e o quintal é varrido com ímã."], ["Cleanup & nail sweep", "Debris is hauled away and the yard is swept for nails."], ["Limpieza y barrido de clavos", "Se retiran escombros y se barre el patio con imán."])),
      finalInsp(),
      invoice()
    ] },
    foundation: { name: L("Fundação e escavação", "Foundation & excavation", "Cimientos y excavación"), value: 42000, steps: [
      accepted(), deposit(),
      s("doc", L(["Permit e Dig Safe", "Permit tirado; redes subterrâneas marcadas (811)."], ["Permit & Dig Safe", "Permit filed; underground utilities marked (811)."], ["Permiso y Dig Safe", "Permiso tramitado; servicios subterráneos marcados (811)."])),
      sched(),
      s("tool", L(["Marcação e escavação", "Os cantos são marcados pela planta do terreno; depois escavamos."], ["Layout & excavation", "Corners are staked from the plot plan; then we dig."], ["Trazado y excavación", "Se marcan las esquinas según el plano; luego excavamos."])),
      s("inspect", L(["Inspeção das sapatas", "Formas e ferragens são inspecionadas antes da concretagem."], ["Footing inspection", "Forms and rebar are inspected before the pour."], ["Inspección de zapatas", "Se inspeccionan cimbras y varillas antes del colado."])),
      s("layers", L(["Sapatas concretadas", "As sapatas são concretadas e curam."], ["Footings poured", "Footings are poured and left to cure."], ["Zapatas coladas", "Se cuelan las zapatas y se dejan curar."]), "progress"),
      s("layers", L(["Paredes da fundação", "As formas das paredes são montadas e concretadas."], ["Foundation walls", "Wall forms are set and concrete is poured."], ["Muros de cimentación", "Se arman las cimbras de los muros y se cuela el concreto."])),
      s("drop", L(["Impermeabilização e drenagem", "Impermeabilização e dreno perimetral são instalados."], ["Waterproofing & drainage", "Damp-proofing and the perimeter drain go in."], ["Impermeabilización y drenaje", "Se instalan impermeabilización y drenaje perimetral."])),
      s("inspect", L(["Inspeção e reaterro", "Dreno e paredes são inspecionados e depois reaterrados."], ["Inspection & backfill", "Drain and walls are inspected, then backfilled."], ["Inspección y relleno", "Se inspeccionan drenaje y muros; luego se rellena."])),
      s("spark", L(["Nivelamento e as-built", "Terreno nivelado; o as-built da fundação vai à prefeitura."], ["Grading & as-built", "Rough grading; the foundation as-built goes to the town."], ["Nivelación y as-built", "Terreno nivelado; el as-built va al municipio."])),
      invoice()
    ] }
  };

  // textos fixos do vídeo ({trade}, {i}, {n} são trocados na hora)
  var UI = {
    pt: {
      tagline: "Como trabalhamos, passo a passo", approved1: "Você aprovou a proposta.", approved2: "Veja o que acontece agora.",
      stepsHead: "{trade}: passo a passo", stepOf: "Etapa {i} de {n}",
      c1h: "Sua proposta, online", c1s: "Você revisa, baixa o PDF e aceita pela internet.",
      c2h: "Cada etapa no calendário", c2s: "As datas são planejadas e combinadas com você.",
      c3h: "Atualizações da obra", c3s: "Um relatório do que foi feito na sua obra.",
      c4h: "Invoices e pagamentos claros", c4s: "Cada pagamento ligado a uma etapa do trabalho.",
      dashTitle: "Painel", dashSub: "Sua obra acompanhada de 0% a 100%", example: "Exemplo · números ilustrativos", sampleJob: "Obra de exemplo",
      contract: "Valor do contrato", deposit: "Depósito recebido", progressPay: "Pagamentos por etapa", stages: "Etapas concluídas", jobProgress: "Progresso da obra",
      balance: "Saldo a pagar", now: "Agora: {s}", done: "Obra concluída", ofContract: "{p}% do contrato",
      nav: ["Painel", "Agenda", "Projetos", "Propostas", "Invoices"],
      proposal: "Proposta", accepted: "Proposta aceita", acceptedBy: "Aceita por você", thanks: "Obrigado! Vamos entrar em contato para agendar.", pdf: "Baixar PDF",
      month: "Maio 2026", week: ["D", "S", "T", "Q", "Q", "S", "S"], report: "Relatório diário da obra", completedToday: "Concluído hoje",
      invoices: "Invoices", depositRow: "Depósito", progressRow: "Pagamento por etapa", finalRow: "Pagamento final", paid: "Pago", due: "A pagar",
      closing1: "Gestão organizada, passo a passo.", closing2: "Da proposta ao invoice final.", watch: "Veja como trabalhamos", wordmarkFallback: "Sua empresa"
    },
    en: {
      tagline: "How we work, step by step", approved1: "You approved the estimate.", approved2: "Here's what happens next.",
      stepsHead: "{trade}: step by step", stepOf: "Step {i} of {n}",
      c1h: "Your proposal, online", c1s: "Review it, download the PDF and accept online.",
      c2h: "Every phase on the calendar", c2s: "Dates are planned and agreed with you.",
      c3h: "Progress updates", c3s: "A report of what was done on your job.",
      c4h: "Clear invoices and payments", c4s: "Each payment is tied to a stage of the work.",
      dashTitle: "Dashboard", dashSub: "Your job, tracked from 0% to 100%", example: "Example · illustrative numbers", sampleJob: "Sample job",
      contract: "Contract value", deposit: "Deposit received", progressPay: "Progress payments", stages: "Stages complete", jobProgress: "Job progress",
      balance: "Balance due", now: "Now: {s}", done: "Job complete", ofContract: "{p}% of contract",
      nav: ["Dashboard", "Calendar", "Projects", "Estimates", "Invoices"],
      proposal: "Proposal", accepted: "Proposal accepted", acceptedBy: "Accepted by you", thanks: "Thank you! We will contact you to schedule the work.", pdf: "Download PDF",
      month: "May 2026", week: ["S", "M", "T", "W", "T", "F", "S"], report: "Daily job report", completedToday: "Completed today",
      invoices: "Invoices", depositRow: "Deposit", progressRow: "Progress payment", finalRow: "Final payment", paid: "Paid", due: "Due",
      closing1: "Organized management, step by step.", closing2: "From the estimate to the final invoice.", watch: "Watch how we work", wordmarkFallback: "Your company"
    },
    es: {
      tagline: "Cómo trabajamos, paso a paso", approved1: "Aprobaste el estimado.", approved2: "Esto es lo que sigue.",
      stepsHead: "{trade}: paso a paso", stepOf: "Paso {i} de {n}",
      c1h: "Tu propuesta, en línea", c1s: "La revisas, descargas el PDF y la aceptas en línea.",
      c2h: "Cada etapa en el calendario", c2s: "Las fechas se planean y se acuerdan contigo.",
      c3h: "Avances de la obra", c3s: "Un reporte de lo que se hizo en tu obra.",
      c4h: "Facturas y pagos claros", c4s: "Cada pago va ligado a una etapa del trabajo.",
      dashTitle: "Panel", dashSub: "Tu obra, de 0% a 100%", example: "Ejemplo · números ilustrativos", sampleJob: "Obra de ejemplo",
      contract: "Valor del contrato", deposit: "Depósito recibido", progressPay: "Pagos por avance", stages: "Etapas completadas", jobProgress: "Avance de la obra",
      balance: "Saldo pendiente", now: "Ahora: {s}", done: "Obra terminada", ofContract: "{p}% del contrato",
      nav: ["Panel", "Calendario", "Proyectos", "Estimados", "Facturas"],
      proposal: "Propuesta", accepted: "Propuesta aceptada", acceptedBy: "Aceptada por ti", thanks: "¡Gracias! Te contactaremos para programar el trabajo.", pdf: "Descargar PDF",
      month: "Mayo 2026", week: ["D", "L", "M", "M", "J", "V", "S"], report: "Reporte diario de la obra", completedToday: "Completado hoy",
      invoices: "Facturas", depositRow: "Depósito", progressRow: "Pago por avance", finalRow: "Pago final", paid: "Pagado", due: "Pendiente",
      closing1: "Gestión organizada, paso a paso.", closing2: "Del estimado a la factura final.", watch: "Mira cómo trabajamos", wordmarkFallback: "Tu empresa"
    }
  };

  // empresa de demonstração (rota ?cv=demo): nome fictício neutro, logo gerado (nenhuma marca real)
  var DEMO = { name: "Northfield Demo Co.", phone: "(555) 010-0199", site: "example.com" };

  window.BiseyVideoScripts = { TRADES: TRADES, UI: UI, DEMO: DEMO, LANGS: ["pt", "en", "es"] };
})();
