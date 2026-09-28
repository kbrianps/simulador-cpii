// Shared rendering pieces: support texts (caderno), questions, explanations.

const LETTERS = ["A", "B", "C", "D"];

function textHTML(exam, t) {
  const hl = new Set(S().highlights[`${exam.id}:${t.id}`] || []);
  const paras = new Set(t.para_starts || []);
  const stanzas = new Set(t.stanza_breaks || []);
  // "none": the exam printed no numbers, but questions still cite lines, so show faint ones every 5.
  const faintOk = t.numbering !== "none" || ((t.lines || []).length >= 10 && t.kind !== "outro"); // posters need no numbers
  const numOf = (n) => (!faintOk ? "" : t.numbering === "all" || n % 5 === 0 ? String(n).padStart(2, "0") : "");
  const faint = t.numbering === "none" ? " faint" : "";
  const lines = (t.lines || [])
    .map((ln, i) => {
      const n = i + 1;
      const cls = ["ln", paras.has(n) ? "p" : "", stanzas.has(n) ? "stanza" : "", hl.has(n) ? "hl" : ""].filter(Boolean).join(" ");
      const num = numOf(n);
      // An explicit <br> inside a printed line (e.g. an unnumbered "[...]") starts a flush-left sub-row.
      const [first, ...rest] = String(ln).split(/<br\s*\/?>/i);
      const sub = rest
        .map((part) => `<div class="ln sub${hl.has(n) ? " hl" : ""}" data-ln="${n}"><span class="n" aria-hidden="true"></span><span class="t">${part || "&nbsp;"}</span></div>`)
        .join("");
      const title = faint && num ? ' title="Numeração acrescentada pelo simulador"' : "";
      return `<div class="${cls}" data-ln="${n}"><span class="n${faint}" aria-hidden="true"${title}>${num}</span><span class="t">${first}</span></div>${sub}`;
    })
    .join("");
  const imgs = (t.images || []).map((im) => `<figure class="text-img"><img src="${im.src}" alt="${esc(im.alt)}"></figure>`).join("");
  const numbered = (t.lines || []).some((l) => /<sup>\s*\d+\s*<\/sup>/.test(l));
  const tag = numbered ? "ol" : "ul";
  const gloss = (t.glossary || []).length
    ? `<div class="glossary"><b>Glossário</b><${tag}>${t.glossary
        .map((g) => `<li><b>${String(g.term).replace(/[:\s]+$/, "")}</b>: ${String(g.def).replace(/[;\s]+$/, "")}</li>`)
        .join("")}</${tag}></div>`
    : "";
  // Unnumbered texts (posters, captions) wrap freely instead of shrinking to fit.
  const free = t.numbering === "none" && !faintOk ? " data-free" : "";
  return `<section class="text-block" data-text="${esc(t.id)}" data-exam="${esc(exam.id)}"${free}>
    <div class="text-label">${esc(t.label || t.id)}</div>
    ${t.epigraph ? `<p class="text-epi">${t.epigraph}</p>` : ""}
    ${t.title ? `<div class="text-title">${t.title}</div>` : ""}
    ${t.subtitle ? `<div class="text-sub">${t.subtitle}</div>` : ""}
    ${t.author ? `<div class="text-author">${t.author}</div>` : ""}
    ${imgs}
    ${lines ? `<div class="lines ${t.kind === "poema" ? "poem" : ""}">${lines}</div>` : ""}
    ${t.source ? `<div class="text-source">${t.source}</div>` : ""}
    ${gloss}
  </section>`;
}

// Reader panel with tabs when a question depends on several texts.
function readerHTML(exam, textIds) {
  const texts = textIds.map((id) => exam.textById[id]).filter(Boolean);
  if (!texts.length) return "";
  const tabs =
    texts.length > 1
      ? `<div class="reader-tabs" role="tablist">${texts
          .map((t, i) => `<button role="tab" aria-selected="${i === 0}" data-tab="${esc(t.id)}">${esc(t.label || t.id)}</button>`)
          .join("")}</div>`
      : "";
  return `<aside class="reader" aria-label="Textos de apoio">${tabs}<div class="reader-body">${texts
    .map((t, i) => `<div class="text-pane" data-pane="${esc(t.id)}" ${i ? "hidden" : ""}>${textHTML(exam, t)}</div>`)
    .join("")}</div></aside>`;
}

