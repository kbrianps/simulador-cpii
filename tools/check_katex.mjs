// Render every \( \) and \[ \] snippet of the given exams with KaTeX (strict)
// and report syntax errors. usage: node tools/check_katex.mjs <id> [<id> ...]
import fs from "node:fs";
import path from "node:path";
import katex from "katex";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const ids = process.argv.slice(2);
let bad = 0;
const re = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
function walk(where, v) {
  if (typeof v === "string") {
    for (const m of v.matchAll(re)) {
      const tex = m[1] ?? m[2];
      try {
        katex.renderToString(tex, { throwOnError: true, displayMode: m[2] !== undefined, strict: "ignore" });
      } catch (e) {
        bad++;
        console.log(`${where}: ${e.message.split("\n")[0]}  <<${tex}>>`);
      }
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(`${where}[${i}]`, x));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(`${where}.${k}`, x);
}
for (const id of ids) {
  const dir = path.join(root, "data", "exams", id);
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (f.endsWith(".json")) walk(`${id}/${f}`, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
}
console.log(bad ? `${bad} KaTeX error(s)` : "KaTeX OK");
process.exit(bad ? 1 : 0);
