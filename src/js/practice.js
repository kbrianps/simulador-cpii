// Praticar: filtered question sessions with immediate correction.

function filterQuestions(f) {
  return ALL_Q.filter((q) => {
    const e = EXAM[q.examId];
    if (!f.extras && !e.official) return false;
    if (f.subject && q.subject !== f.subject) return false;
    if (f.exam && q.examId !== f.exam) return false;
    if (f.topic && !q.topics.includes(f.topic)) return false;
    if (f.diff && q.difficulty !== +f.diff) return false;
    if (f.status === "new" && lastAttempt(q.id)) return false;
    if (f.status === "wrong" && questionStatus(q.id) !== "bad") return false;
    if (f.status === "flag" && !isFlagged(q.id)) return false;
    return true;
  });
}

function startPractice(qids, title, back = "#/praticar", replace = false) {
  if (!qids.length) {
    toast("Nenhuma questão encontrada com esses filtros.");
    if (replace) location.replace("#/praticar");
    return;
  }
  S().practice = { queue: qids, idx: 0, answers: {}, revealed: {}, title, back, startedAt: Date.now() };
  Store.save();
  if (replace) location.replace("#/praticar/sessao");
  else go("#/praticar/sessao");
}

// Unanswered first, then wrong ones, then the rest; random inside each group.
function smartOrder(qs) {
  const groups = [[], [], []];
  for (const q of qs) {
    const st = questionStatus(q.id);
    groups[!lastAttempt(q.id) ? 0 : st === "bad" ? 1 : 2].push(q.id);
  }
  return groups.flatMap((g) => shuffle(g));
}