// Shrink the reading font (down to 80%) so each printed line of the exam fits on one screen line.
let _fitCtx = null;
function fitLines(root = document) {
  if (!_fitCtx) _fitCtx = document.createElement("canvas").getContext("2d");
  root.querySelectorAll(".lines").forEach((box) => {
    if (!box.offsetParent || box.closest(".text-block[data-free]")) return;
    box.style.fontSize = "";
    const cs = getComputedStyle(box);
    const size = parseFloat(cs.fontSize);
    const firstT = box.querySelector(".ln .t");
    if (!firstT) return;
    const avail = (firstT.getBoundingClientRect().width - 2) * 0.97; // canvas metrics run slightly narrow
    _fitCtx.font = `${size}px ${cs.fontFamily}`;
    let longest = 0;
    box.querySelectorAll(".ln").forEach((ln) => {
      const t = ln.querySelector(".t");
      const extra = ln.classList.contains("p") ? size * 3 : 0;
      longest = Math.max(longest, _fitCtx.measureText(t.textContent).width + extra);
    });
    if (longest > avail) box.style.fontSize = Math.max(size * 0.78, (size * avail) / longest) + "px";
  });
}
let _fitTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_fitTimer);
  _fitTimer = setTimeout(() => fitLines(), 150);
});

function bindReader(root) {
  requestAnimationFrame(() => fitLines(root));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitLines(root));
  root.addEventListener("click", (e) => {
    const tab = e.target.closest(".reader-tabs [data-tab]");
    if (tab) {
      const reader = tab.closest(".reader");
      showTextTab(reader, tab.dataset.tab);
      return;
    }
    const ln = e.target.closest(".ln");
    if (ln && !window.getSelection().toString()) {
      const block = ln.closest(".text-block");
      const key = `${block.dataset.exam}:${block.dataset.text}`;
      const n = +ln.dataset.ln;
      const set = new Set(S().highlights[key] || []);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      S().highlights[key] = [...set];
      ln.classList.toggle("hl", set.has(n));
      Store.save();
    }
  });
}
function showTextTab(reader, textId) {
  if (!reader) return;
  reader.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === textId));
  reader.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== textId));
  fitLines(reader);
}

// Turn "linha 12", "linhas 3 e 4", "(l. 5-6)", "versos 9-10" into links that flash the lines in the text.
// A span (not a button) so it can live inside option buttons and never wraps away from its parenthesis.
const LINE_REF = /(?<![\p{L}])(linhas?|versos?|ll?\.|vv?\.)\s*(\d{1,3})(?:\s*(?:-|–|a|e|até)\s*(\d{1,3}))?/giu;
function linkLineRefs(container, q) {
  if (!container || !q.texts || !q.texts.length) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const stemText = stripTags(q.stem);
  for (const node of nodes) {
    if (node.parentElement.closest(".katex, .lnref")) continue;
    const s = node.nodeValue;
    LINE_REF.lastIndex = 0;
    if (!LINE_REF.test(s)) continue;
    LINE_REF.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = LINE_REF.exec(s))) {
      frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const b = document.createElement("span");
      b.className = "lnref";
      b.setAttribute("role", "button");
      b.tabIndex = 0;
      b.textContent = m[0];
      const from = +m[2];
      const to = m[3] ? +m[3] : from;
      b.dataset.from = from;
      b.dataset.to = Math.max(from, to);
      b.dataset.text = guessTextFor(q, s.slice(0, m.index), stemText);
      b.title = "Mostrar no texto";
      frag.appendChild(b);
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(s.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
}
function guessTextFor(q, before, stemText) {
  const exam = EXAM[q.examId];
  const mentions = [...(before + " ").matchAll(/Texto\s+([IVX\d]+)/gi)];
  const all = [...stemText.matchAll(/Texto\s+([IVX\d]+)/gi)];
  const pick = mentions.length ? mentions[mentions.length - 1] : all.length === 1 ? all[0] : null;
  if (pick) {
    const lbl = pick[0].replace(/\s+/g, " ").toLowerCase();
    const t = q.texts.map((id) => exam.textById[id]).find((t) => t && (t.label || "").toLowerCase() === lbl);
    if (t) return t.id;
  }
  return q.texts[0];
}
function flashLines(scope, textId, from, to) {
  const reader = scope.querySelector(".reader") || document.querySelector(".reader");
  let block = null;
  if (reader) {
    showTextTab(reader, textId);
    block = reader.querySelector(`.text-block[data-text="${CSS.escape(textId)}"]`);
  } else {
    block = document.querySelector(`.text-block[data-text="${CSS.escape(textId)}"]`);
  }
  if (!block) return;
  let first = null;
  for (let n = from; n <= to; n++) {
    for (const ln of block.querySelectorAll(`.ln[data-ln="${n}"]`)) {
      ln.classList.remove("flash");
      void ln.offsetWidth;
      ln.classList.add("flash");
      first = first || ln;
    }
  }
  if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
}
function bindLineRefs(root) {
  const fire = (e) => {
    const b = e.target.closest(".lnref");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    flashLines(root, b.dataset.text, +b.dataset.from, +b.dataset.to);
  };
  root.addEventListener("click", fire, true);
  root.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".lnref")) fire(e);
  });
}

