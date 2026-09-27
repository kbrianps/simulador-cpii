// Screenshot every question of an exam as the student sees it (answer revealed, explanation open).
// usage: node tools/shoot.mjs <examId> [outDir=/tmp/cp2shots/<examId>] [--theme dark] [--html path/to/build.html]
// Needs dist/simulador-cp2.html (node tools/build.mjs) and the Chromium that Playwright installed.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const [examId, outArg] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const theme = opt("--theme") || "light";
if (!examId) {
  console.error("usage: node tools/shoot.mjs <examId> [outDir]");
  process.exit(1);
}
const out = outArg || `/tmp/cp2shots/${examId}`;
fs.mkdirSync(out, { recursive: true });
const pwDir = path.join(os.homedir(), ".cache", "ms-playwright");
// The headless shell is lighter and more robust when several runs happen at once.
const shellDir = fs.readdirSync(pwDir).filter((d) => d.startsWith("chromium_headless_shell-")).sort().pop();
const chromeDir = fs.readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().pop();
const exe = shellDir
  ? path.join(pwDir, shellDir, "chrome-headless-shell-linux64", "chrome-headless-shell")
  : path.join(pwDir, chromeDir, "chrome-linux64", "chrome");
const browser = await chromium.launch({ executablePath: exe, args: ["--disable-breakpad", "--disable-crash-reporter", "--disable-dev-shm-usage"] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: theme })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const file = "file://" + path.resolve(opt("--html") || path.join(root, "dist", "simulador-cp2.html"));
// Full-page screenshots: unstick the header and the reader so nothing overlaps.
const unstick = () => page.addStyleTag({ content: ".topbar{position:static!important}.qwrap>.reader{position:static!important;max-height:none!important}" });
await page.goto(file);
const qs = await page.evaluate((id) => {
  const d = JSON.parse(document.getElementById("app-data").textContent);
  const e = d.exams.find((x) => x.id === id);
  return e ? e.questions.map((q) => ({ n: q.n, answer: q.answer })) : [];
}, examId);
if (!qs.length) {
  console.error("exam not found in the build:", examId);
  process.exit(1);
}
for (const q of qs) {
  await page.goto(`${file}#/questao/${encodeURIComponent(examId + ":" + q.n)}`);
  await page.waitForTimeout(250);
  await unstick();
  const L = q.answer || "A";
  await page.click(`.opt[data-opt="${L}"]`);
  await page.click('[data-act="confirm"]');
  await page.waitForTimeout(250);
  await unstick();
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  const f = path.join(out, `q${String(q.n).padStart(2, "0")}.png`);
  await page.screenshot({ path: f, fullPage: true });
  console.log(f);
}
// the exam texts as they appear in the reader
await page.goto(`${file}#/redacao/proposta/${examId}`);
await page.waitForTimeout(300);
if (await page.$(".reader")) {
  const tabs = await page.$$(".reader-tabs [data-tab]");
  for (let i = 0; i < Math.max(1, tabs.length); i++) {
    if (tabs[i]) await tabs[i].click();
    await page.waitForTimeout(150);
    const f = path.join(out, `texts-${i + 1}.png`);
    await (await page.$(".reader")).screenshot({ path: f });
    console.log(f);
  }
  await page.screenshot({ path: path.join(out, "redacao.png"), fullPage: true });
  console.log(path.join(out, "redacao.png"));
}
console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
