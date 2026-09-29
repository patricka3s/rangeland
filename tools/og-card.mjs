// Draws tools/og-card.html into src/og-home.png, the site-wide link-preview
// card. Run: node tools/og-card.mjs (needs Playwright). Not part of the build.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + here("./og-card.html"));
await page.screenshot({ path: here("../src/og-home.png") });
await browser.close();
console.log("Wrote src/og-home.png");
