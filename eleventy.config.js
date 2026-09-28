// Builds the site from src/ (page templates) and data/ (sources, facts, definitions).
// Run `npm run build`; the finished site lands in _site/.
//
// Pages pull figures in with shortcodes, e.g. {% fact "rangeland.aadt.gunn.2023" %}.
// The build stops with an error if a page asks for a fact that does not exist,
// or if a fact names a source that does not exist - so a typo can never reach
// the live site as a blank or a wrong number.

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const DATA = "data";
const STATUSES = ["current", "disputed", "superseded"];
const MINUS = "−";

function load(file) {
  // CORE_SCHEMA keeps dates as plain text instead of turning them into Date objects.
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: yaml.CORE_SCHEMA }) || [];
}

function loadData() {
  const sources = load(path.join(DATA, "sources.yaml"));
  const definitions = load(path.join(DATA, "definitions.yaml"));
  const site = load(path.join(DATA, "site.yaml"));
  const factDir = path.join(DATA, "facts");
  const facts = fs.readdirSync(factDir)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => load(path.join(factDir, f)).map((x) => ({ ...x, file: f })));

  const problems = [];
  const sourceIds = new Set();
  for (const s of sources) {
    if (!s.id || !s.title) problems.push(`sources.yaml: an entry is missing id or title (${s.id || s.title})`);
    if (sourceIds.has(s.id)) problems.push(`sources.yaml: duplicate id "${s.id}"`);
    sourceIds.add(s.id);
  }
  const byId = {};
  for (const f of facts) {
    const where = `facts/${f.file}: "${f.id}"`;
    for (const k of ["id", "statement", "value", "unit", "source", "as_of", "status"]) {
      if (f[k] === undefined || f[k] === null || f[k] === "") problems.push(`${where} is missing "${k}"`);
    }
    if (byId[f.id]) problems.push(`${where} is listed twice`);
    if (f.source && !sourceIds.has(f.source)) problems.push(`${where} names source "${f.source}", which is not in sources.yaml`);
    if (f.status && !STATUSES.includes(f.status)) problems.push(`${where} has status "${f.status}"; use ${STATUSES.join(", ")}`);
    byId[f.id] = f;
  }
  for (const d of definitions) {
    if (d.source && !sourceIds.has(d.source)) problems.push(`definitions.yaml: "${d.id}" names source "${d.source}", which is not in sources.yaml`);
  }
  if (problems.length) throw new Error("Data check failed:\n  " + problems.join("\n  "));
  const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
  return { site, sources, definitions, facts, byId, sourceById };
}

// ---- formatting

