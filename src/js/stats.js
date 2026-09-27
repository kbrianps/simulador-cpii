// Desempenho: where the student hits and misses, by topic, subject, difficulty, exam, pace and over time.

function kpi(v, l, d = "") {
  return `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div>${d ? `<div class="d">${d}</div>` : ""}</div>`;
}

function topicRowsHTML(list, kind) {
  if (!list.length) return `<p class="muted">Ainda não há dados suficientes. Cada assunto aparece aqui depois de pelo menos 2 questões respondidas.</p>`;
  return `<table class="tbl"><tbody>${list
    .slice(0, 6)
    .map(
      (t) => `<tr><td>${esc(TOPIC_LABEL[t.id] || t.id)}<br><small class="muted">${SUBJ_LABEL[t.id.startsWith("pt.") ? "portugues" : "matematica"]}</small></td>
      <td class="r">${t.ok}/${t.n}</td><td class="barcell">${hbar(t.acc, accClass(t.acc))}</td><td class="r">${fmt.pct(t.acc)}</td>
      <td class="noprint"><a class="btn btn-sm ${kind === "weak" ? "btn-pen" : ""}" href="#/praticar/assunto/${encodeURIComponent(t.id)}">Treinar</a></td></tr>`
    )
    .join("")}</tbody></table>`;
}

function insightsFor(st) {
  const out = [];
  const weak = weakTopics(st);
  const strong = strongTopics(st);
  if (weak.length) out.push(`Seu ponto mais fraco até agora é <b>${esc(TOPIC_LABEL[weak[0].id])}</b>: ${weak[0].ok} de ${weak[0].n} certas.`);
  if (strong.length && strong[0].acc >= 0.6) out.push(`Seu ponto mais forte é <b>${esc(TOPIC_LABEL[strong[0].id])}</b>: ${strong[0].ok} de ${strong[0].n} certas.`);
  const p = st.subj.portugues, m = st.subj.matematica;
  if (p.n >= 5 && m.n >= 5) {
    const ap = p.ok / p.n, am = m.ok / m.n;
    if (Math.abs(ap - am) >= 0.1)
      out.push(`Você acerta ${fmt.pct(ap)} em Português e ${fmt.pct(am)} em Matemática. ${ap > am ? "A Matemática" : "O Português"} está puxando sua nota para baixo; vale dar mais tempo de estudo para ${ap > am ? "ela" : "ele"}.`);
    else out.push(`Seu desempenho está equilibrado: ${fmt.pct(ap)} em Português e ${fmt.pct(am)} em Matemática.`);
  }
  if (st.fast.n >= 5 && st.slow.n >= 5) {
    const af = st.fast.ok / st.fast.n, as = st.slow.ok / st.slow.n;
    if (as - af >= 0.15) out.push(`Quando responde em menos de 1 minuto, você acerta ${fmt.pct(af)}; com mais calma, ${fmt.pct(as)}. Ler com mais atenção pode render pontos.`);
    else if (af - as >= 0.15) out.push(`Você acerta mais nas questões que resolve rápido (${fmt.pct(af)}) do que nas demoradas (${fmt.pct(as)}). Nas difíceis, tente marcar e voltar depois, como faria na prova.`);
  }
  const d1 = st.diff[1], d3 = st.diff[3];
  if (d1.n >= 3 && d3.n >= 3) out.push(`Você acerta ${fmt.pct(d1.ok / d1.n)} das questões fáceis e ${fmt.pct(d3.ok / d3.n)} das difíceis.${d1.ok / d1.n < 0.8 ? " Errar fáceis custa caro: revise as que errou por desatenção." : ""}`);
  if (st.recovered.length) out.push(`Você já recuperou ${plural(st.recovered.length, "questão", "questões")} que tinha errado na primeira vez.`);
  return out;
}

function practiceTrend() {
  // accuracy per day of first attempts, last 14 active days
  const first = firstAttempts();
  const days = {};
  for (const a of first.values()) {
    const k = new Date(a.t).toISOString().slice(0, 10);
    const d = (days[k] = days[k] || { n: 0, ok: 0 });
    d.n++;
    if (a.ok) d.ok++;
  }
  return Object.entries(days)
    .sort()
    .slice(-14)
    .map(([k, d]) => ({ x: k.slice(8, 10) + "/" + k.slice(5, 7), y: Math.round((d.ok / d.n) * 100), tip: `${k.slice(8, 10)}/${k.slice(5, 7)}: ${d.ok} de ${d.n} certas (${fmt.pct(d.ok / d.n)})` }));
}

