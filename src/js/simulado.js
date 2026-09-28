// Simulado: timed exam with booklet, answer sheet and essay sheet. Corrected only on delivery.

const OFFICIAL = () => EXAMS.filter((e) => e.official);
const FULL_EXAMS = () => EXAMS.filter((e) => (e.official || e.inedita) && e.questions.length === 20);
const TIME_OPTIONS = [
  { v: 180, label: "3 horas (tempo da prova)" },
  { v: 150, label: "2 h 30 min" },
  { v: 120, label: "2 horas" },
  { v: 0, label: "Sem limite de tempo" },
];

// Time spent on the booklet vs the essay sheet (pauses excluded), for the pacing summary.
function accountTab(sim, now = Date.now()) {
  sim.tabTime = sim.tabTime || { booklet: 0, essay: 0 };
  if (sim.tabSince && !sim.pausedAt) sim.tabTime[sim.tab === "essay" ? "essay" : "booklet"] += now - sim.tabSince;
  sim.tabSince = now;
}
function switchTab(sim, tab) {
  accountTab(sim);
  sim.tab = tab;
  Store.save();
}

function simElapsed(sim, now = Date.now()) {
  return now - sim.startedAt - sim.pausedMs - (sim.pausedAt ? now - sim.pausedAt : 0);
}
function simRemaining(sim, now = Date.now()) {
  return sim.limitMs ? sim.limitMs - simElapsed(sim, now) : null;
}

function buildFullSim(examId) {
  const e = EXAM[examId];
  return { kind: "full", title: e.title, ptExam: e.id, qids: e.questions.map((q) => q.id), essayFrom: e.redacao ? { examId: e.id } : null };
}
function buildMixedSim({ weak, fresh }) {
  const exams = FULL_EXAMS().filter((e) => e.questions.some((q) => q.subject === "portugues"));
  const donePt = (e) => e.questions.filter((q) => q.subject === "portugues").some((q) => lastAttempt(q.id));
  const pool = fresh && exams.some((e) => !donePt(e)) ? exams.filter((e) => !donePt(e)) : exams;
  const ptExam = pool[Math.floor(Math.random() * pool.length)];
  const pt = ptExam.questions.filter((q) => q.subject === "portugues").map((q) => q.id);
  // Only official exams: the CP2 Digital sets were adapted and have no official key.
  let mat = ALL_Q.filter((q) => q.subject === "matematica" && !q.annulled && (EXAM[q.examId].official || EXAM[q.examId].inedita));
  if (fresh) {
    const unseen = mat.filter((q) => !lastAttempt(q.id));
    if (unseen.length >= 10) mat = unseen;
  }
  let picked = [];
  if (weak) {
    const st = computeStats();
    const weakIds = weakTopics(st).filter((t) => t.id.startsWith("mat.")).slice(0, 4).map((t) => t.id);
    const w = shuffle(mat.filter((q) => q.topics.some((t) => weakIds.includes(t))));
    picked = w.slice(0, 6);
  }
  // Fill up to 10 trying to vary topics.
  const used = new Set(picked.map((q) => q.topics[0]));
  for (const q of shuffle(mat)) {
    if (picked.length >= 10) break;
    if (picked.includes(q)) continue;
    if (used.has(q.topics[0]) && mat.length > 20 && picked.length < 8) continue;
    picked.push(q);
    used.add(q.topics[0]);
  }
  for (const q of shuffle(mat)) {
    if (picked.length >= 10) break;
    if (!picked.includes(q)) picked.push(q);
  }
  return {
    kind: "mixed",
    title: `Simulado misto (Português da ${ptExam.title})`,
    ptExam: ptExam.id,
    qids: [...pt, ...picked.map((q) => q.id)],
    essayFrom: ptExam.redacao ? { examId: ptExam.id } : null,
  };
}

function startSim(spec, limitMin, includeEssay) {
  S().activeSim = {
    id: uid(),
    ...spec,
    includeEssay: includeEssay && !!spec.essayFrom,
    startedAt: Date.now(),
    limitMs: limitMin ? limitMin * 60000 : 0,
    pausedMs: 0,
    pausedAt: null,
    answers: {},
    flags: {},
    essay: { draft: "", final: "" },
    warned: {},
    tab: "booklet",
    tabTime: { booklet: 0, essay: 0 },
    tabSince: Date.now(),
  };
  Store.save(true);
  go("#/simulado/prova");
}

