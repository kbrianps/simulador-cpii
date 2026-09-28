"use strict";

// ---------- data ----------
const DATA = JSON.parse(document.getElementById("app-data").textContent);
const INFO = DATA.exam || {};
const EXAMS = DATA.exams || [];
const EXAM = Object.fromEntries(EXAMS.map((e) => [e.id, e]));
const Q = {};
for (const e of EXAMS) {
  e.official = e.id.startsWith("p");
  e.inedita = e.answer_key_kind === "inedita";
  e.bank = e.id.startsWith("b"); // topic sets for practice only, not full exams
  e.origin = e.official ? "oficial" : e.inedita ? "inedita" : "extra";
  e.textById = Object.fromEntries((e.texts || []).map((t) => [t.id, t]));
  for (const q of e.questions) {
    q.id = `${e.id}:${q.n}`;
    q.examId = e.id;
    q.topics = q.topics || [];
    Q[q.id] = q;
  }
}
const ALL_Q = EXAMS.flatMap((e) => e.questions);
const TOPIC_LABEL = { ...(DATA.topics.portugues || {}), ...(DATA.topics.matematica || {}) };
const SUBJ_LABEL = { portugues: "Português", matematica: "Matemática" };
const DIFF_LABEL = { 1: "fácil", 2: "média", 3: "difícil" };
const THEMES = (DATA.themes && DATA.themes.themes) || [];
const AXES = (DATA.themes && DATA.themes.axes) || [];

// ---------- dom helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const main = () => document.getElementById("main");
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function stripTags(html) {
  const d = document.createElement("div");
  d.innerHTML = html || "";
  return d.textContent || "";
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
const fmt = {
  pct: (x) => (x == null || isNaN(x) ? "–" : `${Math.round(x * 100)}%`),
  date: (ts) => new Date(ts).toLocaleDateString("pt-BR"),
  dateTime: (ts) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  clock(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  },
  dur(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  },
  secs(ms) {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
  },
  num: (x, d = 1) => (x == null || isNaN(x) ? "–" : x.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 })),
};

function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  document.getElementById("toasts").appendChild(t);
  setTimeout(() => t.remove(), kind === "warn" ? 7000 : 3500);
}

