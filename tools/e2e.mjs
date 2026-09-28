// End-to-end check of the main flows in a headless browser; fails on any page error.
// usage: node tools/e2e.mjs [path/to/build.html] [--theme dark] [--shots dir]
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const html = path.resolve(argv.find((a, i) => !a.startsWith("--") && !(i && argv[i - 1].startsWith("--"))) || path.join(root, "dist", "simulador-cp2.html"));
const FILE = "file://" + html;
const shots = opt("--shots");
if (shots) fs.mkdirSync(shots, { recursive: true });

const pw = path.join(os.homedir(), ".cache", "ms-playwright");
const shell = fs.readdirSync(pw).filter((d) => d.startsWith("chromium_headless_shell-")).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(pw, shell, "chrome-headless-shell-linux64", "chrome-headless-shell"), args: ["--disable-breakpad"] });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 860 }, colorScheme: opt("--theme") || "light", acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
const step = async (name, fn) => {
  try {
    await fn();
    if (shots) await page.screenshot({ path: path.join(shots, name + ".png") });
    console.log("ok  ", name);
  } catch (e) {
    errors.push(`${name}: ${e.message.split("\n")[0]}`);
    console.log("FAIL", name);
  }
};
const go = async (hash) => {
  await page.goto(FILE + hash);
  await page.waitForTimeout(300);
};

await step("home", () => go("#/"));
for (const origin of ["", "oficial", "inedita"]) {
  for (const subject of ["portugues", "matematica"]) {
    await step(`practice-${origin || "all"}-${subject}`, async () => {
      await go("#/praticar");
      if (!(await page.$(`select[name="origin"] option[value="${origin}"]`))) return;
      await page.selectOption('select[name="origin"]', origin);
      await page.selectOption('select[name="subject"]', subject);
      if ((await page.textContent("#pf-count")).startsWith("Nenhuma")) return;
      await page.click("#pf-go");
      await page.waitForTimeout(250);
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press(["a", "b", "c"][i]);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(150);
        if (!(await page.$('[data-act="next"]'))) break;
        await page.click('[data-act="next"]');
        await page.waitForTimeout(150);
      }
    });
  }
}
await step("simulado-full", async () => {
  await go("#/simulado");
  const values = await page.$$eval("#exam-pick option", (o) => o.map((x) => x.value));
  await page.selectOption("#exam-pick", values[values.length - 1]);
  await page.click("#start");
  await page.waitForTimeout(400);
  const rows = await page.$$(".ac-row");
  for (let i = 0; i < rows.length; i++) await (await rows[i].$(`[data-ac="${"ABCD"[i % 4]}"]`)).click();
  if (await page.$('[data-tab="essay"]')) {
    await page.click('[data-tab="essay"]');
    await page.waitForTimeout(250);
    await page.fill(".folha textarea", "\tA tecnologia faz parte da vida dos jovens.\n\tAlém disso, a escola precisa discutir o tema.\n\tPortanto, é preciso equilíbrio.");
  }
  await page.click("#deliver");
  await page.click('.modal button:has-text("Entregar")');
  await page.waitForTimeout(400);
  if (await page.$("#eval")) {
    await page.click("#eval");
    for (const c of ["tema", "argumentacao", "estrutura", "coesao", "norma"]) await page.check(`input[name="r-${c}"][value="1"]`);
    await page.click("#rub-save");
  }
});
await step("simulado-mixed", async () => {
  await go("#/simulado");
  await page.check('input[name="kind"][value="mixed"]');
  await page.click("#start");
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    S().activeSim.startedAt -= 4 * 3600 * 1000;
    Store.save(true);
  });
  await page.waitForTimeout(1600);
  if (!(await page.evaluate(() => location.hash)).includes("resultado")) throw new Error("no auto-delivery");
});
await step("redacao", async () => {
  await go("#/redacao");
  await page.click("#draw");
  await page.waitForTimeout(200);
  await go("#/redacao/provas");
});
await step("desempenho", () => go("#/desempenho"));
await step("home-after", () => go("#/"));

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "NO ERRORS");
await browser.close();
process.exit(errors.length ? 1 : 0);
