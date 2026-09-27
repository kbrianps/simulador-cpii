// Início: countdown, where the student stands, and the answer map of every exam.

function answerMapHTML() {
  const rows = EXAMS.map((e) => {
    let prevSubj = null;
    const cells = e.questions
      .map((q) => {
        const st = questionStatus(q.id);
        const gap = prevSubj && prevSubj !== q.subject ? `<span class="gap"></span>` : "";
        prevSubj = q.subject;
        const cls = q.annulled ? "void" : st || "";
        const label = `${e.title}, questão ${q.n} (${SUBJ_LABEL[q.subject]}): ${q.annulled ? "anulada" : st === "ok" ? "acertou" : st === "bad" ? "errou" : "ainda não resolvida"}`;
        const mark = st === "ok" ? "✓" : st === "bad" ? "✕" : q.n;
        return `${gap}<button class="cell ${cls}" data-q="${q.id}" title="${esc(label)}" aria-label="${esc(label)}">${mark}</button>`;
      })
      .join("");
    const done = e.questions.filter((q) => questionStatus(q.id)).length;
    return `<div class="map-row"><div class="map-label"><b>${esc(e.title)}</b><br><small class="muted">${done} de ${e.questions.length} feitas</small></div><div class="map-cells">${cells}</div></div>`;
  }).join("");
  return `<div class="map">${rows}</div>
    <div class="map-legend"><span><i class="cell ok">✓</i> acertou (última tentativa)</span><span><i class="cell bad">✕</i> errou</span><span><i class="cell">7</i> ainda não fez</span><span><i class="cell void">·</i> anulada</span><span class="muted">Nas provas oficiais, as questões 1 a 10 são de Português e 11 a 20 de Matemática.</span></div>`;
}

function focusListHTML(list, kind) {
  if (!list.length) return `<p class="muted">Resolva mais questões para aparecer aqui. Cada assunto precisa de pelo menos 2 respostas.</p>`;
  return `<ul class="focus-list">${list
    .slice(0, 4)
    .map(
      (t) => `<li><span>${esc(TOPIC_LABEL[t.id] || t.id)}<br><small class="muted">${t.ok} de ${t.n} certas (${fmt.pct(t.acc)})</small></span>
      <a class="btn btn-sm ${kind === "weak" ? "btn-pen" : ""}" href="#/praticar/assunto/${encodeURIComponent(t.id)}">Treinar</a>
      <div class="meter ${kind === "weak" ? "bad" : "good"}"><i style="width:${Math.round(t.acc * 100)}%"></i></div></li>`
    )
    .join("")}</ul>`;
}

function viewHome() {
  const st = computeStats();
  const days = INFO.next_exam_date ? daysUntil(INFO.next_exam_date) : null;
  const dateTxt = INFO.next_exam_date
    ? new Date(INFO.next_exam_date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  let count = "";
  if (days != null) {
    if (days > 1) count = `<strong>${days} dias</strong>até a prova, ${dateTxt}.`;
    else if (days === 1) count = `<strong>Amanhã</strong>é a prova, ${dateTxt}. Descanse bem.`;
    else if (days === 0) count = `<strong>Hoje</strong>é dia de prova. Boa sorte!`;
    else count = `<strong>Prova realizada</strong>A prova de ${dateTxt} já aconteceu. Continue treinando para o próximo processo seletivo.`;
  }
  const total = ALL_Q.length;
  const answered = st.first.size;
  const sims = S().sims.filter((s) => s.finishedAt);
  const lastSim = sims[sims.length - 1];
  const act = S().activeSim;
  const prac = S().practice;
  const resume = [];
  if (act) resume.push(`<a class="btn btn-pen" href="#/simulado/prova">Voltar ao simulado em andamento</a>`);
  if (prac && !prac.single && prac.queue && prac.idx < prac.queue.length) resume.push(`<a class="btn" href="#/praticar/sessao">Continuar treino (questão ${prac.idx + 1} de ${prac.queue.length})</a>`);

  main().innerHTML = `<div class="page">
    <div class="hello">
      <section class="sheet">
        <p class="countdown">${esc(INFO.next_exam_label || "Processo seletivo do Colégio Pedro II")}<br>${count}</p>
        <p class="muted">20 questões de múltipla escolha e uma redação, em 3 horas. Nota máxima: 30 pontos.</p>
        <div class="quick">
          <a class="btn btn-primary btn-lg" href="#/simulado">Fazer um simulado</a>
          <a class="btn btn-lg" href="#/praticar">Praticar questões</a>
          <a class="btn btn-lg" href="#/redacao">Sortear tema de redação</a>
        </div>
        ${resume.length ? `<div class="quick">${resume.join("")}</div>` : ""}
      </section>
      <section class="sheet">
        <h2>Seu resumo</h2>
        ${
          answered
            ? `<p><b class="num">${answered}</b> de ${total} questões resolvidas, com <b>${fmt.pct(st.acc)}</b> de acerto na primeira tentativa.</p>
               <p>Português: <b>${fmt.pct(st.subj.portugues.n ? st.subj.portugues.ok / st.subj.portugues.n : null)}</b> (${st.subj.portugues.n} questões). Matemática: <b>${fmt.pct(st.subj.matematica.n ? st.subj.matematica.ok / st.subj.matematica.n : null)}</b> (${st.subj.matematica.n} questões).</p>
               ${lastSim ? `<p>Último simulado: <b>${lastSim.score.obj} de 20</b> na prova objetiva${lastSim.essayScore != null ? ` e ${fmt.num(lastSim.essayScore, 2)} na redação` : ""} (${fmt.date(lastSim.finishedAt)}).</p>` : `<p class="muted">Você ainda não fez nenhum simulado completo.</p>`}
               <a class="btn btn-sm" href="#/desempenho">Ver desempenho completo</a>`
            : `<p>Você ainda não resolveu nenhuma questão. Comece por uma prova inteira no simulado ou treine por assunto: o simulador vai mostrando onde você acerta e onde erra.</p>`
        }
      </section>
    </div>
    <div class="grid-2 block">
      <section class="sheet"><h2>Onde você mais erra</h2>${focusListHTML(weakTopics(st), "weak")}</section>
      <section class="sheet"><h2>Onde você mais acerta</h2>${focusListHTML(strongTopics(st), "strong")}</section>
    </div>
    <section class="sheet block">
      <h2>Cartão-resposta de todas as provas</h2>
      <p class="muted">Cada bolinha é uma questão. Clique em qualquer uma para resolver.</p>
      ${answerMapHTML()}
    </section>
  </div>`;
  main().querySelectorAll(".cell[data-q]").forEach((b) => b.addEventListener("click", () => go(`#/questao/${encodeURIComponent(b.dataset.q)}`)));
}
route("", viewHome);
