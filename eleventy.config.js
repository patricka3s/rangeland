// Builds the site from src/ (page templates) and data/ (sources, facts, definitions).
// Run `npm run build`; the finished site lands in _site/.
//
// Pages pull figures in with shortcodes, e.g. {% fact "rangeland.aadt.gunn.2023" %}.
// The build stops with an error if a page asks for a fact that does not exist,
// or if a fact names a source that does not exist - so a typo can never reach
// the live site as a blank or a wrong number.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import yaml from "js-yaml";

const DATA = "data";
const STATUSES = ["current", "disputed", "superseded"];
const MINUS = "−";

// Headings for the kinds of fact, from the second part of a fact id
// ("rangeland.aadt.gunn.2023" -> "aadt"). Used on the Figures and sources page.
const TOPICS = {
  aadt: "Daily traffic",
  los: "Intersection grades (level of service, evening peak)",
  cost: "Cost",
  matrix: "Alternatives matrix",
  "length-miles": "The project",
};

function load(file) {
  // CORE_SCHEMA keeps dates as plain text instead of turning them into Date objects.
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: yaml.CORE_SCHEMA }) || [];
}

function loadData() {
  const sources = load(path.join(DATA, "sources.yaml"));
  const definitions = load(path.join(DATA, "definitions.yaml"));
  const site = load(path.join(DATA, "site.yaml"));
  const projects = load(path.join(DATA, "projects.yaml"));
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
  const projectIds = new Set(projects.map((p) => p.id));
  for (const file of new Set(facts.map((f) => f.file))) {
    const id = file.replace(/\.ya?ml$/, "");
    if (!projectIds.has(id)) problems.push(`facts/${file}: there is no project "${id}" in projects.yaml`);
  }
  const byId = {};
  for (const f of facts) {
    const where = `facts/${f.file}: "${f.id}"`;
    for (const k of ["id", "statement", "value", "unit", "source", "as_of", "status"]) {
      if (f[k] === undefined || f[k] === null || f[k] === "") problems.push(`${where} is missing "${k}"`);
    }
    if (byId[f.id]) problems.push(`${where} is listed twice`);
    const project = f.file.replace(/\.ya?ml$/, "");
    if (f.id && !String(f.id).startsWith(project + ".")) problems.push(`${where} should start with "${project}." to match its file`);
    if (f.source && !sourceIds.has(f.source)) problems.push(`${where} names source "${f.source}", which is not in sources.yaml`);
    if (f.status && !STATUSES.includes(f.status)) problems.push(`${where} has status "${f.status}"; use ${STATUSES.join(", ")}`);
    byId[f.id] = f;
  }
  // A fact that replaces another must point at a real, superseded fact, and each
  // fact can be replaced only once - so every history is a single straight line.
  const replacedBy = {};
  for (const f of facts) {
    if (!f.replaces) continue;
    const where = `facts/${f.file}: "${f.id}"`, old = byId[f.replaces];
    if (!old) { problems.push(`${where} replaces "${f.replaces}", which does not exist`); continue; }
    if (old.status !== "superseded") problems.push(`${where} replaces "${f.replaces}", which should then have status: superseded`);
    if (replacedBy[f.replaces]) problems.push(`"${f.replaces}" is replaced by both "${replacedBy[f.replaces]}" and "${f.id}"`);
    replacedBy[f.replaces] = f.id;
  }
  for (const f of facts) {
    if (f.change_note && !f.replaces) problems.push(`facts/${f.file}: "${f.id}" has a change_note but replaces nothing`);
    const seen = new Set([f.id]);
    for (let r = f.replaces; r && byId[r]; r = byId[r].replaces) {
      if (seen.has(r)) { problems.push(`"${f.id}": its replaces chain loops back on itself`); break; }
      seen.add(r);
    }
  }
  for (const d of definitions) {
    if (d.source && !sourceIds.has(d.source)) problems.push(`definitions.yaml: "${d.id}" names source "${d.source}", which is not in sources.yaml`);
  }
  if (problems.length) throw new Error("Data check failed:\n  " + problems.join("\n  "));
  const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
  return { site, projects, sources, definitions, facts, byId, sourceById, replacedBy };
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
// "2026-09-24" -> "24 Sep 2026"; "2024-12" -> "Dec 2024"; anything else as written.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function when(d) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(d ?? ""));
  if (!m) return d ?? "";
  return [m[3] && +m[3], m[2] && MONTHS[+m[2] - 1], m[1]].filter(Boolean).join(" ");
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

  eleventyConfig.addGlobalData("site", data.site);
  eleventyConfig.addGlobalData("sources", data.sources);
  eleventyConfig.addGlobalData("definitions", data.definitions);
  eleventyConfig.addGlobalData("facts", data.byId);
  eleventyConfig.addWatchTarget(DATA);

  // Which version of the site this is, shown in small print at the foot of the
  // page so it is easy to tell whether a change has gone live. On GitHub the
  // commit comes from the workflow; on your own computer, from git. When the
  // commit is a pull request being merged, its number is shown too - that is
  // known before merging, so a pull request can say what the page will show.
  let sha = process.env.GITHUB_SHA || "";
  if (!sha) {
    try { sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch (e) { sha = ""; }
  }
  let pr = "";
  try {
    const subject = execSync("git log -1 --format=%s", { encoding: "utf8" }).trim();
    pr = (/^Merge pull request #(\d+)/.exec(subject) || /\(#(\d+)\)$/.exec(subject) || [])[1] || "";
  } catch (e) { pr = ""; }
  const repo = process.env.GITHUB_REPOSITORY || "patricka3s/rangeland";
  const built = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date());
  eleventyConfig.addGlobalData("build", {
    version: sha ? sha.slice(0, 7) : "local",
    url: sha && process.env.GITHUB_REPOSITORY ? `https://github.com/${repo}/commit/${sha}` : "",
    pr, prUrl: pr ? `https://github.com/${repo}/pull/${pr}` : "",
    when: built,
  });

  // A fact the way people read it: numbers with thousands commas, money as
  // $150.0M (or "$150.0 million" in words), ranges as 58,700–64,800.
  function display(f, words) {
    const v = f.value;
    if (v && typeof v === "object") return num(v.low) + "–" + num(v.high);
    if (typeof v !== "number") return String(v);
    if (f.unit === "USD million") {
      return words ? "$" + num(v, f.decimals ?? 1) + " million" : usdM(v, f.decimals ?? 1);
    }
    if (f.unit.startsWith("USD")) return "$" + num(v, f.decimals ?? 0);
    return num(v, f.decimals ?? 0);
  }

  // The figure with its unit: "23,500 vehicles per day", "Grade F", "$150.0M".
  function withUnit(f) {
    const d = display(f);
    if (f.unit === "USD million") return d;
    if (f.unit.startsWith("USD ")) return d + f.unit.slice(3);
    if (f.unit === "grade") return "Grade " + d;
    if (f.unit === "rating") return d + " (rating)";
    return d + " " + f.unit;
  }

  // Link to the error-report form with the first question filled in: the fact's
  // id, what it states and its value - so a report always says which figure.
  function reportUrl(f) {
    const form = data.site.dispute_form;
    return `${form.url}?usp=pp_url&${form.field}=` +
      encodeURIComponent(`${f.id} — ${f.statement}: ${display(f)}`);
  }

  // Everything a page needs to show one fact.
  function card(f) {
    return { ...f, display: display(f), withUnit: withUnit(f), report: reportUrl(f), asOf: when(f.as_of), checkedOn: when(f.checked), src: data.sourceById[f.source] };
  }
  // A fact's earlier versions, oldest first ([] if it replaces nothing).
  function earlier(f) {
    const out = [];
    for (let r = f.replaces; r; r = data.byId[r].replaces) out.unshift(card(data.byId[r]));
    return out;
  }
  // Did the value itself change anywhere along the way, or only the document?
  const sameValue = (a, b) => JSON.stringify(a.value) === JSON.stringify(b.value);

  // For the Figures and sources page: "What's changed" - one entry for every
  // time a newer document replaced a figure, newest first, grouped by document.
  const changes = data.facts.filter((f) => f.replaces).map((f) => {
    const old = data.byId[f.replaces];
    return { id: f.id, statement: f.statement, from: withUnit(old), fromAsOf: when(old.as_of),
             to: withUnit(f), same: sameValue(old, f), note: f.change_note,
             asOf: f.as_of, when: when(f.as_of), src: data.sourceById[f.source] };
  }).sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
  const changeGroups = [];
  for (const c of changes) {
    let g = changeGroups.find((x) => x.asOf === c.asOf && x.src.id === c.src.id);
    if (!g) changeGroups.push((g = { asOf: c.asOf, when: c.when, src: c.src, items: [] }));
    g.items.push(c);
  }
  eleventyConfig.addGlobalData("changeGroups", changeGroups);
  eleventyConfig.addGlobalData("changeCount", changes.filter((c) => !c.same).length);

  // For the Figures and sources page: facts grouped by project, then by kind,
  // in the order they appear in each facts file. A fact another one replaced
  // is not listed on its own - it appears in its replacement's history.
  const groups = data.projects.map((p) => {
    const topics = [];
    for (const f of data.facts.filter((x) => x.id.startsWith(p.id + ".") && !data.replacedBy[x.id])) {
      const key = f.id.split(".")[1];
      let t = topics.find((x) => x.key === key);
      if (!t) topics.push((t = { key, label: TOPICS[key] || key, facts: [] }));
      const history = earlier(f);
      t.facts.push({ ...card(f), history, revised: history.some((h) => !sameValue(h, f)) });
    }
    return { ...p, topics };
  }).filter((p) => p.topics.length);
  eleventyConfig.addGlobalData("factGroups", groups);
  eleventyConfig.addGlobalData("sourceList", data.sources.map((s) => ({
    ...s, dateText: when(s.date), figures: data.facts.filter((f) => f.source === s.id).length,
  })));

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
        s: f.statement, v: withUnit(f), asof: f.as_of, st: f.status,
        loc: f.location, note: f.note, r: reportUrl(f), ck: f.checked,
        was: f.replaces ? withUnit(data.byId[f.replaces]) + " (" + when(data.byId[f.replaces].as_of) + ")" : undefined,
        now: data.replacedBy[f.id] ? withUnit(data.byId[data.replacedBy[f.id]]) + " (" + when(data.byId[data.replacedBy[f.id]].as_of) + ")" : undefined,
        src: { t: src.title, p: src.publisher, d: src.date, url: src.url },
      };
    }
    const json = JSON.stringify({ facts: out }).replace(/</g, "\\u003c");
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
  // {% product "a", "b", scale, decimals %}  ->  a x b x scale, e.g. a per-acre
  // rate times acres, scaled to millions: {% product "rate", "acres", 0.000001, 1 %} -> "6.9"
  eleventyConfig.addShortcode("product", (a, b, scale = 1, decimals = 0) => num(value(a) * value(b) * scale, decimals));
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