function viewPracticeSetup() {
  const f = Object.assign({ subject: "", exam: "", topic: "", diff: "", status: "", order: "random", size: "20", extras: true }, S().practiceFilters || {});
  const st = computeStats();
  const topicOpts = (subj) =>
    Object.entries(DATA.topics[subj] || {})
      .map(([id, label]) => {
        const count = ALL_Q.filter((q) => q.topics.includes(id)).length;
        return count ? `<option value="${id}" ${f.topic === id ? "selected" : ""}>${esc(label)} (${count})</option>` : "";
      })
      .join("");
  const wrongCount = st.wrongNow.length;
  const flagCount = Object.keys(S().flags).filter((id) => Q[id]).length;
  const topicRows = (subj) =>
    Object.entries(DATA.topics[subj] || {})
      .map(([id, label]) => {
        const count = ALL_Q.filter((q) => q.topics.includes(id)).length;
        if (!count) return "";
        const t = st.topic[id];
        return `<tr><td><a href="#/praticar/assunto/${encodeURIComponent(id)}">${esc(label)}</a></td><td class="r">${count}</td>
          <td class="r">${t ? `${t.ok}/${t.n}` : "–"}</td><td class="barcell">${t ? hbar(t.acc, accClass(t.acc)) : `<span class="muted small">sem respostas</span>`}</td></tr>`;
      })
      .join("");

  main().innerHTML = `<div class="page">
    <h1>Praticar questões</h1>
    <p class="lead">Resolva questões das provas anteriores com correção na hora e resolução comentada. Seus acertos e erros alimentam as estatísticas.</p>
    <section class="sheet">
      <div class="filters" id="pf">
        <label class="field">Matéria<select name="subject"><option value="">Todas</option><option value="portugues" ${f.subject === "portugues" ? "selected" : ""}>Português</option><option value="matematica" ${f.subject === "matematica" ? "selected" : ""}>Matemática</option></select></label>
        <label class="field">Prova<select name="exam"><option value="">Todas as provas</option>${EXAMS.map((e) => `<option value="${e.id}" ${f.exam === e.id ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select></label>
        <label class="field">Assunto<select name="topic"><option value="">Todos os assuntos</option><optgroup label="Português">${topicOpts("portugues")}</optgroup><optgroup label="Matemática">${topicOpts("matematica")}</optgroup></select></label>
        <label class="field">Dificuldade<select name="diff"><option value="">Todas</option><option value="1" ${f.diff === "1" ? "selected" : ""}>Fácil</option><option value="2" ${f.diff === "2" ? "selected" : ""}>Média</option><option value="3" ${f.diff === "3" ? "selected" : ""}>Difícil</option></select></label>
        <label class="field">Situação<select name="status"><option value="">Todas</option><option value="new" ${f.status === "new" ? "selected" : ""}>Ainda não resolvidas</option><option value="wrong" ${f.status === "wrong" ? "selected" : ""}>Que eu errei</option><option value="flag" ${f.status === "flag" ? "selected" : ""}>Marcadas para revisar</option></select></label>
        <label class="field">Ordem<select name="order"><option value="random" ${f.order === "random" ? "selected" : ""}>Novas e erradas primeiro</option><option value="exam" ${f.order === "exam" ? "selected" : ""}>Na ordem da prova</option></select></label>
        <label class="field">Quantidade<select name="size"><option value="10" ${f.size === "10" ? "selected" : ""}>10</option><option value="20" ${f.size === "20" ? "selected" : ""}>20</option><option value="all" ${f.size === "all" ? "selected" : ""}>Todas</option></select></label>
        <label class="chk"><input type="checkbox" name="extras" ${f.extras ? "checked" : ""}> Incluir questões extras de Matemática (2011 e 2013)</label>
      </div>
      <div class="row" style="margin-top:18px"><button class="btn btn-primary btn-lg" id="pf-go">Começar treino</button><span id="pf-count" class="muted"></span></div>
    </section>
    <div class="grid-2 block">
      <section class="sheet"><h2>Treinos rápidos</h2>
        <div class="stack">
          <button class="btn" id="q-wrong" ${wrongCount ? "" : "disabled"}>Refazer as que eu errei (${wrongCount})</button>
          <button class="btn" id="q-flag" ${flagCount ? "" : "disabled"}>Revisar as marcadas (${flagCount})</button>
          <button class="btn" id="q-weak" ${weakTopics(st).length ? "" : "disabled"}>Treinar meus 3 assuntos mais fracos</button>
          <button class="btn" id="q-mix">10 questões novas misturadas</button>
        </div>
      </section>
      <section class="sheet"><h2>Como funciona</h2>
        <p>Escolha a alternativa e confirme. A correção aparece na hora, com a resolução e o motivo de cada alternativa errada.</p>
        <p>Nos textos, clique numa linha para marcá-la com marca-texto. Quando o enunciado cita linhas, clique na referência para ver o trecho.</p>
        <p class="muted small">Atalhos: <span class="kbd">A</span> a <span class="kbd">D</span> escolhem, <span class="kbd">Enter</span> confirma e avança.</p>
      </section>
    </div>
    <section class="sheet block"><h2>Por assunto</h2>
      <div class="table-scroll"><table class="tbl"><thead><tr><th>Assunto</th><th class="r">Questões</th><th class="r">Seus acertos</th><th>Aproveitamento</th></tr></thead>
      <tbody><tr class="grp"><td colspan="4">Português</td></tr>${topicRows("portugues")}<tr class="grp"><td colspan="4">Matemática</td></tr>${topicRows("matematica")}</tbody></table></div>
    </section>
  </div>`;

  const form = $("#pf");
  const read = () => {
    const o = {};
    form.querySelectorAll("select").forEach((s) => (o[s.name] = s.value));
    o.extras = form.querySelector('[name="extras"]').checked;
    return o;
  };
  const update = () => {
    const nf = read();
    S().practiceFilters = nf;
    Store.save();
    const n = filterQuestions(nf).length;
    $("#pf-count").textContent = n ? `${plural(n, "questão encontrada", "questões encontradas")}` : "Nenhuma questão com esses filtros.";
  };
  form.addEventListener("change", update);
  update();
  $("#pf-go").addEventListener("click", () => {
    const nf = read();
    let qs = filterQuestions(nf);
    let ids = nf.order === "exam" ? qs.map((q) => q.id) : smartOrder(qs);
    if (nf.size !== "all") ids = ids.slice(0, +nf.size);
    const parts = [nf.topic ? TOPIC_LABEL[nf.topic] : nf.subject ? SUBJ_LABEL[nf.subject] : "Treino", nf.exam ? EXAM[nf.exam].title : ""].filter(Boolean);
    startPractice(ids, parts.join(", "));
  });
  $("#q-wrong").addEventListener("click", () => startPractice(shuffle(st.wrongNow), "Refazer as erradas"));
  $("#q-flag").addEventListener("click", () => startPractice(Object.keys(S().flags).filter((id) => Q[id]), "Marcadas para revisar"));
  $("#q-weak").addEventListener("click", () => {
    const weak = weakTopics(st).slice(0, 3).map((t) => t.id);
    const qs = ALL_Q.filter((q) => q.topics.some((t) => weak.includes(t)));
    startPractice(smartOrder(qs).slice(0, 15), "Assuntos mais fracos");
  });
  $("#q-mix").addEventListener("click", () => {
    const fresh = ALL_Q.filter((q) => !lastAttempt(q.id));
    startPractice(shuffle(fresh.length ? fresh : ALL_Q).slice(0, 10).map((q) => q.id), "Questões misturadas");
  });
}

function viewPracticeTopic(topic) {
  const qs = ALL_Q.filter((q) => q.topics.includes(topic));
  startPractice(smartOrder(qs).slice(0, 15), TOPIC_LABEL[topic] || "Treino", "#/praticar", true);
}

function viewSingleQuestion(qid) {
  if (!Q[qid]) return go("#/praticar");
  S().practice = { queue: [qid], idx: 0, answers: {}, revealed: {}, title: qLabel(Q[qid]), back: "#/", single: true, startedAt: Date.now() };
  Store.save();
  viewPracticeSession();
}

function viewPracticeSession() {
  const P = S().practice;
  if (!P || !P.queue || !P.queue.length) return go("#/praticar");
  if (P.idx >= P.queue.length) return viewPracticeSummary();
  const qid = P.queue[P.idx];
  const q = Q[qid];
  if (!q) {
    P.idx++;
    return viewPracticeSession();
  }
  const exam = EXAM[q.examId];
  const revealed = !!P.revealed[qid];
  const selected = P.answers[qid] ?? null;
  const hasTexts = q.texts && q.texts.length && q.texts.some((t) => exam.textById[t]);
  const shownAt = Date.now();

  const actions = revealed
    ? `<button class="btn btn-primary" data-act="next">${P.idx + 1 < P.queue.length ? "Próxima questão" : "Ver resumo do treino"}</button>`
    : `<button class="btn btn-primary" data-act="confirm" ${selected ? "" : "disabled"}>Confirmar resposta</button><button class="btn btn-quiet" data-act="skip">Pular</button>`;
  main().innerHTML = `<div class="page">
    <div class="progressline"><div><b>${esc(P.title || "Treino")}</b>${P.single ? "" : ` <span class="muted">questão ${P.idx + 1} de ${P.queue.length}</span>`}</div>
      <div class="row">${P.idx > 0 ? `<button class="btn btn-sm" data-act="prev">Anterior</button>` : ""}<a class="btn btn-sm" href="${P.back || "#/praticar"}">Sair do treino</a></div></div>
    <div class="qwrap ${hasTexts ? "" : "solo"}">
      ${hasTexts ? readerHTML(exam, q.texts) : ""}
      <article class="sheet" id="qcard">
        ${questionHeadHTML(q)}
        <div class="qstem">${q.stem}</div>
        ${optionsHTML(q, { selected, revealed })}
        <div class="qactions">${actions}<span class="spacer"></span>
          <button class="btn btn-sm btn-quiet" data-act="flag" aria-pressed="${isFlagged(qid)}">${isFlagged(qid) ? "★ Marcada para revisar" : "☆ Marcar para revisar"}</button></div>
        <div id="qexpl">${revealed ? explanationHTML(q, selected) : ""}</div>
      </article>
    </div></div>`;

  const card = $("#qcard");
  linkLineRefs($(".qstem", card), q);
  $$(".otext", card).forEach((el) => linkLineRefs(el, q));
  linkLineRefs($("#qexpl", card), q);
  enhanceContent(main());
  bindReader(main());
  bindLineRefs(main());

  const choose = (L) => {
    if (revealed) return;
    P.answers[qid] = L;
    Store.save();
    card.querySelectorAll(".opt").forEach((o) => {
      const on = o.dataset.opt === L;
      o.classList.toggle("is-sel", on);
      o.setAttribute("aria-checked", on);
      o.querySelector(".bubble").classList.toggle("sel", on);
    });
    const c = card.querySelector('[data-act="confirm"]');
    if (c) c.disabled = false;
  };
  const confirm = () => {
    if (revealed || !P.answers[qid]) return;
    const ms = Math.min(Date.now() - shownAt, 20 * 60000);
    recordAttempt(qid, P.answers[qid], ms, "p");
    P.revealed[qid] = true;
    Store.save();
    viewPracticeSession();
    const ex = $("#qexpl");
    if (ex) ex.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const next = () => {
    P.idx++;
    Store.save();
    viewPracticeSession();
    window.scrollTo(0, 0);
  };
  card.addEventListener("click", (e) => {
    const o = e.target.closest(".opt");
    if (o && !o.disabled && !e.target.closest(".lnref")) return choose(o.dataset.opt);
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const act = a.dataset.act;
    if (act === "confirm") confirm();
    else if (act === "next" || act === "skip") next();
    else if (act === "flag") {
      const on = toggleFlag(qid);
      a.textContent = on ? "★ Marcada para revisar" : "☆ Marcar para revisar";
      a.setAttribute("aria-pressed", on);
    }
  });
  main().querySelector('[data-act="prev"]')?.addEventListener("click", () => {
    P.idx = Math.max(0, P.idx - 1);
    Store.save();
    viewPracticeSession();
  });
  const onKey = (e) => {
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toUpperCase();
    if (!revealed && ["A", "B", "C", "D"].includes(k)) choose(k);
    else if (!revealed && ["1", "2", "3", "4"].includes(k)) choose(LETTERS[+k - 1]);
    else if (e.key === "Enter" && !e.target.closest("button, a")) revealed ? next() : confirm();
    else if (e.key === "ArrowRight" && revealed) next();
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));
}

function viewPracticeSummary() {
  const P = S().practice;
  const rows = P.queue.map((qid) => ({ q: Q[qid], c: P.answers[qid], rev: P.revealed[qid] })).filter((r) => r.q);
  const done = rows.filter((r) => r.rev);
  const ok = done.filter((r) => !r.q.annulled && r.c === r.q.answer).length;
  const byTopic = {};
  for (const r of done) {
    const t = r.q.topics[0];
    const b = (byTopic[t] = byTopic[t] || { n: 0, ok: 0 });
    b.n++;
    if (r.c === r.q.answer) b.ok++;
  }
  main().innerHTML = `<div class="page page-narrow">
    <section class="sheet">
      <h1>Fim do treino</h1>
      <div class="score-hero"><div class="big num">${ok}<small> de ${done.length}</small></div><p class="lead">${done.length ? `Você acertou ${fmt.pct(ok / done.length)} das questões que respondeu${rows.length > done.length ? ` e pulou ${rows.length - done.length}` : ""}.` : "Você não respondeu nenhuma questão."}</p></div>
      ${Object.keys(byTopic).length ? `<h2 style="margin-top:20px">Por assunto</h2><table class="tbl"><tbody>${Object.entries(byTopic)
        .map(([t, b]) => `<tr><td>${esc(TOPIC_LABEL[t] || t)}</td><td class="r">${b.ok}/${b.n}</td><td class="barcell">${hbar(b.ok / b.n, accClass(b.ok / b.n))}</td></tr>`)
        .join("")}</tbody></table>` : ""}
      <div class="quick">
        ${rows.some((r) => r.rev && r.c !== r.q.answer && !r.q.annulled) ? `<button class="btn btn-pen" id="redo">Refazer as que errei agora</button>` : ""}
        <a class="btn btn-primary" href="#/praticar">Novo treino</a><a class="btn" href="#/desempenho">Ver desempenho</a>
      </div>
    </section></div>`;
  $("#redo")?.addEventListener("click", () =>
    startPractice(rows.filter((r) => r.rev && r.c !== r.q.answer && !r.q.annulled).map((r) => r.q.id), "Refazer as erradas do treino")
  );
}

route("praticar", viewPracticeSetup);
route("praticar/sessao", viewPracticeSession);
route("praticar/assunto/:topic", viewPracticeTopic);
route("questao/:qid", viewSingleQuestion);