// Printed rule lists end items with ";" and the last one with "."; the transcriptions vary, so normalize.
function ruleListHTML(items) {
  const clean = (items || []).map((x) => String(x).trim().replace(/[;.,]\s*$/, ""));
  return `<ul>${clean.map((x, i) => `<li>${x}${i === clean.length - 1 ? "." : ";"}</li>`).join("")}</ul>`;
}
// The 2014 exam lists "Orientações gerais" (full sentences) instead of the usual "Seu texto deverá:" items.
function ruleListTitle(items) {
  return (items || []).some((x) => /^[A-ZÁÉÍÓÚ]/.test(String(x).trim())) ? "Orientações:" : "Seu texto deverá:";
}

// Polish rendered content: keep money and short formulas unbroken, glue punctuation to formulas,
// align long table cells left, put side-by-side images in a row, size figures and make them zoomable.
function enhanceContent(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const n of texts) {
    if (n.parentElement.closest(".katex")) continue;
    if (/R\$ (?=\d)/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/R\$ (?=\d)/g, "R$ ");
  }
  root.querySelectorAll(".katex").forEach((k) => {
    if (k.closest(".katex-display") || k.parentElement.classList.contains("mathglue")) return;
    if ((k.textContent || "").length <= 28) k.classList.add("nobreak");
    const next = k.nextSibling;
    const prev = k.previousSibling;
    const glueNext = next && next.nodeType === 3 && /^[.,;:)!?%]/.test(next.nodeValue);
    const gluePrev = prev && prev.nodeType === 3 && /\($/.test(prev.nodeValue);
    if (!glueNext && !gluePrev) return;
    const w = document.createElement("span");
    w.className = "mathglue";
    k.parentNode.insertBefore(w, k);
    if (gluePrev) {
      prev.nodeValue = prev.nodeValue.slice(0, -1);
      w.appendChild(document.createTextNode("("));
    }
    w.appendChild(k);
    if (glueNext) {
      const m = next.nodeValue.match(/^[.,;:)!?%]+/)[0];
      next.nodeValue = next.nodeValue.slice(m.length);
      w.appendChild(document.createTextNode(m));
    }
  });
  root.querySelectorAll(".qstem td, .qstem th, .expl td, .otext td").forEach((c) => {
    if ((c.textContent || "").trim().length > 28) c.classList.add("tl");
  });
  root.querySelectorAll(".qstem p, .expl p, .otext p").forEach((p) => {
    const imgs = p.querySelectorAll(":scope > img");
    if (imgs.length >= 2 && !p.textContent.trim()) p.classList.add("img-row");
  });
  root.querySelectorAll(".qstem img, .opt img, .expl img, .reader img, .text-block img").forEach((img) => {
    img.classList.add("zoomable");
    // SVG figures are drawn at their intended size; only the ~200 dpi raster crops get scaled.
    if (img.closest(".reader, .text-block") || img.src.startsWith("data:image/svg")) return;
    // Crops were made at about 200 dpi: show them near print size, never tiny, never wider than the column.
    const size = () => {
      if (!img.naturalWidth) return;
      img.style.width = Math.max(Math.min(img.naturalWidth, 240), Math.round(img.naturalWidth * 0.62)) + "px";
    };
    if (img.complete) size();
    else img.addEventListener("load", size, { once: true });
  });
}