function viewSimSetup() {
  const act = S().activeSim;
  const history = S().sims.filter((s) => s.finishedAt).slice().reverse();
  const lastByExam = {};
  for (const s of S().sims) if (s.finishedAt && s.kind === "full") lastByExam[s.ptExam] = s;
  main().innerHTML = `<div class="page page-narrow">
    <h1>Simulado</h1>
    <p class="lead">Faça a prova como no dia: cronômetro correndo, cartão-resposta e folha de redação. A correção só aparece quando você entregar.</p>
    ${act ? `<section class="sheet" style="border-color:var(--pen)"><h2>Você tem um simulado em andamento</h2><p>${esc(act.title)}, começado em ${fmt.dateTime(act.startedAt)}.</p>
      <div class="row"><a class="btn btn-pen" href="#/simulado/prova">Continuar</a><button class="btn btn-danger" id="discard">Descartar este simulado</button></div></section>` : ""}
    <section class="sheet">
      <h2>1. Escolha a prova</h2>
      <div class="choice-list">
        <label class="choice"><input type="radio" name="kind" value="full" checked><span><b>Uma prova completa</b><br><span class="muted">As 20 questões e a redação de uma prova anterior do CPII, exatamente como caíram, ou de uma prova inédita, com questões novas no mesmo formato.</span>
          <select id="exam-pick" style="margin-top:8px;display:block" aria-describedby="exam-notes">${[["Provas anteriores do CPII", OFFICIAL()], ["Provas inéditas (questões novas)", FULL_EXAMS().filter((e) => e.inedita)]].filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${g}">${l.map((e) => `<option value="${e.id}">${esc(e.title)}${lastByExam[e.id] ? ` (feita em ${fmt.date(lastByExam[e.id].finishedAt)}: ${lastByExam[e.id].score.obj}/20)` : ""}</option>`).join("")}</optgroup>`).join("")}</select></span></label>
        <div id="exam-notes"></div>
        <label class="choice"><input type="radio" name="kind" value="mixed"><span><b>Simulado misto</b><br><span class="muted">Português, textos e redação de uma prova sorteada, mais 10 questões de Matemática sorteadas entre todas as provas.</span>
          <span class="stack" style="display:block;margin-top:8px"><label class="chk"><input type="checkbox" id="mx-fresh" checked> Evitar questões que já resolvi</label><br><label class="chk"><input type="checkbox" id="mx-weak"> Puxar mais questões dos meus assuntos fracos</label></span></span></label>
      </div>
      <h2 style="margin-top:24px">2. Tempo e redação</h2>
      <div class="filters"><label class="field">Tempo<select id="time">${TIME_OPTIONS.map((t) => `<option value="${t.v}">${t.label}</option>`).join("")}</select></label>
        <label class="chk"><input type="checkbox" id="with-essay" checked> Incluir a redação (recomendado: na prova ela divide o mesmo tempo)</label></div>
      <h2 style="margin-top:24px">3. Regras da prova</h2>
      <ul>${(INFO.rules || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      <div class="row" style="margin-top:12px"><button class="btn btn-primary btn-lg" id="start" ${act ? "disabled" : ""}>Começar simulado</button>${act ? `<span class="muted">Termine ou descarte o simulado em andamento primeiro.</span>` : ""}</div>
    </section>
    ${history.length ? `<section class="sheet"><h2>Simulados feitos</h2><div class="table-scroll"><table class="tbl"><thead><tr><th>Data</th><th>Prova</th><th class="r">Objetiva</th><th class="r">Redação</th><th class="r">Total</th><th class="r">Tempo</th><th></th></tr></thead><tbody>
      ${history.map((s) => `<tr><td>${fmt.date(s.finishedAt)}</td><td>${esc(s.title)}</td><td class="r">${s.score.obj}/20</td><td class="r">${s.essayScore != null ? fmt.num(s.essayScore, 2) : "–"}</td><td class="r">${s.essayScore != null ? fmt.num(s.score.obj + s.essayScore, 2) + "/30" : "–"}</td><td class="r">${fmt.dur(s.usedMs)}</td><td><a href="#/simulado/resultado/${s.id}">Ver</a></td></tr>`).join("")}
      </tbody></table></div></section>` : ""}
  </div>`;
  const showNotes = () => {
    const e = EXAM[$("#exam-pick").value];
    const el = $("#exam-notes");
    if (el && e) el.innerHTML = examNotesHTML(e);
  };
  $("#exam-pick").addEventListener("change", showNotes);
  showNotes();
  $("#discard")?.addEventListener("click", async () => {
    if (await confirmBox("Descartar o simulado?", "As respostas marcadas e a redação deste simulado serão apagadas.", "Descartar", "btn-danger")) {
      S().activeSim = null;
      Store.save(true);
      viewSimSetup();
    }
  });
  $("#start").addEventListener("click", () => {
    const kind = $('input[name="kind"]:checked').value;
    const spec = kind === "full" ? buildFullSim($("#exam-pick").value) : buildMixedSim({ weak: $("#mx-weak").checked, fresh: $("#mx-fresh").checked });
    startSim(spec, +$("#time").value, $("#with-essay").checked);
  });
}

// ---------- running exam ----------
function simEssayContext(sim) {
  if (!sim.essayFrom) return null;
  const e = EXAM[sim.essayFrom.examId];
  return { redacao: e.redacao, exam: e, sourceText: (e.texts || []).map((t) => (t.lines || []).map(stripTags).join(" ")).join("\n") };
}

function bookletHTML(sim) {
  const ptExam = EXAM[sim.ptExam];
  const shown = new Set();
  let out = "";
  let part = null;
  sim.qids.forEach((qid, i) => {
    const q = Q[qid];
    const num = i + 1;
    if (q.subject !== part) {
      if (part === "portugues" && sim.includeEssay) out += essayProposalBlock(sim);
      part = q.subject;
      out += `<h2 class="part-title">${q.subject === "portugues" ? "Língua Portuguesa" : "Matemática"}</h2>`;
    }
    const exam = EXAM[q.examId];
    if (q.subject === "portugues" && exam.id === ptExam.id) {
      for (const tid of q.texts || []) {
        if (shown.has(tid) || !exam.textById[tid]) continue;
        // also show earlier texts in exam order that were not shown yet
        for (const t of exam.texts) {
          if (shown.has(t.id)) continue;
          out += textHTML(exam, t);
          shown.add(t.id);
          if (t.id === tid) break;
        }
      }
    }
    const origin = sim.kind === "mixed" && q.subject === "matematica" ? `<span class="chip">${esc(exam.title)}, questão ${q.n}</span>` : "";
    out += `<div class="bq" id="bq-${num}" data-q="${qid}"><div class="bq-h"><b>Questão ${num}</b>${origin}
      <button class="btn btn-sm btn-quiet" data-flag="${qid}" aria-pressed="${!!sim.flags[qid]}">${sim.flags[qid] ? "★ Dúvida" : "☆ Marcar dúvida"}</button></div>
      <div class="qstem">${q.stem}</div>${optionsHTML(q, { selected: sim.answers[qid] || null })}</div>`;
  });
  if (part === "portugues" && sim.includeEssay) out += essayProposalBlock(sim);
  return `<div class="booklet">${out}</div>`;
}
function essayProposalBlock(sim) {
  const ctx = simEssayContext(sim);
  if (!ctx) return "";
  return `<h2 class="part-title">Redação</h2><div class="proposal">${ctx.redacao.prompt_html}
    ${ctx.redacao.requirements && ctx.redacao.requirements.length ? `<h3>${ruleListTitle(ctx.redacao.requirements)}</h3>${ruleListHTML(ctx.redacao.requirements)}` : ""}
    </div><p><button class="btn btn-pen" data-go-essay>Ir para a folha de redação</button></p>`;
}

function answerCardHTML(sim) {
  const rows = sim.qids
    .map((qid, i) => {
      const n = i + 1;
      const sep = i > 0 && Q[qid].subject !== Q[sim.qids[i - 1]].subject ? `<div class="ac-sep"></div>` : "";
      return `${sep}<div class="ac-row" data-q="${qid}"><span class="qn" data-jump="${n}" title="Ir para a questão ${n}">${n}</span>${LETTERS.map(
        (L) => `<button class="bubble ${sim.answers[qid] === L ? "sel" : ""}" data-ac="${L}" aria-label="Questão ${n}, alternativa ${L}" aria-pressed="${sim.answers[qid] === L}">${L}</button>`
      ).join("")}<button class="flag ${sim.flags[qid] ? "on" : ""}" data-flag="${qid}" title="Marcar dúvida" aria-label="Marcar dúvida na questão ${n}">${sim.flags[qid] ? "★" : "☆"}</button></div>`;
    })
    .join("");
  const answered = sim.qids.filter((q) => sim.answers[q]).length;
  const lines = sim.includeEssay ? countEssayLines(sim.essay.final) : null;
  return `<div class="sheet answer-card"><h3>Cartão-resposta</h3>${rows}
    <div class="ac-meta" id="ac-meta">${answered} de ${sim.qids.length} marcadas${lines != null ? `. Redação: ${plural(lines, "linha", "linhas")} na folha definitiva` : ""}.</div></div>`;
}

function viewSimRun() {
  const sim = S().activeSim;
  if (!sim) return go("#/simulado");
  onCleanup(() => document.body.classList.remove("has-simbar"));
  document.body.classList.add("has-simbar");
  const paused = !!sim.pausedAt;
  const ctx = simEssayContext(sim);
  let content;
  if (paused) {
    content = `<section class="sheet empty"><h2>Simulado pausado</h2><p>O cronômetro está parado e a prova fica escondida enquanto isso.</p><button class="btn btn-primary" id="resume">Continuar a prova</button></section>`;
  } else if (sim.tab === "essay" && sim.includeEssay && ctx) {
    content = `<div class="stack">
      <details class="sheet" open><summary><b>Proposta de redação</b></summary><div class="proposal" style="margin-top:12px">${ctx.redacao.prompt_html}</div></details>
      <section class="sheet"><h2>Rascunho</h2><p class="muted small">O rascunho não é corrigido. Use para planejar e depois passe a limpo na folha definitiva.</p>
        <textarea class="rascunho" id="draft" spellcheck="false" placeholder="Anote a tese, os argumentos e um esboço dos parágrafos.">${esc(sim.essay.draft)}</textarea>
        <div class="row" style="margin-top:10px"><button class="btn" id="copy-draft">Passar o rascunho a limpo na folha definitiva</button></div></section>
      <section class="sheet"><h2>Folha de textos definitivos</h2>${folhaHTML("final", sim.essay.final)}</section></div>`;
  } else {
    content = bookletHTML(sim);
  }
  main().innerHTML = `<div class="page"><div class="sim-layout"><div class="${sim.tab === "essay" || paused ? "" : "sheet"}" id="sim-main">${content}</div>
    <div class="card-panel">${paused ? "" : answerCardHTML(sim)}</div></div></div>`;

  const root = main();
  if (paused) {
    $("#resume").addEventListener("click", () => {
      sim.pausedMs += Date.now() - sim.pausedAt;
      sim.pausedAt = null;
      sim.tabSince = Date.now();
      Store.save(true);
      viewSimRun();
    });
    return;
  }
  bindReader(root);
  bindLineRefs(root);
  $$(".bq", root).forEach((el) => {
    const q = Q[el.dataset.q];
    linkLineRefs($(".qstem", el), q);
    $$(".otext", el).forEach((o) => linkLineRefs(o, q));
  });
  enhanceContent(root);
  const setAnswer = (qid, L) => {
    if (sim.answers[qid] === L) delete sim.answers[qid];
    else sim.answers[qid] = L;
    Store.save();
    const sel = sim.answers[qid] || null;
    const bq = root.querySelector(`.bq[data-q="${CSS.escape(qid)}"]`);
    if (bq) {
      bq.querySelectorAll(".opt").forEach((o) => {
        const on = o.dataset.opt === sel;
        o.classList.toggle("is-sel", on);
        o.setAttribute("aria-checked", on);
        o.querySelector(".bubble").classList.toggle("sel", on);
      });
    }
    const row = root.querySelector(`.ac-row[data-q="${CSS.escape(qid)}"]`);
    if (row) row.querySelectorAll("[data-ac]").forEach((b) => {
      b.classList.toggle("sel", b.dataset.ac === sel);
      b.setAttribute("aria-pressed", b.dataset.ac === sel);
    });
    updateAcMeta();
  };
  const updateAcMeta = () => {
    const m = $("#ac-meta");
    if (!m) return;
    const answered = sim.qids.filter((q) => sim.answers[q]).length;
    const lines = sim.includeEssay ? countEssayLines(sim.essay.final) : null;
    m.textContent = `${answered} de ${sim.qids.length} marcadas${lines != null ? `. Redação: ${plural(lines, "linha", "linhas")} na folha definitiva` : ""}.`;
  };
  root.addEventListener("click", (e) => {
    const opt = e.target.closest(".bq .opt");
    if (opt && !e.target.closest(".lnref")) return setAnswer(opt.closest(".bq").dataset.q, opt.dataset.opt);
    const ac = e.target.closest("[data-ac]");
    if (ac) return setAnswer(ac.closest(".ac-row").dataset.q, ac.dataset.ac);
    const fl = e.target.closest("[data-flag]");
    if (fl) {
      const qid = fl.dataset.flag;
      if (sim.flags[qid]) delete sim.flags[qid];
      else sim.flags[qid] = true;
      Store.save();
      root.querySelectorAll(`[data-flag="${CSS.escape(qid)}"]`).forEach((b) => {
        const on = !!sim.flags[qid];
        if (b.classList.contains("flag")) {
          b.classList.toggle("on", on);
          b.textContent = on ? "★" : "☆";
        } else b.textContent = on ? "★ Dúvida" : "☆ Marcar dúvida";
        b.setAttribute("aria-pressed", on);
      });
      return;
    }
    const jump = e.target.closest("[data-jump]");
    if (jump) {
      if (sim.tab !== "booklet") {
        switchTab(sim, "booklet");
        viewSimRun();
        renderSimbar();
      }
      document.getElementById("bq-" + jump.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (e.target.closest("[data-go-essay]")) {
      switchTab(sim, "essay");
      viewSimRun();
      renderSimbar();
      window.scrollTo(0, 0);
    }
  });
  const draft = $("#draft");
  if (draft) draft.addEventListener("input", () => {
    sim.essay.draft = draft.value;
    Store.save();
  });
  const folha = root.querySelector(".folha");
  if (folha)
    bindFolha(folha, (v) => {
      sim.essay.final = v;
      Store.save();
      updateAcMeta();
    });
  $("#copy-draft")?.addEventListener("click", async () => {
    if (!sim.essay.draft.trim()) return toast("O rascunho está vazio.");
    if (sim.essay.final.trim() && !(await confirmBox("Substituir a folha definitiva?", "O texto que já está na folha definitiva será trocado pelo rascunho.", "Substituir"))) return;
    sim.essay.final = sim.essay.draft;
    Store.save();
    viewSimRun();
  });
}

// Header bar that stays visible while a simulado is running.
function renderSimbar() {
  const bar = document.getElementById("simbar");
  const sim = S().activeSim;
  const onRun = location.hash.startsWith("#/simulado/prova");
  if (!sim) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  bar.hidden = false;
  const rem = simRemaining(sim);
  const clock = rem == null ? fmt.clock(simElapsed(sim)) : fmt.clock(rem);
  if (!onRun) {
    bar.innerHTML = `<div class="simbar-in"><span>Simulado em andamento</span><span class="timer num" id="timer">${clock}</span><span class="spacer"></span><a class="btn btn-sm" href="#/simulado/prova">Voltar à prova</a></div>`;
  } else {
    bar.innerHTML = `<div class="simbar-in"><span class="timer num" id="timer" title="${rem == null ? "Tempo decorrido" : "Tempo restante"}">${clock}</span>
      <span class="small">${rem == null ? "decorrido" : "restante"}</span>
      ${sim.includeEssay ? `<span class="seg" role="group" aria-label="Alternar entre caderno e redação"><button data-tab="booklet" aria-pressed="${sim.tab !== "essay"}">Caderno de questões</button><button data-tab="essay" aria-pressed="${sim.tab === "essay"}">Folha de redação</button></span>` : ""}
      <span class="spacer"></span>
      <button class="btn btn-sm" id="pause">${sim.pausedAt ? "Continuar" : "Pausar"}</button>
      <button class="btn btn-sm btn-deliver" id="deliver">Entregar prova</button></div>`;
    bar.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        switchTab(sim, b.dataset.tab);
        viewSimRun();
        renderSimbar();
        window.scrollTo(0, 0);
      })
    );
    $("#pause", bar).addEventListener("click", () => {
      if (sim.pausedAt) {
        sim.pausedMs += Date.now() - sim.pausedAt;
        sim.pausedAt = null;
        sim.tabSince = Date.now();
      } else {
        accountTab(sim);
        sim.pausedAt = Date.now();
      }
      Store.save(true);
      viewSimRun();
      renderSimbar();
    });
    $("#deliver", bar).addEventListener("click", () => deliverSim(false));
  }
  updateTimer();
}
function updateTimer() {
  const sim = S().activeSim;
  const el = document.getElementById("timer");
  if (!sim || !el) return;
  const rem = simRemaining(sim);
  el.textContent = rem == null ? fmt.clock(simElapsed(sim)) : fmt.clock(rem);
  el.classList.toggle("warn", rem != null && rem < 30 * 60000 && rem >= 10 * 60000);
  el.classList.toggle("danger", rem != null && rem < 10 * 60000);
}
setInterval(() => {
  const sim = S().activeSim;
  if (!sim) return;
  updateTimer();
  const rem = simRemaining(sim);
  if (rem == null || sim.pausedAt) return;
  for (const m of [60, 30, 10, 5]) {
    if (rem <= m * 60000 && rem > (m - 1) * 60000 && !sim.warned[m]) {
      sim.warned[m] = true;
      Store.save();
      toast(`Faltam ${m} minutos para o fim da prova.${m <= 30 && sim.includeEssay && !sim.essay.final.trim() ? " Não esqueça de passar a redação a limpo." : ""}`, "warn");
    }
  }
  if (rem <= 0) deliverSim(true);
}, 1000);

async function deliverSim(auto) {
  const sim = S().activeSim;
  if (!sim || sim.delivering) return;
  if (!auto) {
    const blank = sim.qids.filter((q) => !sim.answers[q]).length;
    const notes = [];
    if (blank) notes.push(`${plural(blank, "questão está", "questões estão")} em branco.`);
    if (sim.includeEssay) {
      const lines = countEssayLines(sim.essay.final);
      if (!sim.essay.final.trim()) notes.push(sim.essay.draft.trim() ? "A folha definitiva da redação está vazia. Só ela é corrigida, não o rascunho." : "Você não escreveu a redação.");
      else if (lines < INFO.essay_lines_min) notes.push(`A redação tem ${plural(lines, "linha", "linhas")}; o mínimo é ${INFO.essay_lines_min}.`);
    }
    const ok = await modal({
      title: "Entregar a prova?",
      body: `${notes.length ? `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "<p>Todas as questões estão marcadas.</p>"}<p>Depois de entregar, não dá para mudar as respostas.</p>`,
      actions: [{ label: "Voltar à prova", value: false }, { label: "Entregar", value: true, kind: "btn-primary" }],
    });
    if (!ok) return;
  }
  sim.delivering = true;
  const now = Date.now();
  accountTab(sim, now);
  const used = Math.min(simElapsed(sim, now), sim.limitMs || Infinity);
  let obj = 0, pt = 0, mat = 0;
  const ptN = sim.qids.filter((q) => Q[q].subject === "portugues").length;
  for (const qid of sim.qids) {
    const q = Q[qid];
    const c = sim.answers[qid];
    const right = q.annulled || (c && c === q.answer); // annulled questions score for everyone
    if (right) {
      obj++;
      if (q.subject === "portugues") pt++;
      else mat++;
    }
    if (c) recordAttempt(qid, c, 0, "s", sim.id);
  }
  const ctx = simEssayContext(sim);
  const record = {
    id: sim.id,
    kind: sim.kind,
    title: sim.title,
    ptExam: sim.ptExam,
    qids: sim.qids,
    answers: sim.answers,
    flags: sim.flags,
    startedAt: sim.startedAt,
    finishedAt: now,
    usedMs: used,
    limitMs: sim.limitMs,
    auto,
    tabTime: sim.includeEssay ? sim.tabTime : null,
    score: { obj, pt, mat, ptN, matN: sim.qids.length - ptN },
    essay: sim.includeEssay && ctx ? { text: sim.essay.final, draft: sim.essay.draft, examId: ctx.exam.id, theme: ctx.redacao.theme, lines: countEssayLines(sim.essay.final) } : null,
    // A blank essay sheet is a zero in the real exam.
    essayScore: sim.includeEssay && ctx && !sim.essay.final.trim() ? 0 : null,
    essayBlank: !!(sim.includeEssay && ctx && !sim.essay.final.trim()),
  };
  S().sims.push(record);
  S().activeSim = null;
  Store.save(true);
  if (auto) toast("O tempo acabou e a prova foi entregue automaticamente.", "warn");
  go(`#/simulado/resultado/${record.id}`);
}