function modal({ title, body, actions }) {
  return new Promise((resolve) => {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">${esc(title)}</h2><div>${body}</div>
      <div class="row">${actions.map((a, i) => `<button class="btn ${a.kind || ""}" data-i="${i}">${esc(a.label)}</button>`).join("")}</div></div></div>`;
    const close = (v) => {
      root.innerHTML = "";
      document.removeEventListener("keydown", onKey);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(null);
    };
    document.addEventListener("keydown", onKey);
    root.querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", () => close(actions[+b.dataset.i].value)));
    root.querySelector(".modal-back").addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-back")) close(null);
    });
    const last = root.querySelector("button[data-i]:last-child");
    if (last) last.focus();
  });
}
const confirmBox = (title, body, okLabel = "Confirmar", kind = "btn-primary") =>
  modal({ title, body: `<p>${body}</p>`, actions: [{ label: "Cancelar", value: false }, { label: okLabel, value: true, kind }] });

// ---------- persistent store ----------
const STORE_KEY = "cp2sim.v1";
const Store = {
  state: null,
  _t: null,
  defaults() {
    return { v: 1, attempts: [], sims: [], essays: [], flags: {}, highlights: {}, settings: { theme: "auto", scale: 1 }, activeSim: null, practice: null, draft: null };
  },
  load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (e) {
      saved = null;
    }
    this.state = Object.assign(this.defaults(), saved || {});
    this.state.settings = Object.assign(this.defaults().settings, this.state.settings || {});
  },
  save(now = false) {
    clearTimeout(this._t);
    const write = () => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
      } catch (e) {
        toast("Não foi possível salvar o progresso neste navegador. Use Desempenho > Exportar progresso para guardar uma cópia.", "warn");
      }
    };
    if (now) write();
    else this._t = setTimeout(write, 250);
  },
};
Store.load();
const S = () => Store.state;
window.addEventListener("beforeunload", () => Store.save(true));

// ---------- attempts & statistics ----------
function recordAttempt(qid, choice, ms, mode, simId) {
  const q = Q[qid];
  if (!q) return null;
  const ok = q.annulled ? null : choice === q.answer;
  const a = { q: qid, c: choice, ok, ms: Math.round(ms || 0), t: Date.now(), m: mode };
  if (simId) a.s = simId;
  S().attempts.push(a);
  Store.save();
  return a;
}
function attemptsFor(qid) {
  return S().attempts.filter((a) => a.q === qid);
}
function lastAttempt(qid) {
  const at = S().attempts;
  for (let i = at.length - 1; i >= 0; i--) if (at[i].q === qid) return at[i];
  return null;
}
function questionStatus(qid) {
  const a = lastAttempt(qid);
  if (!a || a.ok == null) return null;
  return a.ok ? "ok" : "bad";
}
// First attempt per question: the honest measure (before seeing the explanation).
function firstAttempts() {
  const m = new Map();
  for (const a of S().attempts) if (!m.has(a.q) && Q[a.q] && a.ok != null) m.set(a.q, a);
  return m;
}
function isFlagged(qid) {
  return !!S().flags[qid];
}
function toggleFlag(qid) {
  if (S().flags[qid]) delete S().flags[qid];
  else S().flags[qid] = Date.now();
  Store.save();
  return !!S().flags[qid];
}

// Laplace-smoothed rate so 1/1 does not outrank 9/10.
const smooth = (ok, n) => (ok + 1) / (n + 2);

function computeStats() {
  const first = firstAttempts();
  const topic = {};
  const subj = { portugues: { n: 0, ok: 0, ms: 0 }, matematica: { n: 0, ok: 0, ms: 0 } };
  const diff = { 1: { n: 0, ok: 0 }, 2: { n: 0, ok: 0 }, 3: { n: 0, ok: 0 } };
  const exam = {};
  let n = 0, ok = 0, ms = 0, msN = 0;
  const fast = { n: 0, ok: 0 }, slow = { n: 0, ok: 0 };
  for (const [qid, a] of first) {
    const q = Q[qid];
    n++;
    if (a.ok) ok++;
    if (a.ms > 0) {
      ms += a.ms;
      msN++;
      const bucket = a.ms < 60000 ? fast : slow;
      bucket.n++;
      if (a.ok) bucket.ok++;
    }
    const s = subj[q.subject];
    if (s) {
      s.n++;
      if (a.ok) s.ok++;
      s.ms += a.ms || 0;
    }
    if (diff[q.difficulty]) {
      diff[q.difficulty].n++;
      if (a.ok) diff[q.difficulty].ok++;
    }
    const ex = (exam[q.examId] = exam[q.examId] || { n: 0, ok: 0 });
    ex.n++;
    if (a.ok) ex.ok++;
    for (const t of q.topics) {
      const ts = (topic[t] = topic[t] || { id: t, n: 0, ok: 0, qids: [] });
      ts.n++;
      if (a.ok) ts.ok++;
      ts.qids.push(qid);
    }
  }
  for (const t of Object.values(topic)) {
    t.acc = t.ok / t.n;
    t.score = smooth(t.ok, t.n);
  }
  // Questions the student got wrong first and right later
  const recovered = [];
  const wrongNow = [];
  for (const [qid, a] of first) {
    const last = lastAttempt(qid);
    if (!a.ok && last && last.ok) recovered.push(qid);
    if (last && last.ok === false) wrongNow.push(qid);
  }
  return { first, n, ok, acc: n ? ok / n : null, avgMs: msN ? ms / msN : null, topic, subj, diff, exam, fast, slow, recovered, wrongNow };
}

// How often each topic appears in the official exams (primary topic = 1, others = 0.5).
const TOPIC_FREQ = (() => {
  const f = {};
  const official = EXAMS.filter((e) => e.official);
  for (const e of official)
    for (const q of e.questions)
      q.topics.forEach((t, i) => {
        f[t] = (f[t] || 0) + (i === 0 ? 1 : 0.5);
      });
  const nExams = official.length || 1;
  for (const k in f) f[k] = f[k] / nExams; // per exam
  return f;
})();

// Weak: below 70% of first-try hits. Strong: 60% or more and not already listed as weak.
function weakTopics(stats, min = 2) {
  return Object.values(stats.topic)
    .filter((t) => t.n >= min && t.acc < 0.7)
    .sort((a, b) => a.score - b.score || b.n - a.n);
}
function strongTopics(stats, min = 2) {
  const weak = new Set(weakTopics(stats, min).slice(0, 6).map((t) => t.id));
  return Object.values(stats.topic)
    .filter((t) => t.n >= min && t.acc >= 0.6 && !weak.has(t.id))
    .sort((a, b) => b.score - a.score || b.n - a.n);
}
// Priority = how much the topic weighs on the exam x how much the student misses it.
function priorities(stats) {
  const out = [];
  for (const [id, freq] of Object.entries(TOPIC_FREQ)) {
    const t = stats.topic[id];
    const err = t ? 1 - t.score : 0.5; // unknown topics count as a coin flip
    out.push({ id, freq, err, seen: t ? t.n : 0, acc: t ? t.acc : null, p: freq * err });
  }
  return out.sort((a, b) => b.p - a.p);
}

// ---------- settings ----------
function applySettings() {
  const st = S().settings;
  const root = document.documentElement;
  if (st.theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", st.theme);
  root.style.setProperty("--scale", st.scale);
}
function currentTheme() {
  const st = S().settings.theme;
  if (st !== "auto") return st;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// ---------- router ----------
const Routes = [];
function route(pattern, fn) {
  Routes.push({ re: new RegExp("^" + pattern.replace(/:(\w+)/g, "([^/]+)") + "$"), fn, nav: pattern.split("/")[0] || "home" });
}
let leaveGuard = null; // function returning true when navigation should be blocked
let currentCleanup = null;
function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
function render() {
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {}
    currentCleanup = null;
  }
  for (const r of Routes) {
    const m = path.match(r.re);
    if (m) {
      $$(".mainnav a").forEach((a) => a.toggleAttribute("aria-current", false));
      const active = $(`.mainnav a[data-nav="${r.nav}"]`);
      if (active) active.setAttribute("aria-current", "page");
      window.scrollTo(0, 0);
      r.fn(...m.slice(1));
      renderSimbar();
      return;
    }
  }
  go("#/");
}
// Views that re-render themselves call this again; the previous cleanup runs first.
function onCleanup(fn) {
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {}
  }
  currentCleanup = fn;
}

// ---------- misc ----------
function examLabel(e) {
  return e ? e.title : "";
}
function qLabel(q) {
  const e = EXAM[q.examId];
  return `${e.title}, questão ${q.n}`;
}
function diffDots(d) {
  return `<span class="chip diff" title="Dificuldade ${DIFF_LABEL[d] || ""}">${"●".repeat(d || 0)}${"○".repeat(3 - (d || 0))} ${DIFF_LABEL[d] || ""}</span>`;
}
function daysUntil(dateStr) {
  const target = new Date(dateStr + "T08:00:00");
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}
function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