// Click any figure to see it at full size.
document.addEventListener("click", (e) => {
  const img = e.target.closest("img.zoomable");
  if (!img) return;
  const opt = img.closest(".opt");
  if (opt && !opt.disabled) return; // before answering, clicking an option image selects the option
  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Imagem ampliada");
  box.innerHTML = `<img src="${img.src}" alt="${esc(img.alt)}"><button class="btn btn-sm">Fechar</button>`;
  const close = () => {
    box.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (ev) => ev.key === "Escape" && close();
  box.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(box);
  box.querySelector("button").focus();
});

function examNotesHTML(e) {
  const kind = { definitivo: "gabarito definitivo", oficial: "gabarito oficial", preliminar: "gabarito preliminar (o definitivo não foi publicado on-line)", resolvido: "sem gabarito oficial: respostas resolvidas e conferidas pela equipe do simulador" }[e.answer_key_kind] || "";
  const notes = (e.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
  const links = [e.source_url ? `<a href="${esc(e.source_url)}" target="_blank" rel="noopener">prova original</a>` : "", e.answer_key_url ? `<a href="${esc(e.answer_key_url)}" target="_blank" rel="noopener">gabarito</a>` : ""].filter(Boolean).join(" e ");
  return `<details class="exam-notes"><summary>Sobre a ${esc(e.title)}</summary><ul>${kind ? `<li>${kind[0].toUpperCase() + kind.slice(1)}.</li>` : ""}${notes}${links ? `<li>Fonte: ${links} (requer internet).</li>` : ""}</ul></details>`;
}

// ---------- question ----------
// st: { selected, revealed, locked }
function optionsHTML(q, st = {}) {
  return `<div class="opts" role="radiogroup" aria-label="Alternativas">${LETTERS.map((L) => {
    let cls = "opt", bcls = "bubble", badge = "";
    if (st.revealed && q.annulled) {
      if (L === st.selected) {
        cls += " is-sel";
        bcls += " sel";
        badge = `<span class="chip">sua resposta</span>`;
      }
    } else if (st.revealed) {
      if (L === q.answer) {
        cls += " is-ok";
        bcls += st.selected === L ? " ok" : " key";
        badge = `<span class="chip chip-good">✓ resposta correta</span>`;
      } else if (L === st.selected) {
        cls += " is-bad";
        bcls += " bad";
        badge = `<span class="chip chip-bad">✕ sua resposta</span>`;
      }
    } else if (st.selected === L) {
      cls += " is-sel";
      bcls += " sel";
    }
    const dis = st.revealed || st.locked ? "disabled" : "";
    return `<button type="button" class="${cls}" data-opt="${L}" role="radio" aria-checked="${st.selected === L}" ${dis}>
      <span class="${bcls}" aria-hidden="true">${L}</span>
      <span class="otext"><span class="sr-only">Alternativa ${L}: </span>${q.options[L]}${badge ? ` ${badge}` : ""}</span></button>`;
  }).join("")}</div>`;
}

function questionHeadHTML(q, extra = "") {
  const e = EXAM[q.examId];
  const topics = q.topics.map((t, i) => `<span class="chip ${i === 0 ? "chip-pen" : ""}">${esc(TOPIC_LABEL[t] || t)}</span>`).join("");
  return `<div class="qhead"><span class="qnum">Questão ${q.n}</span>
    <span class="chip">${esc(e.title)}</span><span class="chip">${SUBJ_LABEL[q.subject]}</span>${topics}${diffDots(q.difficulty)}
    ${q.annulled ? `<span class="chip chip-warn">${q.answer_source === "resolvido" ? "desconsiderada" : "anulada"}</span>` : ""}${q.answer_source === "resolvido" ? `<span class="chip chip-warn" title="Sem gabarito oficial publicado">gabarito resolvido</span>` : ""}${e.inedita ? `<span class="chip chip-pen" title="Questão criada para o simulador no estilo do CPII">inédita</span>` : ""}${e.answer_key_kind === "preliminar" ? `<span class="chip chip-warn" title="Só o gabarito preliminar desta prova foi publicado on-line">gabarito preliminar</span>` : ""}${extra}</div>`;
}

function explanationHTML(q, chosen) {
  let verdict;
  if (q.annulled) {
    verdict =
      q.answer_source === "resolvido"
        ? `<div class="verdict void"><span class="mark">!</span><p><b>Questão desconsiderada.</b> Na versão adaptada pelo CP2 Digital, nenhuma alternativa confere com o enunciado. Veja a resolução abaixo.</p></div>`
        : `<div class="verdict void"><span class="mark">!</span><p><b>Questão anulada pela banca.</b> Na prova, o ponto foi dado a todos. Ela continua valendo como treino.</p></div>`;
  } else if (chosen == null) {
    verdict = `<div class="verdict void"><span class="mark">–</span><p>Você deixou em branco. A resposta é <b>${q.answer}</b>.</p></div>`;
  } else if (chosen === q.answer) {
    verdict = `<div class="verdict ok"><span class="mark">✓</span><p><b>Você acertou.</b> A resposta é ${q.answer}.</p></div>`;
  } else {
    verdict = `<div class="verdict bad"><span class="mark">✕</span><p><b>Você marcou ${chosen}.</b> A resposta correta é <b>${q.answer}</b>.</p></div>`;
  }
  const d = q.distractors || {};
  const why = !q.annulled && chosen && chosen !== q.answer && d[chosen] ? `<h3>Por que não a ${chosen}?</h3><div class="why-wrong">${d[chosen]}</div>` : "";
  const all = Object.keys(d).length
    ? `<details><summary>Comentário de todas as alternativas</summary><dl>${LETTERS.map((L) =>
        L === q.answer ? `<dt>${L} ✓</dt><dd>Alternativa correta (veja a resolução).</dd>` : d[L] ? `<dt>${L}</dt><dd>${d[L]}</dd>` : ""
      ).join("")}</dl></details>`
    : "";
  const expl = q.explanation ? `<h3>Resolução</h3><div>${q.explanation}</div>` : `<p class="muted">A resolução comentada desta questão ainda não está disponível.</p>`;
  const tip = q.tip ? `<h3>Para lembrar</h3><div class="tip">${q.tip}</div>` : "";
  return `${verdict}<div class="expl">${expl}${why}${tip}${all}</div>`;
}

// ---------- small charts (hand-built SVG) ----------
function hbar(value, cls = "") {
  const w = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return `<div class="hbar" role="img" aria-label="${fmt.pct(value)}"><span class="track"></span><span class="fill ${cls}" style="width:${w}%"></span></div>`;
}
function accClass(acc) {
  return acc == null ? "" : acc < 0.5 ? "low" : acc >= 0.75 ? "high" : "";
}

let tipEl = null;
function showTip(html, x, y) {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "tooltip";
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.min(window.innerWidth - r.width - 8, x + 12) + "px";
  tipEl.style.top = Math.max(8, y - r.height - 12) + "px";
}
function hideTip() {
  if (tipEl) tipEl.hidden = true;
}
function bindTips(root) {
  root.addEventListener("pointermove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t) showTip(t.dataset.tip, e.clientX, e.clientY);
    else hideTip();
  });
  root.addEventListener("pointerleave", hideTip);
  root.addEventListener("focusin", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t) {
      const r = t.getBoundingClientRect();
      showTip(t.dataset.tip, r.left + r.width / 2, r.top);
    }
  });
  root.addEventListener("focusout", hideTip);
}

