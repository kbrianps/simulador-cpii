// Build the offline single-file simulator: dist/simulador-cp2.html
// Inlines exam data (with LaTeX pre-rendered by KaTeX), images, fonts, CSS and JS.
// usage: node tools/build.mjs [--out path] [--only examId[,examId]]
import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const rel = (...p) => path.join(root, ...p);
const outArg = process.argv.indexOf("--out");
const outFile = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : rel("dist", "simulador-cp2.html");
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",")) : null;

const readJSON = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback);
const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const dataUri = (file) => `data:${mime[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString("base64")}`;

// Exam images: re-encode as WebP when it is clearly smaller (lossless for line art, q82 for photos).
const cacheDir = rel("build", "imgcache");
fs.mkdirSync(cacheDir, { recursive: true });
let savedBytes = 0;
function imageUri(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return dataUri(file);
  const buf = fs.readFileSync(file);
  const key = crypto.createHash("sha1").update(buf).digest("hex");
  const out = path.join(cacheDir, key + (ext === ".png" && buf.length > 60000 ? ".q90" : "") + ".webp");
  if (!fs.existsSync(out) && !fs.existsSync(out + ".skip")) {
    try {
      const tmp = `${out}.${process.pid}.tmp`;
      // Big PNGs are scans or comics: high-quality lossy keeps the lettering sharp at a fraction of the size.
      const args =
        ext !== ".png" ? ["-q", "82", "-quiet", file, "-o", tmp]
        : buf.length > 60000 ? ["-q", "90", "-sharp_yuv", "-m", "6", "-quiet", file, "-o", tmp]
        : ["-lossless", "-z", "9", "-quiet", file, "-o", tmp];
      execFileSync("cwebp", args, { stdio: "ignore" });
      fs.renameSync(tmp, fs.statSync(tmp).size > buf.length * 0.9 ? out + ".skip" : out);
    } catch (e) {
      fs.writeFileSync(out + ".skip", "");
    }
  }
  if (fs.existsSync(out)) {
    savedBytes += buf.length - fs.statSync(out).size;
    return `data:image/webp;base64,${fs.readFileSync(out).toString("base64")}`;
  }
  return dataUri(file);
}

let mathErrors = 0;
let imageCount = 0;
const missing = [];
const MATH = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;

function renderString(s) {
  let out = s.replace(MATH, (_, inl, disp) => {
    const tex = inl ?? disp;
    try {
      return katex.renderToString(tex, { displayMode: disp !== undefined, throwOnError: true, strict: "ignore", output: "html" });
    } catch (e) {
      mathErrors++;
      console.warn("KaTeX:", e.message.split("\n")[0]);
      return `<code>${tex}</code>`;
    }
  });
  out = out.replace(/(<img\b[^>]*?\bsrc=")(img\/[^"]+)(")/g, (m, a, src, b) => {
    const f = rel("data", src);
    if (!fs.existsSync(f)) {
      missing.push(src);
      return m;
    }
    imageCount++;
    return a + imageUri(f) + b;
  });
  return out;
}

function deep(v) {
  if (typeof v === "string") return renderString(v);
  if (Array.isArray(v)) return v.map(deep);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "src" && typeof x === "string" && x.startsWith("img/")) {
        const f = rel("data", x);
        if (fs.existsSync(f)) {
          imageCount++;
          o[k] = imageUri(f);
        } else {
          missing.push(x);
          o[k] = x;
        }
      } else o[k] = deep(x);
    }
    return o;
  }
  return v;
}