function essayCriteria() {
  const rated = allEssays().filter((e) => e.rubric && Object.keys(e.rubric).length);
  if (!rated.length) return null;
  const avg = {};
  for (const c of RUBRIC) {
    const vals = rated.map((e) => e.rubric[c.id]).filter((v) => v != null);
    avg[c.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  const scores = rated.map((e) => e.score).filter((v) => v != null);
  return { n: rated.length, avg, mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
}

function viewStats() {
  const st = computeStats();
  const sims = S().sims.filter((s) => s.finishedAt);
  const ess = essayCriteria();
  const total = ALL_Q.length;
  const prio = priorities(st).slice(0, 8);
  const trend = practiceTrend();

  if (!st.n && !sims.length && !S().essays.length) {
    main().innerHTML = `<div class="page page-narrow"><h1>Desempenho</h1><section class="sheet empty"><p>Ainda não há nada para analisar. Resolva questões no treino ou faça um simulado: aqui vão aparecer seus acertos e erros por assunto, por matéria, por dificuldade e ao longo do tempo.</p>
      <div class="row" style="justify-content:center"><a class="btn btn-primary" href="#/simulado">Fazer um simulado</a><a class="btn" href="#/praticar">Praticar questões</a></div></section>${dataSectionHTML()}</div>`;
    bindDataSection();
    return;
  }

  const insights = insightsFor(st);
  const simPoints = sims.map((s, i) => ({ x: `${i + 1}º`, y: s.score.obj, tip: `${fmt.date(s.finishedAt)}, ${esc(s.title)}: ${s.score.obj}/20${s.essayScore != null ? `, redação ${fmt.num(s.essayScore, 2)}` : ""}` }));
  const subjAcc = (k) => (st.subj[k].n ? st.subj[k].ok / st.subj[k].n : null);
  const allTopicRows = (subj) =>
    Object.entries(DATA.topics[subj] || {})
      .map(([id, label]) => {
        const inBank = ALL_Q.filter((q) => q.topics.includes(id)).length;
        if (!inBank) return "";
        const t = st.topic[id];
        return `<tr><td>${esc(label)}</td><td class="r">${fmt.num(TOPIC_FREQ[id] || 0, 1)}</td><td class="r">${inBank}</td><td class="r">${t ? `${t.ok}/${t.n}` : "–"}</td>
          <td class="barcell">${t ? hbar(t.acc, accClass(t.acc)) : `<span class="muted small">sem respostas</span>`}</td></tr>`;
      })
      .join("");

  main().innerHTML = `<div class="page">
    <h1>Desempenho</h1>
    <p class="lead">As porcentagens usam a primeira vez que você respondeu cada questão, antes de ver a resolução. É a medida mais honesta do que você já sabe.</p>
    <div class="kpis">
      ${kpi(`${st.n}<small class="muted" style="font-size:1rem"> / ${total}</small>`, "questões resolvidas")}
      ${kpi(fmt.pct(st.acc), "de acerto geral", st.n ? `${st.ok} certas` : "")}
      ${kpi(fmt.pct(subjAcc("portugues")), "em Português", `${st.subj.portugues.n} questões`)}
      ${kpi(fmt.pct(subjAcc("matematica")), "em Matemática", `${st.subj.matematica.n} questões`)}
      ${kpi(st.avgMs ? fmt.secs(st.avgMs) : "–", "por questão no treino", "tempo médio")}
      ${kpi(sims.length ? fmt.num(sims.reduce((a, s) => a + s.score.obj, 0) / sims.length, 1) : "–", "média nos simulados", `${plural(sims.length, "simulado", "simulados")}, de 0 a 20`)}
      ${kpi(ess && ess.mean != null ? fmt.num(ess.mean, 1) : "–", "média na redação", ess ? `${plural(ess.n, "redação avaliada", "redações avaliadas")}` : "nenhuma avaliada")}
    </div>
    ${insights.length ? `<section class="sheet block"><h2>O que os números dizem</h2>${insights.map((i) => `<p class="insight">${i}</p>`).join("")}</section>` : ""}
    <div class="grid-2 block">
      <section class="sheet"><h2>Onde você mais erra</h2>${topicRowsHTML(weakTopics(st), "weak")}</section>
      <section class="sheet"><h2>Onde você mais acerta</h2>${topicRowsHTML(strongTopics(st), "strong")}</section>
    </div>
    <section class="sheet block"><h2>Prioridades de estudo</h2>
      <p class="muted">Cruza o quanto cada assunto aparece nas provas do CPII com o quanto você erra nele. Assuntos que você nunca treinou contam como 50% de chance.</p>
      <div class="table-scroll"><table class="tbl"><thead><tr><th>Assunto</th><th class="r">Questões por prova</th><th class="r">Seu acerto</th><th>Prioridade</th><th></th></tr></thead><tbody>
      ${prio.map((p) => `<tr><td>${esc(TOPIC_LABEL[p.id] || p.id)}</td><td class="r">${fmt.num(p.freq, 1)}</td><td class="r">${p.seen ? fmt.pct(p.acc) + ` <small class="muted">(${p.seen})</small>` : `<span class="muted">não treinado</span>`}</td>
        <td class="barcell">${hbar(p.p / (prio[0].p || 1))}</td><td class="noprint"><a class="btn btn-sm" href="#/praticar/assunto/${encodeURIComponent(p.id)}">Treinar</a></td></tr>`).join("")}
      </tbody></table></div></section>
    <div class="grid-2 block">
      <section class="sheet"><h2>Evolução nos simulados</h2>${simPoints.length ? `<p class="muted small">Acertos na prova objetiva (de 0 a 20) em cada simulado.</p>${lineChart(simPoints, { max: 20, yLabel: "Acertos por simulado" })}
        <table class="tbl" style="margin-top:10px"><thead><tr><th>Simulado</th><th class="r">Português</th><th class="r">Matemática</th><th class="r">Redação</th></tr></thead><tbody>
        ${sims.slice(-6).reverse().map((s) => `<tr><td><a href="#/simulado/resultado/${s.id}">${fmt.date(s.finishedAt)}</a> <small class="muted">${esc(s.title)}</small></td><td class="r">${s.score.pt}/${s.score.ptN}</td><td class="r">${s.score.mat}/${s.score.matN}</td><td class="r">${s.essayScore != null ? fmt.num(s.essayScore, 2) : "–"}</td></tr>`).join("")}
        </tbody></table>` : `<p class="muted">Faça simulados para acompanhar sua evolução. <a href="#/simulado">Fazer um simulado</a></p>`}</section>
      <section class="sheet"><h2>Acerto no treino por dia</h2>${trend.length >= 2 ? `<p class="muted small">Porcentagem de acerto nas questões novas de cada dia.</p>${lineChart(trend, { max: 100, yLabel: "Acerto diário em porcentagem" })}` : `<p class="muted">Aparece depois de treinar em pelo menos dois dias diferentes.</p>`}</section>
    </div>
    <div class="grid-2 block">
      <section class="sheet"><h2>Por dificuldade</h2><table class="tbl"><tbody>${[1, 2, 3]
        .map((d) => {
          const x = st.diff[d];
          return `<tr><td>${DIFF_LABEL[d][0].toUpperCase() + DIFF_LABEL[d].slice(1)}</td><td class="r">${x.n ? `${x.ok}/${x.n}` : "–"}</td><td class="barcell">${x.n ? hbar(x.ok / x.n, accClass(x.ok / x.n)) : ""}</td><td class="r">${x.n ? fmt.pct(x.ok / x.n) : ""}</td></tr>`;
        })
        .join("")}</tbody></table>
        <h2 style="margin-top:22px">Por ritmo</h2><table class="tbl"><tbody>
          <tr><td>Respondidas em menos de 1 minuto</td><td class="r">${st.fast.n ? `${st.fast.ok}/${st.fast.n}` : "–"}</td><td class="barcell">${st.fast.n ? hbar(st.fast.ok / st.fast.n, accClass(st.fast.ok / st.fast.n)) : ""}</td></tr>
          <tr><td>Respondidas com 1 minuto ou mais</td><td class="r">${st.slow.n ? `${st.slow.ok}/${st.slow.n}` : "–"}</td><td class="barcell">${st.slow.n ? hbar(st.slow.ok / st.slow.n, accClass(st.slow.ok / st.slow.n)) : ""}</td></tr>
        </tbody></table><p class="muted small">Só conta o tempo das questões feitas no treino.</p></section>
      <section class="sheet"><h2>Por prova</h2><table class="tbl"><tbody>${EXAMS.map((e) => {
        const x = st.exam[e.id];
        return `<tr><td>${esc(e.title)}</td><td class="r">${x ? `${x.ok}/${x.n}` : "–"}</td><td class="barcell">${x ? hbar(x.ok / x.n, accClass(x.ok / x.n)) : `<span class="muted small">não feita</span>`}</td></tr>`;
      }).join("")}</tbody></table></section>
    </div>
    ${ess ? `<section class="sheet block"><h2>Redação por critério</h2><p class="muted">Média das suas autoavaliações (${plural(ess.n, "redação", "redações")}), de 0 a 2 em cada critério.</p>
      <table class="tbl"><tbody>${RUBRIC.map((c) => `<tr><td>${c.title}</td><td class="r">${ess.avg[c.id] != null ? fmt.num(ess.avg[c.id], 2) : "–"}</td><td class="barcell">${ess.avg[c.id] != null ? hbar(ess.avg[c.id] / 2, accClass(ess.avg[c.id] / 2)) : ""}</td></tr>`).join("")}</tbody></table>
      ${(() => {
        const w = RUBRIC.filter((c) => ess.avg[c.id] != null).sort((a, b) => ess.avg[a.id] - ess.avg[b.id])[0];
        return w ? `<p class="insight">O critério com a menor média é <b>${w.title}</b>. ${w.hint}</p>` : "";
      })()}</section>` : ""}
    <section class="sheet block"><h2>Todos os assuntos</h2>
      <div class="table-scroll"><table class="tbl"><thead><tr><th>Assunto</th><th class="r">Questões por prova</th><th class="r">No banco</th><th class="r">Seus acertos</th><th>Aproveitamento</th></tr></thead>
      <tbody><tr class="grp"><td colspan="5">Português</td></tr>${allTopicRows("portugues")}<tr class="grp"><td colspan="5">Matemática</td></tr>${allTopicRows("matematica")}</tbody></table></div></section>
    <section class="sheet block"><h2>Caderno de erros</h2>
      ${st.wrongNow.length ? `<p>${plural(st.wrongNow.length, "questão está", "questões estão")} com a última resposta errada.</p>
        <div class="row"><button class="btn btn-pen" id="redo-all">Refazer todas</button></div>
        <ul class="review-list" style="margin-top:10px">${st.wrongNow.map((qid) => {
          const q = Q[qid];
          return `<li><a class="btn btn-quiet" style="width:100%;justify-content:flex-start" href="#/questao/${encodeURIComponent(qid)}">${esc(qLabel(q))}: ${esc(TOPIC_LABEL[q.topics[0]] || "")}</a></li>`;
        }).join("")}</ul>` : `<p class="muted">Nenhuma questão pendente. Quando você errar uma questão, ela fica guardada aqui até você acertar.</p>`}
    </section>
    ${dataSectionHTML()}
  </div>`;
  bindTips(main());
  $("#redo-all")?.addEventListener("click", () => startPractice(shuffle(st.wrongNow), "Caderno de erros", "#/desempenho"));
  bindDataSection();
}

function dataSectionHTML() {
  return `<section class="sheet block noprint"><h2>Seus dados</h2>
    <p>Todo o progresso fica guardado neste navegador, neste computador. Para não perder nada (ou levar para outro computador), exporte uma cópia de vez em quando.</p>
    <div class="row"><button class="btn" id="exp">Exportar progresso</button><label class="btn" for="imp">Importar progresso</label><input type="file" id="imp" accept=".json,application/json" hidden>
    <button class="btn btn-danger" id="wipe">Apagar todo o progresso</button></div></section>`;
}
function bindDataSection() {
  $("#exp")?.addEventListener("click", () => {
    const d = new Date().toISOString().slice(0, 10);
    download(`simulador-cpii-progresso-${d}.json`, JSON.stringify({ app: "simulador-cpii", exportedAt: Date.now(), state: S() }, null, 1));
  });
  $("#imp")?.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const st = obj.state || obj;
      if (!Array.isArray(st.attempts) || !Array.isArray(st.sims)) throw new Error("formato");
      if (!(await confirmBox("Importar progresso?", `O arquivo tem ${st.attempts.length} respostas, ${st.sims.length} simulados e ${(st.essays || []).length} redações. Ele vai substituir o progresso atual deste navegador.`, "Importar"))) return;
      Store.state = Object.assign(Store.defaults(), st);
      Store.save(true);
      applySettings();
      toast("Progresso importado.");
      render();
    } catch (err) {
      toast("Este arquivo não é um progresso exportado pelo simulador.", "warn");
    }
  });
  $("#wipe")?.addEventListener("click", async () => {
    if (!(await confirmBox("Apagar todo o progresso?", "Respostas, simulados, redações e marcações serão apagados deste navegador. Isso não pode ser desfeito. Se quiser guardar uma cópia, exporte antes.", "Apagar tudo", "btn-danger"))) return;
    const settings = S().settings;
    Store.state = Store.defaults();
    Store.state.settings = settings;
    Store.save(true);
    toast("Progresso apagado.");
    render();
  });
}

route("desempenho", viewStats);