// Line chart for scores over time. points: [{x: label, y: value, tip}]
function lineChart(points, { max, height = 220, yLabel = "" } = {}) {
  if (!points.length) return "";
  const W = 640, H = height, L = 36, R = 16, T = 16, B = 30;
  const top = max ?? Math.max(...points.map((p) => p.y), 1);
  const xs = (i) => (points.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const ys = (v) => T + (1 - v / top) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}"/>`).join("");
  const yl = ticks.map((v) => `<text x="${L - 6}" y="${ys(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const step = Math.ceil(points.length / 8);
  const xl = points.map((p, i) => (i % step === 0 || i === points.length - 1 ? `<text x="${xs(i)}" y="${H - 8}" text-anchor="middle">${esc(p.x)}</text>` : "")).join("");
  const d = points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${xs(points.length - 1).toFixed(1)},${ys(0)} L${xs(0).toFixed(1)},${ys(0)} Z`;
  const dots = points.map((p, i) => `<circle class="dot" cx="${xs(i)}" cy="${ys(p.y)}" r="4.5"/>`).join("");
  const hits = points.map((p, i) => `<circle class="hit" cx="${xs(i)}" cy="${ys(p.y)}" r="14" data-tip="${esc(p.tip || `${p.x}: ${p.y}`)}" tabindex="0"/>`).join("");
  const lastP = points[points.length - 1];
  const endLbl = `<text class="lbl" x="${Math.min(xs(points.length - 1) + 8, W - 4)}" y="${ys(lastP.y) - 10}" text-anchor="end">${fmt.num(lastP.y)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)}"><g class="grid">${grid}</g><g class="axis">${yl}${xl}</g>
    <path class="area" d="${area}"/><path class="line" d="${d}"/>${dots}${endLbl}${hits}</svg>`;
}

// Texts inside a closed <details> could not be measured; fit them when opened.
document.addEventListener(
  "toggle",
  (e) => {
    if (e.target.open) fitLines(e.target);
  },
  true
);
