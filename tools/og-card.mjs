// Draws the link-preview cards from tools/og-card.html:
//   src/og-home.png   the site card (home page, Timeline, Figures and sources),
//                     with a tag for each published project
//   src/og-<id>.png   one per published project, worded from its "card:" in
//                     data/projects.yaml, in the project's own tag shade
// and records what it drew in tools/og-card.json. The build stops if that no
// longer matches projects.yaml, so rerun this whenever a project is published
// or its card wording changes: node tools/og-card.mjs (needs Playwright).
// Not part of the build.
import { chromium } from "playwright";
import fs from "node:fs";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const projects = yaml.load(fs.readFileSync(here("../data/projects.yaml"), "utf8")).filter((p) => p.page);

// A project's tag shade: .pj-<id>{color:var(--x)}, then --x's value in the
// light-mode (first) and dark-mode blocks of src/styles.css.
const css = fs.readFileSync(here("../src/styles.css"), "utf8");
const dark = css.slice(css.indexOf("prefers-color-scheme: dark"));
const shade = (id) => {
  const v = (css.match(new RegExp(`\\.pj-${id}\\{color:var\\((--[\\w-]+)\\)`)) || [])[1];
  const hex = (s) => v && (s.match(new RegExp(`${v}:\\s*(#[0-9A-Fa-f]{3,8})`)) || [])[1];
  if (!hex(css) || !hex(dark)) throw new Error(`No tag shade for "${id}": add .pj-${id} to src/styles.css first.`);
  return { light: hex(css), dark: hex(dark) };
};

const cards = [{ file: "og-home.png", site: true, tags: projects.map((p) => ({ label: p.short, colour: shade(p.id).dark })) }];
for (const p of projects) {
  if (!p.card || !p.card.title) throw new Error(`Project "${p.id}" has no card: title in data/projects.yaml.`);
  const s = shade(p.id);
  cards.push({ file: `og-${p.id}.png`, bar: s.light, eyebrow: s.dark,
    text: { eyebrow: p.card.eyebrow || `Pasco County · ${p.short}`, title: p.card.title, sub: p.card.sub || "",
            note: p.card.note || `pascoroadmap.info/${p.id}`, right: p.card.right || "Sourced · checked · corrected in public" } });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of cards) {
  await page.goto("file://" + here("./og-card.html"));
  await page.evaluate((c) => {
    document.body.className = c.site ? "site" : "";
    if (c.bar) { document.documentElement.style.setProperty("--bar", c.bar); document.documentElement.style.setProperty("--eyebrow", c.eyebrow); }
    for (const [k, v] of Object.entries(c.text || {})) document.getElementById(k).textContent = v;
    const box = document.getElementById("tags");
    for (const t of c.tags || []) {
      const s = document.createElement("span");
      s.textContent = t.label; s.style.color = t.colour;
      box.appendChild(s);
    }
  }, c);
  await page.screenshot({ path: here("../src/" + c.file) });
  console.log("Wrote src/" + c.file);
}
await browser.close();
const drawn = { projects: projects.map((p) => p.id), cards: Object.fromEntries(projects.map((p) => [p.id, p.card])) };
fs.writeFileSync(here("./og-card.json"), JSON.stringify(drawn, null, 2) + "\n");