// ---- exams ----
const examsDir = rel("data", "exams");
const exams = [];
for (const id of fs.existsSync(examsDir) ? fs.readdirSync(examsDir) : []) {
  const dir = path.join(examsDir, id);
  if (!fs.statSync(dir).isDirectory() || id.startsWith("_") || (only && !only.has(id))) continue;
  const meta = readJSON(path.join(dir, "meta.json"), null);
  if (!meta) {
    console.warn(`skip ${id}: no meta.json`);
    continue;
  }
  const texts = readJSON(path.join(dir, "texts.json"), []);
  const qs = [...readJSON(path.join(dir, "questions-pt.json"), []), ...readJSON(path.join(dir, "questions-mat.json"), [])];
  qs.sort((a, b) => a.n - b.n);
  const redacao = readJSON(path.join(dir, "redacao.json"), null);
  exams.push(deep({ ...meta, texts, questions: qs, redacao: redacao && Object.keys(redacao).length ? redacao : null }));
}
// Past exams first, then the original ("inédita") ones, then the CP2 Digital extras.
const rank = (e) => (e.id[0] === "p" ? 0 : e.id[0] === "i" ? 1 : 2);
exams.sort((a, b) => rank(a) - rank(b) || (a.id[0] === "i" ? a.id.localeCompare(b.id) : 0) || b.year - a.year || String(a.shift || "").localeCompare(String(b.shift || "")) || a.id.localeCompare(b.id));

// ---- themes ----
// data/themes.json is the reviewed bank; data/themes-drafts/ keeps the first per-axis drafts for reference only.
const themes = readJSON(rel("data", "themes.json"), null);
if (!themes) {
  console.error("data/themes.json is missing");
  process.exit(1);
}

const data = {
  builtAt: new Date().toISOString(),
  exam: readJSON(rel("data", "exam-info.json"), {}),
  topics: readJSON(rel("data", "topics.json"), {}),
  exams,
  themes,
};

// ---- fonts & css ----
const fontFaces = [];
const fsrc = (pkg, file) => rel("node_modules", "@fontsource", pkg, "files", file);
for (const [family, pkg, prefix, variants] of [
  ["Source Sans 3", "source-sans-3", "source-sans-3-latin", [["400", "normal"], ["400", "italic"], ["600", "normal"], ["700", "normal"], ["700", "italic"]]],
  ["Literata", "literata", "literata-latin", [["400", "normal"], ["400", "italic"], ["600", "normal"], ["600", "italic"]]],
]) {
  for (const [w, st] of variants) {
    fontFaces.push(`@font-face{font-family:"${family}";font-style:${st};font-weight:${w};font-display:swap;src:url(${dataUri(fsrc(pkg, `${prefix}-${w}-${st}.woff2`))}) format("woff2")}`);
  }
}
let katexCss = fs.readFileSync(rel("node_modules", "katex", "dist", "katex.min.css"), "utf8");
katexCss = katexCss.replace(/src:url\(fonts\/([^)]+?\.woff2)\) format\("woff2"\)(,url\([^)]+\) format\("[^"]+"\))*/g, (_, f) => `src:url(${dataUri(rel("node_modules", "katex", "dist", "fonts", f))}) format("woff2")`);

const css = fs.readFileSync(rel("src", "styles.css"), "utf8");
const jsFiles = ["core.js", "ui.js", "home.js", "practice.js", "simulado.js", "essay.js", "stats.js", "main.js"];
const js = jsFiles.map((f) => `// ---- ${f} ----\n` + fs.readFileSync(rel("src", "js", f), "utf8")).join("\n");
const icon = fs.existsSync(rel("src", "icon.svg")) ? dataUri(rel("src", "icon.svg")) : "";

let html = fs.readFileSync(rel("src", "index.html"), "utf8");
const jsonData = JSON.stringify(data).replace(/</g, "\\u003c");
html = html
  .replace("/*FONTS*/", () => fontFaces.join("\n"))
  .replace("/*KATEX_CSS*/", () => katexCss)
  .replace("/*APP_CSS*/", () => css)
  .replace("/*APP_DATA*/", () => jsonData)
  .replace("/*APP_JS*/", () => js)
  .replace("%ICON%", () => icon);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
const qCount = exams.reduce((n, e) => n + e.questions.length, 0);
console.log(`built ${path.relative(root, outFile)}: ${(html.length / 1048576).toFixed(2)} MB, ${exams.length} exams, ${qCount} questions, ${themes.themes.length} themes, ${imageCount} images`);
if (missing.length) console.warn("missing images:", [...new Set(missing)].join(", "));
if (savedBytes) console.log(`images re-encoded as WebP: ${(savedBytes / 1048576).toFixed(2)} MB saved`);
if (mathErrors) console.warn(`${mathErrors} math error(s)`);
