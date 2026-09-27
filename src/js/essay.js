// Redação: ruled essay sheet, automatic checks, self-assessment rubric and the theme generator.

const ESSAY_REQUIREMENTS = [
  "evitar cópia integral ou parcial de fragmentos dos textos motivadores;",
  "conter obrigatoriamente argumentos que sustentem suas opiniões;",
  "ter entre 20 e 25 linhas;",
  "apresentar letra legível e não conter rasuras;",
  "ter, no mínimo, três parágrafos;",
  "estar de acordo com a norma-padrão para a modalidade escrita;",
  "ser em prosa;",
  "estar de acordo com a proposta apresentada.",
];
const ESSAY_ZERO = [
  "folha completamente em branco;",
  "número insuficiente de linhas (9 linhas ou menos);",
  "letra ilegível;",
  "fuga ao tema;",
  "fuga ao tipo textual (ausência de qualquer indício de opinião);",
  "palavras de baixo calão e/ou comentários ofensivos ou que desrespeitem os direitos humanos.",
];

// ---------- line counting (same font and width as the sheet) ----------
const SHEET_EM = 34; // text width in em: about 70 characters, close to a handwritten line
let _measureCtx = null;
function essayFont() {
  const px = 16 * (S().settings.scale || 1) * 1.02;
  return { px, css: `${px}px Literata, Cambria, Georgia, serif` };
}
function wrapLines(text) {
  const { px, css } = essayFont();
  if (!_measureCtx) _measureCtx = document.createElement("canvas").getContext("2d");
  _measureCtx.font = css;
  const maxW = SHEET_EM * px;
  const out = [];
  for (const para of text.replace(/\s+$/, "").split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/(\s+)/);
    let line = "";
    for (const w of words) {
      const cand = line + w;
      if (_measureCtx.measureText(cand.replace(/\s+$/, "")).width <= maxW || !line.trim()) {
        // a single word longer than the line is broken by the browser too
        if (!line.trim() && _measureCtx.measureText(cand).width > maxW && w.trim()) {
          let chunk = "";
          for (const ch of w) {
            if (_measureCtx.measureText(chunk + ch).width > maxW) {
              out.push(chunk);
              chunk = "";
            }
            chunk += ch;
          }
          line = chunk;
        } else line = cand;
      } else {
        out.push(line.replace(/\s+$/, ""));
        line = w.trim() ? w : "";
      }
    }
    out.push(line.replace(/\s+$/, ""));
  }
  return out;
}
function countEssayLines(text) {
  if (!text || !text.trim()) return 0;
  return wrapLines(text).length;
}
function paragraphsOf(text) {
  return (text || "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
function wordsOf(text) {
  return (text || "").match(/[\p{L}\p{N}]+(?:[-'][\p{L}]+)*/gu) || [];
}

function folhaHTML(id, value) {
  const nums = Array.from({ length: 30 }, (_, i) => `<span>${i + 1}</span>`).join("");
  return `<div class="folha-wrap" style="overflow-x:auto"><div class="folha" data-folha="${id}" style="width:calc(${SHEET_EM * 1.02}rem + 2.6rem + 31px)">
    <div class="folha-nums" aria-hidden="true">${nums}</div>
    <textarea rows="30" spellcheck="false" aria-label="Folha de redação, escreva seu texto aqui" placeholder="Escreva aqui. Cada linha comporta cerca de 70 caracteres, parecido com uma linha escrita à mão. Comece cada parágrafo com um recuo (tecla Tab) e não pule linhas.">${esc(value || "")}</textarea></div></div>
    <div class="folha-status" aria-live="polite"></div>`;
}
function bindFolha(folha, onChange) {
  const ta = folha.querySelector("textarea");
  const nums = folha.querySelector(".folha-nums");
  const status = folha.closest(".folha-wrap").nextElementSibling;
  const lh = () => parseFloat(getComputedStyle(ta).lineHeight);
  const refresh = () => {
    const v = ta.value;
    const n = countEssayLines(v);
    const total = Math.max(30, n + 2);
    if (nums.children.length !== total) nums.innerHTML = Array.from({ length: total }, (_, i) => `<span>${i + 1}</span>`).join("");
    [...nums.children].forEach((s, i) => {
      s.classList.toggle("min", i + 1 === INFO.essay_lines_min || i + 1 === INFO.essay_lines_max);
      s.classList.toggle("over", i + 1 > INFO.essay_lines_max && i < n);
    });
    ta.style.height = `calc(${total} * var(--lh) + 20px)`;
    const paras = paragraphsOf(v).length;
    const words = wordsOf(v).length;
    const min = INFO.essay_lines_min || 20, max = INFO.essay_lines_max || 25;
    const lineCls = n >= min && n <= max ? "ok" : n ? "bad" : "";
    const lineMsg = !n ? "" : n < min ? ` (faltam ${min - n})` : n > max ? ` (passou ${n - max}; o excesso é desconsiderado)` : " (dentro do limite)";
    status.innerHTML = `<span class="${lineCls}"><b>${n}</b> ${n === 1 ? "linha" : "linhas"}${lineMsg}</span><span class="${paras >= 3 ? "ok" : paras ? "bad" : ""}"><b>${paras}</b> ${paras === 1 ? "parágrafo" : "parágrafos"}${paras && paras < 3 ? " (mínimo 3)" : ""}</span><span class="muted">${words} palavras</span>`;
  };
  ta.addEventListener("input", () => {
    refresh();
    onChange(ta.value);
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText("    ", s, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  refresh();
  void lh;
}

// ---------- automatic checks ----------
const CONNECTIVES = ["além disso", "ademais", "também", "portanto", "logo", "assim", "dessa forma", "desse modo", "sendo assim", "por isso", "pois", "porque", "visto que", "já que", "uma vez que", "no entanto", "entretanto", "contudo", "todavia", "porém", "mas", "embora", "apesar de", "ainda que", "por outro lado", "em primeiro lugar", "primeiramente", "em segundo lugar", "por fim", "finalmente", "em suma", "em síntese", "conclui-se", "por exemplo", "como", "ou seja", "isto é", "consequentemente", "de modo que", "a fim de", "para que", "enquanto", "quando", "caso", "se"];
const STRONG_CONNECTIVES = CONNECTIVES.filter((c) => !["como", "mas", "se", "quando", "enquanto", "caso", "também", "pois", "porque", "assim", "logo"].includes(c));
// Unicode-aware whole-word pattern (\b does not understand accented letters).
const wordRe = (alts) => new RegExp(`(^|[^\\p{L}])(${alts})(?=[^\\p{L}]|$)`, "giu");
const INFORMAL = [
  [wordRe("vc|vcs"), "vc"],
  [wordRe("pq"), "pq"],
  [wordRe("tb|tbm"), "tb"],
  [wordRe("né"), "né"],
  [wordRe("pra|pro|pras|pros"), "pra/pro"],
  [wordRe("tá|tô|tava"), "tá/tô"],
  [wordRe("a gente"), "a gente"],
  [wordRe("tipo assim"), "tipo assim"],
  [wordRe("daí|aí"), "daí/aí"],
  [wordRe("coisa|coisas"), "coisa"],
  [wordRe("eu acho|acho que"), "eu acho"],
  [wordRe("muito muito"), "muito muito"],
  [wordRe("etc"), "etc."],
  [/!{2,}|\?{2,}/g, "pontuação repetida"],
];
const STOP = new Set("a o e é de da do das dos que em no na nos nas um uma uns umas para por com não se os as ao aos à às mais como mas foi ser são seu sua seus suas ele ela eles elas isso esse essa este esta isto também muito pelo pela pelos pelas já há ou entre quando sobre até sem nem mesmo onde cada todo toda todos todas outro outra outros outras sempre pode podem forma modo porque pois assim então ainda apenas quem qual quais seja sejam está estão tem têm ter sido estar pessoas pessoa sociedade".split(" "));
const norm = (w) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function findCopied(text, source, n = 7) {
  if (!source) return [];
  const sw = wordsOf(source).map(norm);
  const grams = new Set();
  for (let i = 0; i + n <= sw.length; i++) grams.add(sw.slice(i, i + n).join(" "));
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+(?:[-'][\p{L}]+)*/gu)];
  const tw = tokens.map((m) => norm(m[0]));
  const hit = new Array(tw.length).fill(false);
  for (let i = 0; i + n <= tw.length; i++) if (grams.has(tw.slice(i, i + n).join(" "))) for (let k = i; k < i + n; k++) hit[k] = true;
  const ranges = [];
  for (let i = 0; i < tw.length; i++) {
    if (!hit[i]) continue;
    let j = i;
    while (j + 1 < tw.length && hit[j + 1]) j++;
    ranges.push([tokens[i].index, tokens[j].index + tokens[j][0].length]);
    i = j;
  }
  return ranges;
}
function analyzeEssay(text, ctx) {
  const lines = countEssayLines(text);
  const paras = paragraphsOf(text);
  const words = wordsOf(text);
  const low = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  const conns = CONNECTIVES.filter((c) => new RegExp(`(^|[^\\p{L}])${c}([^\\p{L}]|$)`, "u").test(low));
  const strong = conns.filter((c) => STRONG_CONNECTIVES.includes(c));
  const informal = INFORMAL.filter(([re]) => {
    re.lastIndex = 0;
    return re.test(text);
  }).map(([, l]) => l);
  const freq = {};
  for (const w of words) {
    const k = w.toLowerCase();
    if (k.length < 5 || STOP.has(k)) continue;
    freq[k] = (freq[k] || 0) + 1;
  }
  const repeated = Object.entries(freq).filter(([, c]) => c >= 4).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const longS = sentences.filter((s) => wordsOf(s).length > 45).length;
  const copied = findCopied(text, ctx && ctx.sourceText);
  const copiedWords = copied.reduce((n, [a, b]) => n + wordsOf(text.slice(a, b)).length, 0);
  const firstPerson = (text.match(/(^|[^\p{L}])(eu|meu|minha|meus|minhas|acho|penso|acredito)(?=[^\p{L}]|$)/giu) || []).length;
  const blankLines = (text.trim().match(/\n[ \t]*(?=\n)/g) || []).length;
  return { lines, paras: paras.length, blankLines, words: words.length, conns, strong, informal, repeated, longS, copied, copiedWords, firstPerson };
}
function checksHTML(a) {
  const min = INFO.essay_lines_min || 20, max = INFO.essay_lines_max || 25;
  const items = [];
  const add = (kind, html) => items.push(`<li><span class="ico ${kind}">${kind === "ok" ? "✓" : kind === "bad" ? "✕" : kind === "warn" ? "!" : "i"}</span><span>${html}</span></li>`);
  if (a.lines <= 9) add("bad", `<b>${plural(a.lines, "linha", "linhas")}.</b> Com 9 linhas ou menos, a redação recebe zero.`);
  else if (a.lines < min) add("bad", `<b>${a.lines} linhas.</b> O mínimo é ${min}. Abaixo disso, o texto perde pontos e pode ser desconsiderado.`);
  else if (a.lines > max) add("warn", `<b>${a.lines} linhas.</b> O máximo é ${max}; o que passar disso não é lido.`);
  else add("ok", `<b>${a.lines} linhas</b>, dentro do limite de ${min} a ${max}.`);
  if (a.blankLines) add("warn", `<b>${plural(a.blankLines, "linha em branco", "linhas em branco")} entre os parágrafos.</b> Na folha oficial não se pula linha: marque o parágrafo com um recuo no começo (tecla Tab). As linhas puladas também contam no total.`);
  if (a.paras >= 3) add("ok", `<b>${a.paras} parágrafos.</b> A prova exige pelo menos três.`);
  else add("bad", `<b>${plural(a.paras, "parágrafo", "parágrafos")}.</b> A prova exige pelo menos três (introdução, desenvolvimento e conclusão).`);
  if (a.copiedWords >= 7) add("bad", `<b>Trechos copiados dos textos motivadores</b> (${a.copiedWords} palavras, marcadas em vermelho no texto). A prova pede para evitar cópia; trechos copiados não contam como seus.`);
  else add("ok", "Nenhum trecho longo copiado dos textos motivadores.");
  if (a.strong.length >= 3) add("ok", `<b>Conectivos variados:</b> ${a.strong.slice(0, 8).map(esc).join(", ")}.`);
  else add("warn", `<b>Poucos conectivos entre as ideias</b>${a.strong.length ? ` (${a.strong.map(esc).join(", ")})` : ""}. Experimente: além disso, no entanto, portanto, dessa forma, por outro lado, em suma.`);
  if (a.repeated.length) add("warn", `<b>Palavras repetidas:</b> ${a.repeated.map(([w, c]) => `${esc(w)} (${c}x)`).join(", ")}. Troque algumas por sinônimos ou pronomes.`);
  if (a.informal.length) add("warn", `<b>Marcas de linguagem informal:</b> ${a.informal.map(esc).join(", ")}. A prova pede a norma-padrão.`);
  if (a.firstPerson >= 3) add("info", `Você usou a primeira pessoa ${a.firstPerson} vezes. Não é proibido, mas um texto mais impessoal costuma soar mais convincente.`);
  if (a.longS) add("warn", `${plural(a.longS, "frase muito longa", "frases muito longas")} (mais de 45 palavras). Frases longas aumentam o risco de erros de pontuação e concordância.`);
  return `<ul class="checks">${items.join("")}</ul>`;
}
function essayWithMarks(text, copied) {
  let out = "", last = 0;
  for (const [a, b] of copied) {
    out += esc(text.slice(last, a)) + `<mark class="copy" title="Trecho igual ao texto motivador">${esc(text.slice(a, b))}</mark>`;
    last = b;
  }
  return out + esc(text.slice(last));
}

// ---------- rubric ----------
const RUBRIC = [
  { id: "tema", title: "Tema e proposta", hint: "O texto discute exatamente o que foi pedido?", levels: [
    [2, "Discute o tema completo, com o recorte pedido, sem se desviar."],
    [1.5, "Discute o tema, mas algum trecho se afasta dele."],
    [1, "Fala do assunto geral e tangencia o recorte pedido."],
    [0.5, "Relação fraca com o tema; boa parte do texto foge dele."],
    [0, "Não trata do tema (fuga ao tema zera a redação)."]] },
  { id: "argumentacao", title: "Opinião e argumentos", hint: "Há uma tese clara defendida com argumentos?", levels: [
    [2, "Tese clara e pelo menos dois argumentos bem desenvolvidos, com exemplos, causas ou consequências."],
    [1.5, "Tese clara, argumentos pertinentes mas pouco desenvolvidos."],
    [1, "Tese vaga ou argumentos apenas listados, sem explicação."],
    [0.5, "Predomina narração ou resumo dos textos, com pouca opinião."],
    [0, "Não defende nenhuma opinião (fuga ao tipo textual zera a redação)."]] },
  { id: "estrutura", title: "Estrutura e parágrafos", hint: "Introdução, desenvolvimento e conclusão bem divididos?", levels: [
    [2, "Introdução com a tese, desenvolvimento em parágrafos equilibrados e conclusão que retoma a tese."],
    [1.5, "Estrutura completa, com pequenos desequilíbrios entre os parágrafos."],
    [1, "Falta uma das partes ou os parágrafos estão mal divididos."],
    [0.5, "Texto quase em bloco único ou sem conclusão."],
    [0, "Sem organização reconhecível."]] },
  { id: "coesao", title: "Coesão e coerência", hint: "As ideias se ligam bem, sem repetições e contradições?", levels: [
    [2, "Conectivos variados e adequados, retomadas sem repetição, nenhuma contradição."],
    [1.5, "Boa ligação entre as ideias, com poucas falhas."],
    [1, "Repetições frequentes ou conectivos usados com sentido errado."],
    [0.5, "Muitas falhas de ligação, que atrapalham a leitura."],
    [0, "Texto confuso ou contraditório."]] },
  { id: "norma", title: "Norma-padrão", hint: "Ortografia, acentuação, concordância, regência e pontuação.", levels: [
    [2, "No máximo dois desvios leves."],
    [1.5, "Até cinco desvios, sem prejudicar a leitura."],
    [1, "Desvios frequentes, mas o texto ainda é compreensível."],
    [0.5, "Muitos desvios, que prejudicam a leitura."],
    [0, "Desvios em quase todas as frases."]] },
];
const ZERO_ITEMS = [
  ["fuga", "Fugiu totalmente do tema"],
  ["tipo", "Não defendeu nenhuma opinião (fuga ao tipo textual)"],
  ["linhas", "Tem 9 linhas ou menos"],
  ["ofensa", "Tem palavras de baixo calão ou desrespeita os direitos humanos"],
  ["ident", "Tem nome, assinatura ou outra identificação"],
];

// essay: {text, rubric, zero}; ctx: {theme, sourceText}; onSave({rubric, zero, score})
function renderEssayEval(container, essay, ctx, onSave) {
  const a = analyzeEssay(essay.text || "", ctx);
  const rub = Object.assign({}, essay.rubric || {});
  const zero = Object.assign({}, essay.zero || {});
  if (a.lines <= 9) zero.linhas = true;
  container.innerHTML = `<section class="sheet block">
    <h2>Avaliação da redação</h2>
    ${ctx.theme ? `<p><b>Tema:</b> ${esc(stripTags(ctx.theme))}</p>` : ""}
    <div class="grid-2">
      <div><h3>Seu texto</h3><div class="essay-view">${essay.text ? essayWithMarks(essay.text, a.copied) : `<span class="muted">Texto vazio.</span>`}</div>
        <div class="row noprint" style="margin-top:10px"><button class="btn btn-sm" data-print>Imprimir para um professor corrigir</button></div></div>
      <div><h3>Verificação automática</h3><p class="muted small">Conferências que o computador consegue fazer sozinho. Elas não substituem a leitura de um professor.</p>${checksHTML(a)}</div>
    </div>
    <h3 style="margin-top:24px">Autoavaliação</h3>
    <p class="muted small">Grade baseada no edital e nas instruções da prova. O CPII não divulga a grade oficial de correção, então use a nota como referência. Releia seu texto com calma antes de marcar.</p>
    <div class="rubric">${RUBRIC.map((c) => `<div class="crit"><h4>${c.title}</h4><div class="muted small">${c.hint}</div><div class="levels">${c.levels
      .map(([p, d]) => `<label><input type="radio" name="r-${c.id}" value="${p}" ${rub[c.id] === p ? "checked" : ""}><span class="pts">${fmt.num(p)}</span><span>${d}</span></label>`)
      .join("")}</div></div>`).join("")}
      <div class="crit"><h4>Motivos de nota zero</h4><div class="muted small">Se algum destes acontecer, a redação vale zero e o candidato é eliminado.</div><div class="stack" style="margin-top:10px">${ZERO_ITEMS.map(
        ([k, l]) => `<label class="chk"><input type="checkbox" data-zero="${k}" ${zero[k] ? "checked" : ""}> ${l}</label>`
      ).join("<br>")}</div></div>
    </div>
    <div class="row" style="margin-top:16px"><span id="rub-total" class="lead"></span><span class="spacer" style="flex:1"></span><button class="btn btn-primary" id="rub-save">Salvar avaliação</button></div>
  </section>`;
  const total = () => {
    const anyZero = Object.values(zero).some(Boolean);
    const all = RUBRIC.every((c) => rub[c.id] != null);
    const sum = RUBRIC.reduce((s, c) => s + (rub[c.id] || 0), 0);
    return { anyZero, all, score: anyZero ? 0 : sum };
  };
  const paint = () => {
    const t = total();
    $("#rub-total", container).innerHTML = t.anyZero ? `Nota: <b>0</b> (motivo de zero marcado)` : t.all ? `Nota: <b>${fmt.num(t.score, 2)}</b> de 10` : `Marque um nível em cada critério (${RUBRIC.filter((c) => rub[c.id] != null).length} de ${RUBRIC.length}).`;
  };
  container.addEventListener("change", (e) => {
    const r = e.target.closest('input[type="radio"]');
    if (r) rub[r.name.slice(2)] = +r.value;
    const z = e.target.closest("[data-zero]");
    if (z) zero[z.dataset.zero] = z.checked;
    paint();
  });
  $("#rub-save", container).addEventListener("click", () => {
    const t = total();
    if (!t.anyZero && !t.all) return toast("Marque um nível em cada critério ou um motivo de zero.");
    onSave({ rubric: rub, zero, score: t.score, analysis: { lines: a.lines, paras: a.paras, copiedWords: a.copiedWords } });
  });
  container.querySelector("[data-print]").addEventListener("click", () => printEssay(essay.text, ctx.theme));
  paint();
}

function printEssay(text, theme) {
  const w = window.open("", "_blank");
  if (!w) return toast("O navegador bloqueou a janela de impressão.");
  const lines = wrapLines(text || "");
  const rows = Array.from({ length: Math.max(30, lines.length) }, (_, i) => `<tr><td class="n">${i + 1}</td><td>${esc(lines[i] || "")}</td></tr>`).join("");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Redação</title><style>
    body{font-family:Georgia,serif;margin:24px;color:#000} h1{font-size:16px;margin:0 0 4px} p{font-size:13px;margin:0 0 12px}
    table{border-collapse:collapse;width:100%} td{border-bottom:1px solid #999;height:26px;font-size:14px;padding:0 6px}
    td.n{width:28px;color:#666;font-size:11px;text-align:right;border-right:1px solid #999}</style></head><body>
    <h1>Folha de redação (Simulador CPII)</h1><p>${theme ? "Tema: " + esc(stripTags(theme)) : ""}</p><table>${rows}</table>
    <p style="margin-top:16px">Nota do corretor: ______ de 10</p><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

// ---------- theme generator & essay pages ----------
function themeProposalHTML(t) {
  return `<div class="proposal">
    <p>${t.intro || ""}</p>
    <p class="tema">${esc(t.theme)}</p>
    ${(t.motivating_texts || []).map((m) => `<div class="mtext"><div class="mt-label">${esc(m.label || "")}</div>${m.title ? `<div class="mt-title">${esc(m.title)}</div>` : ""}${m.body_html || ""}${m.source_note ? `<p class="mt-src">${esc(m.source_note)}</p>` : ""}</div>`).join("")}
    <h3>IMPORTANTE: seu texto deverá:</h3>${ruleListHTML(ESSAY_REQUIREMENTS)}
    <h3>Observação final: a nota zero será atribuída às redações que apresentarem:</h3>${ruleListHTML(ESSAY_ZERO)}
  </div>`;
}
function themeHintsHTML(t) {
  const list = (a) => `<ul>${(a || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<div class="hints">
    ${(t.guiding_questions || []).length ? `<h3>Para pensar antes de escrever</h3>${list(t.guiding_questions)}` : ""}
    ${(t.argument_paths || []).length ? `<details><summary>Caminhos possíveis de argumentação</summary>${list(t.argument_paths)}</details>` : ""}
    ${(t.repertoire || []).length ? `<details><summary>Repertório que pode ajudar</summary><ul>${t.repertoire.map((r) => `<li><b>${esc(r.ref)}</b>: ${esc(r.how)}</li>`).join("")}</ul></details>` : ""}
    ${(t.pitfalls || []).length ? `<details><summary>Cuidados para não fugir do tema</summary>${list(t.pitfalls)}</details>` : ""}
  </div>`;
}
function essayTabs(active) {
  const tabs = [["redacao", "Gerar tema"], ["redacao/provas", "Temas das provas"], ["redacao/minhas", "Minhas redações"]];
  return `<nav class="tabs" aria-label="Redação">${tabs.map(([h, l]) => `<a href="#/${h}" ${active === h ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
}

function pickTheme(f) {
  let pool = THEMES.filter((t) => (!f.axis || t.axis === f.axis) && (f.genre === "all" || t.genre === "dissertativo-argumentativo") && (!f.diff || t.difficulty === +f.diff));
  if (!pool.length) return null;
  const used = new Set(S().essays.map((e) => e.themeId));
  const fresh = pool.filter((t) => !used.has(t.id) && t.id !== S().currentTheme);
  if (fresh.length) pool = fresh;
  return pool[Math.floor(Math.random() * pool.length)];
}

function viewEssayGen() {
  const f = Object.assign({ axis: "", genre: "diss", diff: "" }, S().themeFilters || {});
  let t = THEMES.find((x) => x.id === S().currentTheme);
  main().innerHTML = `<div class="page">
    <h1>Redação</h1>${essayTabs("redacao")}
    ${THEMES.length ? `<section class="sheet"><div class="filters" id="tf">
      <label class="field">Eixo<select name="axis"><option value="">Todos os eixos</option>${AXES.map((a) => `<option value="${a.id}" ${f.axis === a.id ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select></label>
      <label class="field">Formato<select name="genre"><option value="diss" ${f.genre === "diss" ? "selected" : ""}>Dissertativo-argumentativo (formato atual)</option><option value="all" ${f.genre === "all" ? "selected" : ""}>Incluir cartas argumentativas (formato de provas antigas)</option></select></label>
      <label class="field">Dificuldade<select name="diff"><option value="">Todas</option><option value="1" ${f.diff === "1" ? "selected" : ""}>Acessível</option><option value="2" ${f.diff === "2" ? "selected" : ""}>Média</option><option value="3" ${f.diff === "3" ? "selected" : ""}>Desafiadora</option></select></label>
      <button class="btn btn-primary" id="draw">${t ? "Sortear outro tema" : "Sortear tema"}</button>
      <span class="muted small">${THEMES.length} temas no banco, no estilo das provas do CPII.</span></div></section>` : `<section class="sheet empty"><p>O banco de temas ainda não foi incluído nesta versão do simulador. Use os temas das provas oficiais.</p><a class="btn" href="#/redacao/provas">Ver temas das provas</a></section>`}
    <div id="theme-out">${t ? `<div class="grid-2 block" style="grid-template-columns:1.5fr 1fr;align-items:start">
      <section class="sheet"><div class="row" style="justify-content:space-between"><span class="chip chip-pen">${esc(t.axis_label || "")}</span><span class="chip">${esc(t.genre)}</span></div>
        <h2 class="part-title" style="margin-top:14px">Redação</h2>${themeProposalHTML(t)}
        <div class="quick"><a class="btn btn-primary btn-lg" href="#/redacao/escrever/t/${encodeURIComponent(t.id)}">Escrever esta redação</a></div></section>
      <section class="sheet">${themeHintsHTML(t)}<p class="muted small" style="margin-top:14px">Os textos motivadores foram escritos para o simulador. Tente pensar sozinho antes de abrir as dicas.</p></section></div>` : THEMES.length ? `<section class="sheet empty block"><p>Sorteie um tema no estilo do CPII. Cada tema vem com textos motivadores, perguntas para pensar e dicas de repertório.</p></section>` : ""}</div>
  </div>`;
  const tf = $("#tf");
  if (tf) {
    tf.addEventListener("change", () => {
      const o = {};
      tf.querySelectorAll("select").forEach((s) => (o[s.name] = s.value));
      S().themeFilters = o;
      Store.save();
    });
    $("#draw").addEventListener("click", () => {
      const nt = pickTheme(Object.assign({ axis: "", genre: "diss", diff: "" }, S().themeFilters || {}));
      if (!nt) return toast("Nenhum tema com esses filtros.");
      S().currentTheme = nt.id;
      Store.save();
      viewEssayGen();
    });
  }
}

function viewEssayOfficial() {
  const list = EXAMS.filter((e) => e.official && e.redacao);
  main().innerHTML = `<div class="page">
    <h1>Redação</h1>${essayTabs("redacao/provas")}
    <p class="lead">Os temas que já caíram. Na prova, os textos de Língua Portuguesa servem de textos motivadores para a redação.</p>
    <div class="stack">${list.map((e) => `<section class="sheet"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(e.title)}</h2><span class="chip">${esc(e.redacao.genre || "")}</span></div>
      <p class="proposal-theme" style="text-align:left;margin:10px 0">${esc(stripTags(e.redacao.theme || ""))}</p>
      <div class="row"><a class="btn btn-primary" href="#/redacao/escrever/p/${e.id}">Escrever sobre este tema</a><a class="btn" href="#/redacao/proposta/${e.id}">Ler a proposta e os textos</a></div></section>`).join("")}</div>
  </div>`;
}

function viewEssayOfficialProposal(examId) {
  const e = EXAM[examId];
  if (!e || !e.redacao) return go("#/redacao/provas");
  main().innerHTML = `<div class="page">
    <p><a href="#/redacao/provas">Temas das provas</a></p>
    <div class="qwrap">${readerHTML(e, e.texts.map((t) => t.id))}
      <section class="sheet"><h1>${esc(e.title)}: redação</h1><div class="proposal">${e.redacao.prompt_html}
        ${(e.redacao.requirements || []).length ? `<h3>${ruleListTitle(e.redacao.requirements)}</h3>${ruleListHTML(e.redacao.requirements)}` : ""}
        ${(e.redacao.zero_criteria || []).length ? `<h3>Nota zero para redações com:</h3>${ruleListHTML(e.redacao.zero_criteria)}` : ""}</div>
        <div class="quick"><a class="btn btn-primary" href="#/redacao/escrever/p/${e.id}">Escrever sobre este tema</a></div>
        ${examNotesHTML(e)}</section></div></div>`;
  bindReader(main());
  enhanceContent(main());
}

function essaySource(src, id) {
  if (src === "t") {
    const t = THEMES.find((x) => x.id === id);
    if (!t) return null;
    return { theme: t.theme, genre: t.genre, proposal: themeProposalHTML(t), hints: themeHintsHTML(t), sourceText: (t.motivating_texts || []).map((m) => stripTags(m.body_html)).join("\n") };
  }
  const e = EXAM[id];
  if (!e || !e.redacao) return null;
  return {
    theme: e.redacao.theme,
    genre: e.redacao.genre,
    proposal: `<div class="proposal">${e.redacao.prompt_html}${(e.redacao.requirements || []).length ? `<h3>${ruleListTitle(e.redacao.requirements)}</h3>${ruleListHTML(e.redacao.requirements)}` : ""}</div>`,
    exam: e,
    sourceText: (e.texts || []).map((t) => (t.lines || []).map(stripTags).join(" ")).join("\n"),
  };
}

function viewEssayWrite(src, id) {
  const ctx = essaySource(src, id);
  if (!ctx) return go("#/redacao");
  let d = S().draft;
  if (!d || d.src !== src || d.id !== id) {
    d = S().draft = { src, id, text: "", startedAt: Date.now(), timerMin: 0, timerStart: null };
    Store.save();
  }
  const withTexts = ctx.exam ? readerHTML(ctx.exam, ctx.exam.texts.map((t) => t.id)) : "";
  main().innerHTML = `<div class="page">
    <p><a href="#/redacao">Redação</a></p>
    <div class="grid-2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">
      <div class="stack"><details class="sheet" open><summary><b>Proposta</b></summary><div style="margin-top:12px">${ctx.proposal}</div></details>
        ${withTexts ? `<details class="sheet"><summary><b>Textos da prova (motivadores)</b></summary><div style="margin-top:12px">${withTexts}</div></details>` : ""}
        ${ctx.hints ? `<details class="sheet"><summary><b>Dicas</b></summary><div style="margin-top:12px">${ctx.hints}</div></details>` : ""}</div>
      <section class="sheet">
        <div class="row" style="justify-content:space-between"><h2 style="margin:0">Folha de redação</h2>
          <span class="row"><span id="etimer" class="num lead"></span><select id="tsel" aria-label="Cronômetro"><option value="0">Sem cronômetro</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="80">80 minutos</option></select></span></div>
        <p class="muted small">Na prova, a redação divide as 3 horas com as 20 questões. Uma boa meta é escrever em até 60 minutos, com o rascunho.</p>
        ${folhaHTML("w", d.text)}
        <div class="row" style="margin-top:14px"><button class="btn btn-primary" id="finish">Terminar e avaliar</button><button class="btn btn-danger" id="clear">Apagar texto</button><span class="muted small">O texto é salvo automaticamente neste navegador.</span></div>
      </section></div></div>`;
  bindReader(main());
  const folha = $(".folha");
  bindFolha(folha, (v) => {
    d.text = v;
    Store.save();
  });
  const tsel = $("#tsel");
  tsel.value = String(d.timerMin || 0);
  const tick = () => {
    const el = $("#etimer");
    if (!el) return;
    if (!d.timerMin || !d.timerStart) {
      el.textContent = "";
      return;
    }
    const rem = d.timerMin * 60000 - (Date.now() - d.timerStart);
    el.textContent = rem > 0 ? fmt.clock(rem) : "Tempo esgotado";
    el.style.color = rem < 5 * 60000 ? "var(--bad-ink)" : "";
  };
  tsel.addEventListener("change", () => {
    d.timerMin = +tsel.value;
    d.timerStart = d.timerMin ? Date.now() : null;
    Store.save();
    tick();
  });
  const iv = setInterval(tick, 1000);
  tick();
  onCleanup(() => clearInterval(iv));
  $("#clear").addEventListener("click", async () => {
    if (!(await confirmBox("Apagar o texto?", "O texto da folha será apagado.", "Apagar", "btn-danger"))) return;
    d.text = "";
    Store.save();
    viewEssayWrite(src, id);
  });
  $("#finish").addEventListener("click", () => {
    if (!d.text.trim()) return toast("A folha está vazia.");
    const rec = { id: uid(), src, ref: id, themeId: src === "t" ? id : null, examId: src === "p" ? id : null, theme: ctx.theme, genre: ctx.genre, text: d.text, lines: countEssayLines(d.text), startedAt: d.startedAt, finishedAt: Date.now(), rubric: null, zero: null, score: null };
    S().essays.push(rec);
    S().draft = null;
    Store.save(true);
    go(`#/redacao/ver/${rec.id}`);
  });
}

function allEssays() {
  const list = S().essays.map((e) => ({ ...e, kind: "livre" }));
  for (const s of S().sims) if (s.essay && s.essay.text) list.push({ id: "sim:" + s.id, simId: s.id, theme: s.essay.theme, text: s.essay.text, lines: s.essay.lines, finishedAt: s.finishedAt, score: s.essayScore, rubric: s.essayRubric, kind: "simulado" });
  return list.sort((a, b) => b.finishedAt - a.finishedAt);
}

function viewEssayMine() {
  const list = allEssays();
  main().innerHTML = `<div class="page">
    <h1>Redação</h1>${essayTabs("redacao/minhas")}
    ${list.length ? `<section class="sheet"><div class="table-scroll"><table class="tbl"><thead><tr><th>Data</th><th>Tema</th><th>Origem</th><th class="r">Linhas</th><th class="r">Nota</th><th></th></tr></thead><tbody>
      ${list.map((e) => `<tr><td>${fmt.date(e.finishedAt)}</td><td>${esc(stripTags(e.theme || "").slice(0, 90))}</td><td>${e.kind === "simulado" ? "simulado" : "treino"}</td><td class="r">${e.lines}</td><td class="r">${e.score != null ? fmt.num(e.score, 2) : "a avaliar"}</td>
      <td><a href="${e.kind === "simulado" ? `#/simulado/resultado/${e.simId}` : `#/redacao/ver/${e.id}`}">Abrir</a></td></tr>`).join("")}</tbody></table></div></section>`
      : `<section class="sheet empty"><p>Você ainda não escreveu nenhuma redação. Sorteie um tema e escreva na folha pautada: o simulador confere linhas, parágrafos e cópias dos textos.</p><a class="btn btn-primary" href="#/redacao">Sortear tema</a></section>`}
  </div>`;
}

function viewEssayView(id) {
  const rec = S().essays.find((e) => e.id === id);
  if (!rec) return go("#/redacao/minhas");
  const ctx = essaySource(rec.src, rec.ref) || { theme: rec.theme, sourceText: "" };
  main().innerHTML = `<div class="page"><p><a href="#/redacao/minhas">Minhas redações</a></p>
    <section class="sheet"><h1>Redação de ${fmt.date(rec.finishedAt)}</h1>
      <div class="row"><button class="btn" id="rewrite">Reescrever a partir deste texto</button><button class="btn btn-danger" id="del">Excluir</button></div></section>
    <div id="eval"></div></div>`;
  renderEssayEval($("#eval"), rec, { theme: rec.theme, sourceText: ctx.sourceText }, (res) => {
    rec.rubric = res.rubric;
    rec.zero = res.zero;
    rec.score = res.score;
    Store.save(true);
    toast(`Avaliação salva: nota ${fmt.num(res.score, 2)}.`);
  });
  $("#rewrite").addEventListener("click", () => {
    S().draft = { src: rec.src, id: rec.ref, text: rec.text, startedAt: Date.now(), timerMin: 0, timerStart: null };
    Store.save();
    go(`#/redacao/escrever/${rec.src}/${encodeURIComponent(rec.ref)}`);
  });
  $("#del").addEventListener("click", async () => {
    if (!(await confirmBox("Excluir esta redação?", "Ela sairá do seu histórico.", "Excluir", "btn-danger"))) return;
    S().essays = S().essays.filter((e) => e.id !== id);
    Store.save(true);
    go("#/redacao/minhas");
  });
}

route("redacao", viewEssayGen);
route("redacao/provas", viewEssayOfficial);
route("redacao/proposta/:exam", viewEssayOfficialProposal);
route("redacao/minhas", viewEssayMine);
route("redacao/escrever/:src/:id", viewEssayWrite);
route("redacao/ver/:id", viewEssayView);