// ---------- result ----------
function viewSimResult(id) {
  const sim = S().sims.find((s) => s.id === id);
  if (!sim) return go("#/simulado");
  const sc = sim.score;
  const topics = {};
  sim.qids.forEach((qid) => {
    const q = Q[qid];
    if (!q) return;
    const t = q.topics[0];
    const b = (topics[t] = topics[t] || { n: 0, ok: 0 });
    b.n++;
    if (q.annulled || sim.answers[qid] === q.answer) b.ok++;
  });
  const elim = [];
  if (sc.pt === 0) elim.push("Você zerou Português. Na prova real, zero em qualquer disciplina elimina o candidato.");
  if (sc.mat === 0) elim.push("Você zerou Matemática. Na prova real, zero em qualquer disciplina elimina o candidato.");
  if (sim.essay && sim.essayScore === 0) elim.push(sim.essayBlank ? "Você não escreveu a redação na folha definitiva. Na prova real, isso dá zero e elimina o candidato." : "Sua redação ficou com zero, o que elimina o candidato na prova real.");
  const essayBlock = sim.essayBlank
    ? `<p>Redação: <b>0</b>. A folha definitiva ficou em branco${sim.essay.draft && sim.essay.draft.trim() ? " (o rascunho não é corrigido)" : ""}.</p>`
    : sim.essay
    ? sim.essayScore != null
      ? `<p>Redação: <b>${fmt.num(sim.essayScore, 2)}</b> de 10 (autoavaliação). <button class="btn btn-sm" id="eval">Rever avaliação</button></p>`
      : `<p>Redação: ainda não avaliada. <button class="btn btn-sm btn-pen" id="eval">Avaliar minha redação</button></p>`
    : `<p class="muted">Este simulado foi feito sem redação.</p>`;
  const total = sim.essayScore != null ? sc.obj + sim.essayScore : null;

  main().innerHTML = `<div class="page">
    <section class="sheet">
      <p class="muted">${esc(sim.title)}, entregue em ${fmt.dateTime(sim.finishedAt)} depois de ${fmt.dur(sim.usedMs)}${sim.auto ? " (tempo esgotado)" : ""}.</p>
      <div class="score-hero"><div><div class="big num">${sc.obj}<small> de 20</small></div><div class="muted">prova objetiva</div></div>
        <div><div class="big num" style="font-size:2rem">${sc.pt}<small> de ${sc.ptN}</small></div><div class="muted">Português</div></div>
        <div><div class="big num" style="font-size:2rem">${sc.mat}<small> de ${sc.matN}</small></div><div class="muted">Matemática</div></div>
        ${total != null ? `<div><div class="big num" style="font-size:2rem">${fmt.num(total, 2)}<small> de 30</small></div><div class="muted">nota final estimada</div></div>` : ""}</div>
      ${elim.map((m) => `<p class="insight" style="border-color:var(--bad)">${esc(m)}</p>`).join("")}
      ${sim.tabTime && sim.tabTime.essay + sim.tabTime.booklet > 60000 ? `<p class="muted">Ritmo: ${fmt.dur(sim.tabTime.booklet)} no caderno de questões e ${fmt.dur(sim.tabTime.essay)} na folha de redação.${sim.tabTime.essay < 30 * 60000 && sim.essay && sim.essay.text ? " Menos de meia hora para a redação costuma ser pouco: reserve cerca de 1 hora para ela." : ""}</p>` : ""}
      ${essayBlock}
      <div class="quick noprint">
        ${sim.qids.some((q) => Q[q] && !Q[q].annulled && sim.answers[q] !== Q[q].answer) ? `<button class="btn btn-pen" id="redo">Refazer as que errei neste simulado</button>` : ""}
        <a class="btn" href="#/simulado">Novo simulado</a><a class="btn" href="#/desempenho">Ver desempenho</a>
      </div>
    </section>
    <div id="essay-eval"></div>
    <div class="grid-2 block">
      <section class="sheet"><h2>Correção questão por questão</h2><p class="muted small">Clique numa questão para ver a resolução.</p>
        <ul class="review-list">${sim.qids
          .map((qid, i) => {
            const q = Q[qid];
            if (!q) return "";
            const c = sim.answers[qid];
            const st = q.annulled ? "void" : !c ? "void" : c === q.answer ? "ok" : "bad";
            const mark = q.annulled ? "anulada" : !c ? "em branco" : c === q.answer ? "✓" : "✕";
            return `<li><button data-rv="${i}"><span class="bubble ${st === "ok" ? "ok" : st === "bad" ? "bad" : "void"}" style="--b:28px">${c || "–"}</span>
              <span><b>${i + 1}</b></span><span>${esc(TOPIC_LABEL[q.topics[0]] || "")}<br><small class="muted">${esc(qLabel(q))}</small></span>
              <span class="chip ${st === "ok" ? "chip-good" : st === "bad" ? "chip-bad" : ""}">${mark}${st === "bad" ? ` certa: ${q.answer}` : ""}</span></button><div class="rv-body" hidden></div></li>`;
          })
          .join("")}</ul>
      </section>
      <section class="sheet"><h2>Acertos por assunto</h2>
        <table class="tbl"><tbody>${Object.entries(topics)
          .sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)
          .map(([t, b]) => `<tr><td>${esc(TOPIC_LABEL[t] || t)}</td><td class="r">${b.ok}/${b.n}</td><td class="barcell">${hbar(b.ok / b.n, accClass(b.ok / b.n))}</td></tr>`)
          .join("")}</tbody></table>
      </section>
    </div></div>`;

  $$("[data-rv]").forEach((b) =>
    b.addEventListener("click", () => {
      const body = b.nextElementSibling;
      if (!body.hidden) {
        body.hidden = true;
        return;
      }
      const qid = sim.qids[+b.dataset.rv];
      const q = Q[qid];
      const exam = EXAM[q.examId];
      const texts = (q.texts || []).filter((t) => exam.textById[t]);
      body.innerHTML = `${texts.length ? `<details><summary>Ver ${texts.length > 1 ? "os textos" : "o texto"}</summary>${readerHTML(exam, texts)}</details>` : ""}
        <div class="qstem" style="margin-top:10px">${q.stem}</div>${optionsHTML(q, { selected: sim.answers[qid] || null, revealed: true })}${explanationHTML(q, sim.answers[qid] || null)}`;
      body.hidden = false;
      linkLineRefs($(".qstem", body), q);
      $$(".otext", body).forEach((o) => linkLineRefs(o, q));
      linkLineRefs($(".expl", body), q);
      enhanceContent(body);
      bindReader(body);
    })
  );
  bindReader(main());
  bindLineRefs(main());
  $("#redo")?.addEventListener("click", () =>
    startPractice(sim.qids.filter((q) => Q[q] && !Q[q].annulled && sim.answers[q] !== Q[q].answer), "Erradas do simulado", `#/simulado/resultado/${sim.id}`)
  );
  $("#eval")?.addEventListener("click", () => {
    const e = EXAM[sim.essay.examId];
    const ctx = { theme: sim.essay.theme, sourceText: (e.texts || []).map((t) => (t.lines || []).map(stripTags).join(" ")).join("\n") };
    renderEssayEval($("#essay-eval"), { text: sim.essay.text, rubric: sim.essayRubric, zero: sim.essayZero }, ctx, (res) => {
      sim.essayRubric = res.rubric;
      sim.essayZero = res.zero;
      sim.essayScore = res.score;
      Store.save(true);
      viewSimResult(id);
      toast("Avaliação da redação salva.");
    });
    $("#essay-eval").scrollIntoView({ behavior: "smooth" });
  });
}

route("simulado", viewSimSetup);
route("simulado/prova", viewSimRun);
route("simulado/resultado/:id", viewSimResult);