function num(v, decimals = 0) {
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function signed(n, decimals = 0) {
  return (n > 0 ? "+" : n < 0 ? MINUS : "") + num(Math.abs(n), decimals);
}
function usdM(v, decimals = 1) {
  return "$" + num(v, decimals) + "M";
}

export default function (eleventyConfig) {
  const data = loadData();
  const get = (id) => {
    const f = data.byId[id];
    if (!f) throw new Error(`Page asks for fact "${id}", which is not in data/facts/.`);
    return f;
  };
  const value = (id) => {
    const v = get(id).value;
    if (typeof v !== "number") throw new Error(`Fact "${id}" is not a single number.`);
    return v;
  };

  eleventyConfig.addGlobalData("sources", data.sources);
  eleventyConfig.addGlobalData("definitions", data.definitions);
  eleventyConfig.addGlobalData("facts", data.byId);
  eleventyConfig.addWatchTarget(DATA);

  // A fact the way people read it: numbers with thousands commas, money as
  // $150.0M (or "$150.0 million" in words), ranges as 58,700–64,800.
  function display(f, words) {
    const v = f.value;
    if (v && typeof v === "object") return num(v.low) + "–" + num(v.high);
    if (typeof v !== "number") return String(v);
    if (f.unit === "USD million") {
      return words ? "$" + num(v, f.decimals ?? 1) + " million" : usdM(v, f.decimals ?? 1);
    }
    return num(v, f.decimals ?? 0);
  }

  // {% fact "id" %} prints a fact as a small button; tapping it shows the fact's
  // source and a link to report an error in it (see FACT DETAILS in app.js).
  // {% fact "id", "words" %} writes money out as "$150.0 million".
  // {% fact "id", "plain" %} prints the bare text - for use inside JavaScript.
  eleventyConfig.addShortcode("fact", (id, style) => {
    const f = get(id), text = display(f, style === "words");
    if (style === "plain") return text;
    return `<button type="button" class="fact" data-fact="${id}">${text}</button>`;
  });

  // {% factData %} writes every fact, with its source, into the page as JSON,
  // so the details box can show them without another download.
  eleventyConfig.addShortcode("factData", () => {
    const out = {};
    for (const f of data.facts) {
      const src = data.sourceById[f.source];
      out[f.id] = {
        s: f.statement, v: display(f), u: f.unit, asof: f.as_of, st: f.status,
        loc: f.location, note: f.note,
        src: { t: src.title, p: src.publisher, d: src.date, url: src.url },
      };
    }
    const json = JSON.stringify({ form: data.site.dispute_form, facts: out }).replace(/</g, "\\u003c");
    return `<script type="application/json" id="fact-data">${json}</script>`;
  });

  // {% js "id" %} prints a fact for use inside JavaScript: 18000, "F", or with a
  // second argument one end of a range: {% js "id", "high" %}.
  eleventyConfig.addShortcode("js", (id, part) => {
    const v = get(id).value;
    return JSON.stringify(part ? v[part] : v);
  });

  // ---- simple analyses: arithmetic on facts, so the result can never drift from them

  // {% diff "a", "b" %}  ->  b minus a, signed: "+2,000", "−10,000".  {% diff "a", "b", "M" %} for money.
  eleventyConfig.addShortcode("diff", (a, b, style) => {
    const d = value(b) - value(a);
    return style === "M" ? signed(Math.round(d * 10) / 10, 1) : signed(d);
  });
  // {% diffClass "a", "b" %}  ->  "up", "down" or "flat", for colouring a table cell.
  eleventyConfig.addShortcode("diffClass", (a, b) => {
    const d = value(b) - value(a);
    return d > 0 ? "up" : d < 0 ? "down" : "flat";
  });
  // {% perMile "cost id", "length id" %}  ->  "$44.0M";  add "words" for "$44.0 million"
  eleventyConfig.addShortcode("perMile", (cost, miles, style) => {
    const v = value(cost) / value(miles);
    return style === "words" ? "$" + num(v, 1) + " million" : usdM(v);
  });

  // ---- level-of-service chart (section 5)
  // One row per intersection: today, 2050 no-build and 2050 build markers placed on
  // an A-F axis. Markers that share a grade are nudged apart so all three show.
  const LOS_X = { A: 400, B: 495, C: 590, D: 685, E: 780, F: 875 };
  const NUDGE = 21, LOS_MIN = 400;
  eleventyConfig.addShortcode("losChartRow", (key, index, name, prefix = "rangeland.los") => {
    const kinds = [["now", "2023"], ["nob", "2050-nobuild"], ["bld", "2050-build"]];
    const g = kinds.map(([, sc]) => get(`${prefix}.${key}.${sc}`).value);
    const x = g.map((grade) => {
      if (!(grade in LOS_X)) throw new Error(`Fact "${prefix}.${key}" has grade "${grade}"; expected A-F.`);
      return LOS_X[grade];
    });
    // spread each group of equal grades around its column; at the A end, where
    // there is no room to the left, push the group rightward instead
    const groups = {};
    g.forEach((grade, i) => (groups[grade] ||= []).push(i));
    for (const idx of Object.values(groups)) {
      if (idx.length < 2) continue;
      const base = LOS_X[g[idx[0]]];
      let pos = idx.map((_, k) => base + (k - (idx.length - 1) / 2) * NUDGE);
      const shift = Math.max(0, LOS_MIN - pos[0]);
      pos = pos.map((p) => p + shift);
      idx.forEach((i, k) => (x[i] = pos[k]));
    }
    const y = 72 + 28 * index, ty = y + 4, f = (n) => n.toFixed(1);
    const lo = Math.min(...x), hi = Math.max(...x);
    const title = `${name}: ${g[0]} today, ${g[1]} in 2050 with no project, ${g[2]} in 2050 with Alternative A`;
    let s = `<g class="l-row"><title>${title}</title>\n`;
    s += `        <text class="l-name" x="380" y="${ty}" text-anchor="end">${name}</text>\n`;
    s += `        <line class="l-conn" x1="${f(lo)}" y1="${y}" x2="${f(hi)}" y2="${y}"/>\n`;
    kinds.forEach(([cls], i) => {
      s += `        <circle class="l-${cls}" cx="${f(x[i])}" cy="${y}" r="10"/><text class="l-letter" x="${f(x[i])}" y="${ty}" text-anchor="middle">${g[i]}</text>\n`;
    });
    return s + "        </g>";
  });

  eleventyConfig.addPassthroughCopy({ "src/styles.css": "styles.css", "src/og-image.png": "og-image.png" });

  return {
    dir: { input: "src", output: "_site" },
    templateFormats: ["njk"],
  };
}
