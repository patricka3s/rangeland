// Makes a private preview copy of the built site, for Patrick to look at
// before he merges a pull request. Run after `npm run build`:
//
//   npm run preview        (builds, then writes _preview/)
//
// Claude then publishes _preview/ as a private claude.ai page and gives Patrick
// the link. The copy differs from the live site in three ways only:
//  - links to folders ("sunlake/") point at the file ("sunlake/index.html"),
//    because the preview host doesn't open a folder's index page by itself;
//  - the GoatCounter visit counter is removed, so previews don't count as visits;
//  - a banner at the top of each page says it's a preview.
import fs from "node:fs";
import path from "node:path";

const SRC = "_site", OUT = "_preview";
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });

const pr = process.env.PREVIEW_PR ? ` for pull request #${process.env.PREVIEW_PR}` : "";
const banner = `<div style="background:#12161D;color:#fff;font:600 12px/1.4 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:8px 16px;text-align:center">Preview${pr} &#183; not the live site</div>`;

// "sunlake/" -> "sunlake/index.html", "../" -> "../index.html", "./" -> "index.html",
// keeping any #anchor. Only relative links; http:, mailto:, data: are left alone.
const fixLink = (u) => {
  if (/^([a-z]+:|#|\/\/)/i.test(u)) return u;
  const [p, hash] = u.split(/(?=#)/);
  if (p === "./") return "index.html" + (hash || "");
  return p.endsWith("/") ? p + "index.html" + (hash || "") : u;
};

const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(OUT);
for (const f of files) {
  if (f.endsWith(".html")) {
    let s = fs.readFileSync(f, "utf8");
    s = s.replace(/href="([^"]*)"/g, (m, u) => `href="${fixLink(u)}"`);
    s = s.replace(/<script data-goatcounter[^>]*>\s*<\/script>/g, "");
    s = s.replace('location.replace("rangeland/" + location.hash)', 'location.replace("rangeland/index.html" + location.hash)');
    s = s.replace(/(<body[^>]*>)/, `$1\n${banner}`);
    fs.writeFileSync(f, s);
  } else if (f.endsWith("app.js")) {
    let s = fs.readFileSync(f, "utf8");
    s = s.replace('"facts/#"', '"facts/index.html#"');
    fs.writeFileSync(f, s);
  }
}
console.log(`Preview written to ${OUT}/: ${files.length} files`);
console.log(files.map((f) => path.relative(OUT, f)).join("\n"));
