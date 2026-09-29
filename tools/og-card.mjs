// Draws tools/og-card.html into src/og-home.png, the site-wide link-preview
// card, with a tag for each project that has a page (page: true in
// data/projects.yaml), and records which ones in tools/og-card.json. The
// build stops if that list no longer matches projects.yaml, so rerun this
// whenever a project is published: node tools/og-card.mjs (needs
// Playwright). Not part of the build.
import { chromium } from "playwright";
import fs from "node:fs";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const projects = yaml.load(fs.readFileSync(here("../data/projects.yaml"), "utf8")).filter((p) => p.page);

// Each project's tag colour, as the Timeline shows it in dark mode:
// .pj-<id>{color:var(--x)}, then --x's value in the dark-mode block.
const css = fs.readFileSync(here("../src/styles.css"), "utf8");
const dark = css.slice(css.indexOf("prefers-color-scheme: dark"));
const colour = (id) => {
  const v = (css.match(new RegExp(`\\.pj-${id}\\{color:var\\((--[\\w-]+)\\)`)) || [])[1];
  const c = v && (dark.match(new RegExp(`${v}:\\s*(#[0-9A-Fa-f]{3,8})`)) || [])[1];
  if (!c) throw new Error(`No tag colour for "${id}": add .pj-${id} to src/styles.css first.`);
  return c;
};
const tags = projects.map((p) => ({ label: p.short, colour: colour(p.id) }));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + here("./og-card.html"));
await page.evaluate((tags) => {
  const box = document.getElementById("tags");
  box.textContent = "";
  for (const t of tags) {
    const s = document.createElement("span");
    s.textContent = t.label; s.style.color = t.colour;
    box.appendChild(s);
  }
}, tags);
await page.screenshot({ path: here("../src/og-home.png") });
await browser.close();
fs.writeFileSync(here("./og-card.json"), JSON.stringify({ projects: projects.map((p) => p.id) }, null, 2) + "\n");
console.log("Wrote src/og-home.png with: " + projects.map((p) => p.short).join(", "));
