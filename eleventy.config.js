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
  funding: "Funding (county capital improvement plan)",
  design: "Road design",
  schedule: "Schedule and process",
  trucks: "Trucks",
  related: "Related studies",
  claim: "Statements, designations and quotes",
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
    // ai_checked: when Claude checked it against the document; verified: when Patrick did.
    if (f.checked !== undefined) problems.push(`${where} uses "checked"; it is now "ai_checked" (Claude) or "verified" (Patrick)`);
    for (const k of ["ai_checked", "verified"]) {
      if (f[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(f[k]))) problems.push(`${where} has ${k} "${f[k]}"; use a date like '2026-09-28'`);
    }
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
  // Events (the timeline): same rules as facts - a real source, a known project,
  // a known type and a readable date.
  const EVENT_TYPES = ["meeting", "milestone", "decision", "contract", "change-order", "document", "deadline", "planned"];
  const events = load(path.join(DATA, "events.yaml"));
  const eventIds = new Set();
  for (const e of events) {
    const where = `events.yaml: "${e.id}"`;
    for (const k of ["id", "date", "project", "type", "title", "source"]) {
      if (e[k] === undefined || e[k] === null || e[k] === "") problems.push(`${where} is missing "${k}"`);
    }
    if (eventIds.has(e.id)) problems.push(`${where} is listed twice`);
    eventIds.add(e.id);
    e.projects = [].concat(e.project || []);
    for (const p of e.projects) if (!projectIds.has(p)) problems.push(`${where} names project "${p}", which is not in projects.yaml`);
    if (e.type && !EVENT_TYPES.includes(e.type)) problems.push(`${where} has type "${e.type}"; use ${EVENT_TYPES.join(", ")}`);
    if (e.source && !sourceIds.has(e.source)) problems.push(`${where} names source "${e.source}", which is not in sources.yaml`);
    if (!/^(\d{4}-\d{2}(-\d{2})?|FY\d{4})$/.test(String(e.date))) problems.push(`${where} has date "${e.date}"; use YYYY-MM-DD, YYYY-MM or FY2027`);
    if ((e.type === "planned") !== /^FY/.test(String(e.date)) && !(e.type === "planned" && e.when))
      problems.push(`${where}: planned items use a fiscal-year date (FY2027) or a 'when'; other events use a calendar date`);
    for (const f of e.facts || []) if (!byId[f]) problems.push(`${where} lists fact "${f}", which does not exist`);
    if (e.moved !== undefined) {
      const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d));
      if (!e.moved || !ok(e.moved.to) || (e.moved.from !== undefined && !ok(e.moved.from)))
        problems.push(`${where} has "moved" without dates; use {from: 'YYYY-MM-DD', to: 'YYYY-MM-DD'}`);
    }
  }
  for (const d of definitions) {
    if (d.source && !sourceIds.has(d.source)) problems.push(`definitions.yaml: "${d.id}" names source "${d.source}", which is not in sources.yaml`);
    for (const k of ["ai_checked", "verified"]) {
      if (d[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(d[k]))) problems.push(`definitions.yaml: "${d.id}" has ${k} "${d[k]}"; use a date like '2026-09-28'`);
    }
  }
  if (problems.length) throw new Error("Data check failed:\n  " + problems.join("\n  "));
  const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
  return { site, projects, sources, definitions, facts, byId, sourceById, replacedBy, events };
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
  // The reader-checks address (data/site.yaml); READER_CHECKS_URL overrides it for local testing.
  const readerChecksUrl = process.env.READER_CHECKS_URL || (data.site.reader_checks && data.site.reader_checks.url) || "";
  eleventyConfig.addGlobalData("readerChecks", readerChecksUrl);
  eleventyConfig.addGlobalData("sources", data.sources);
  eleventyConfig.addGlobalData("projects", data.projects);
  eleventyConfig.addGlobalData("definitions", data.definitions.map((d) => ({
    ...d, src: d.source ? data.sourceById[d.source] : null, aiCheckedOn: when(d.ai_checked), verifiedOn: when(d.verified),
  })));
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
    if (f.unit === "date") return when(v);
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
    if (f.unit === "date" || f.unit === "classification" || f.unit === "phase") return d;
    if (f.unit === "percent") return d + "%";
    if (f.unit === "statement") return "\u201C" + d + "\u201D";
    return d + " " + f.unit;
  }



  // Everything a page needs to show one fact.
  function card(f) {
    return { ...f, display: display(f), withUnit: withUnit(f), asOf: when(f.as_of), aiCheckedOn: when(f.ai_checked), verifiedOn: when(f.verified), src: data.sourceById[f.source] };
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
  // time a newer document gave a different figure, newest first, grouped by
  // document. A newer document that repeats the same value isn't a change, so
  // it isn't listed (its figure still shows a "Reconfirmed" history).
  const changes = data.facts.filter((f) => f.replaces).map((f) => {
    const old = data.byId[f.replaces];
    return { id: f.id, statement: f.statement, from: withUnit(old), fromAsOf: when(old.as_of),
             to: withUnit(f), same: sameValue(old, f), note: f.change_note,
             asOf: f.as_of, when: when(f.as_of), src: data.sourceById[f.source] };
  }).filter((c) => !c.same).sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
  const changeGroups = [];
  for (const c of changes) {
    let g = changeGroups.find((x) => x.asOf === c.asOf && x.src.id === c.src.id);
    if (!g) changeGroups.push((g = { asOf: c.asOf, when: c.when, src: c.src, items: [] }));
    g.items.push(c);
  }
  eleventyConfig.addGlobalData("changeGroups", changeGroups);
  eleventyConfig.addGlobalData("changeCount", changes.length);

  // ---- Timeline (data/events.yaml)
  // Sort key: a calendar date as written (a month sorts as its 15th); fiscal
  // year N as 1 October of N-1, when it begins.
  const sortKey = (d) => {
    const s = String(d), fy = /^FY(\d{4})$/.exec(s);
    if (fy) return `${+fy[1] - 1}-10-01`;
    return s.length === 7 ? s + "-15" : s;
  };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const projectName = Object.fromEntries(data.projects.map((p) => [p.id, p.short || p.name.split(" - ")[0]]));
  const TYPE_LABEL = { meeting: "Meeting", milestone: "Milestone", decision: "Decision", contract: "Contract",
    "change-order": "Change order", document: "Document", deadline: "Deadline", planned: "Planned" };
  // The bigger moments get a bigger dot and a bold title on the Timeline.
  const MAJOR = new Set(["meeting", "decision", "deadline"]);
  const events = data.events.map((e) => {
    const key = sortKey(e.date);
    const fy = /^FY(\d{4})$/.exec(String(e.date));
    // A moved completion date is written into the title for plain lists ("from X to Y");
    // the Timeline shows it separately, with the old date struck through.
    const movedText = e.moved ? (e.moved.from ? ` from ${when(e.moved.from)}` : "") + ` to ${when(e.moved.to)}` : "";
    return {
      ...e, key,
      short: e.title,
      title: e.title + movedText,
      movedFrom: e.moved && e.moved.from ? when(e.moved.from) : "",
      movedTo: e.moved ? when(e.moved.to) : "",
      major: MAJOR.has(e.type),
      shown: e.when || (fy ? `FY ${fy[1]}` : when(e.date)),
      typeLabel: TYPE_LABEL[e.type],
      projectNames: e.projects.map((p) => projectName[p]),
      projectTags: e.projects.map((p) => ({ id: p, name: projectName[p].replace(/ corridor$/, "") })),
      src: data.sourceById[e.source],
      factCards: (e.facts || []).map((id) => card(data.byId[id])),
      changed: e.show_changes ? changes.filter((c) => c.asOf === e.date).length : 0,
      status: e.type === "planned" ? "planned" : key > today ? "upcoming" : "past",
    };
  });
  const byKeyDesc = (a, b) => b.key.localeCompare(a.key);
  eleventyConfig.addGlobalData("timeline", {
    today, todayShown: when(today),
    planned: events.filter((e) => e.status === "planned").sort(byKeyDesc),
    upcoming: events.filter((e) => e.status === "upcoming").sort(byKeyDesc),
    past: events.filter((e) => e.status === "past").sort(byKeyDesc),
    types: Object.entries(TYPE_LABEL).map(([k, label]) => ({ k, label })),
    projects: data.projects.map((p) => ({ id: p.id, name: projectName[p.id] })),
  });
  // Latest past events for one project, and its upcoming ones - for the
  // "What's happened lately" box on a guide page.
  eleventyConfig.addGlobalData("recentEvents", Object.fromEntries(data.projects.map((p) => [p.id, {
    upcoming: events.filter((e) => e.status === "upcoming" && e.projects.includes(p.id)).sort((a, b) => a.key.localeCompare(b.key)),
    past: events.filter((e) => e.status === "past" && e.projects.includes(p.id)).sort(byKeyDesc).slice(0, 5),
  }])));

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
  // Per project, for the home page cards: figures listed, and how many a human has verified.
  const projectChecks = Object.fromEntries(groups.map((p) => {
    const fs = p.topics.flatMap((t) => t.facts);
    return [p.id, { total: fs.length, human: fs.filter((f) => f.verified).length }];
  }));
  eleventyConfig.addGlobalData("projectChecks", projectChecks);
  // Publishing rule (Patrick, 29 Sep 2026): a new project goes live (page: true in
  // projects.yaml) only once Patrick has verified at least this share of its figures.
  const PUBLISH_THRESHOLD = 90;
  eleventyConfig.addGlobalData("publishThreshold", PUBLISH_THRESHOLD);
  for (const p of data.projects) {
    if (!p.page || p.published_before_rule) continue;
    const ck = projectChecks[p.id] || { total: 0, human: 0 };
    const pct = ck.total ? Math.floor(ck.human / ck.total * 100) : 0;
    if (pct < PUBLISH_THRESHOLD) throw new Error(`Publishing rule: project "${p.id}" has page: true but Patrick has verified only ${ck.human} of its ${ck.total} figures (${pct}%). New projects need ${PUBLISH_THRESHOLD}% before they are published - see data/projects.yaml.`);
  }
  // How many of the listed figures a human has verified, and how many only AI has checked.
  const listed = groups.flatMap((p) => p.topics.flatMap((t) => t.facts));
  eleventyConfig.addGlobalData("checkCounts", {
    total: listed.length,
    human: listed.filter((f) => f.verified).length,
    ai: listed.filter((f) => f.ai_checked).length,
    unchecked: listed.filter((f) => !f.verified && !f.ai_checked).length,
    // For the progress bar: each figure in exactly one state, as whole-number
    // percentages that add up to 100 (largest remainder).
    bar: (() => {
      const n = listed.length || 1;
      const parts = [
        { k: "human", label: "Verified by a human", count: listed.filter((f) => f.verified).length },
        { k: "ai", label: "Checked by AI only", count: listed.filter((f) => !f.verified && f.ai_checked).length },
        { k: "none", label: "Not yet checked", count: listed.filter((f) => !f.verified && !f.ai_checked).length },
      ];
      parts.forEach((p) => { p.exact = p.count / n * 100; p.pct = Math.floor(p.exact); });
      let left = 100 - parts.reduce((t, p) => t + p.pct, 0);
      [...parts].sort((a, b) => (b.exact - b.pct) - (a.exact - a.pct)).forEach((p) => { if (left > 0 && p.count) { p.pct++; left--; } });
      return parts;
    })(),
  });
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
  eleventyConfig.addShortcode("factData", function () {
    // how far this page sits below the site root, so links to facts/ work from any folder
    const depth = Math.max(0, ((this.page && this.page.url) || "/").split("/").length - 2);
    const out = {};
    for (const f of data.facts) {
      const src = data.sourceById[f.source];
      out[f.id] = {
        s: f.statement, v: withUnit(f), asof: f.as_of, st: f.status,
        loc: f.location, note: f.note, ai: f.ai_checked, vf: f.verified,
        was: f.replaces ? withUnit(data.byId[f.replaces]) + " (" + when(data.byId[f.replaces].as_of) + ")" : undefined,
        now: data.replacedBy[f.id] ? withUnit(data.byId[data.replacedBy[f.id]]) + " (" + when(data.byId[data.replacedBy[f.id]].as_of) + ")" : undefined,
        src: { t: src.title, p: src.publisher, d: src.date, url: src.url },
      };
    }
    // Definitions open in the same box: {% src "def.collector" %}
    for (const d of data.definitions) {
      const src = d.source ? data.sourceById[d.source] : null;
      out["def." + d.id] = {
        s: "Definition: " + d.term, v: d.definition, st: "current",
        loc: d.location, note: d.note, ai: d.ai_checked, vf: d.verified, def: 1,
        src: src ? { t: src.title, p: src.publisher, d: src.date, url: src.url } : { t: "General explanation, not from one document" },
      };
    }
    const json = JSON.stringify({ root: "../".repeat(depth), rc: readerChecksUrl || undefined, facts: out }).replace(/</g, "\\u003c");
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
    if (style === "abs") return num(Math.abs(d));       // "10,000", for prose: "about 10,000 fewer"
    return style === "M" ? signed(Math.round(d * 10) / 10, 1) : signed(d);
  });
  // {% sum "a", "b", ..., 0 %}  ->  the total of several facts, to that many decimals
  // (the last argument). E.g. the corridor's length from its three project sheets.
  eleventyConfig.addShortcode("sum", (...args) => {
    const decimals = typeof args[args.length - 1] === "number" ? args.pop() : 0;
    return num(args.reduce((t, id) => t + value(id), 0), decimals);
  });
  // {% share "a", "a", "b", "c" %}  ->  a as a percentage of a+b+c, for widths: "33.1"
  eleventyConfig.addShortcode("share", (part, ...all) => (value(part) / all.reduce((t, id) => t + value(id), 0) * 100).toFixed(1));

  // Level-of-service counts, worked out from the grade facts rather than typed:
  // {% losTotal "rangeland.los" %} -> intersections graded in every scenario;
  // {% losCount "rangeland.los", "2050-nobuild", "F" %} -> how many are at that grade;
  // {% losWorse "rangeland.los", "2023", "2050-build" %} -> how many are worse in the second.
  const losKeys = (prefix) => [...new Set(data.facts.filter((f) => f.id.startsWith(prefix + ".") && f.status === "current")
    .map((f) => f.id.slice(prefix.length + 1).split(".")[0]))];
  const grade = (prefix, key, sc) => String(get(`${prefix}.${key}.${sc}`).value);
  eleventyConfig.addShortcode("losTotal", (prefix) => String(losKeys(prefix).length));
  eleventyConfig.addShortcode("losCount", (prefix, sc, g) => String(losKeys(prefix).filter((k) => grade(prefix, k, sc) === g).length));
  eleventyConfig.addShortcode("losWorse", (prefix, from, to) =>
    String(losKeys(prefix).filter((k) => grade(prefix, k, to) > grade(prefix, k, from)).length));
  // {% losSame "rangeland.los", "2050-nobuild", "2050-build" %} -> how many get the same grade in both.
  eleventyConfig.addShortcode("losSame", (prefix, a, b) =>
    String(losKeys(prefix).filter((k) => grade(prefix, k, a) === grade(prefix, k, b)).length));

  // {% calc "id", "id", "prefix*" %}...{% endcalc %}  ->  marks a figure worked out
  // from facts (a sum, a count). Tapping it opens the slide's source list, which
  // then includes the facts it was worked out from. "prefix*" means every current
  // fact whose id starts with prefix.
  eleventyConfig.addPairedShortcode("calc", (content, ...ids) => {
    const all = ids.flatMap((id) => id.endsWith("*")
      ? data.facts.filter((f) => f.id.startsWith(id.slice(0, -1)) && f.status === "current").map((f) => f.id)
      : [get(id).id]);
    return `<button type="button" class="calc" data-calc="${all.join(" ")}" title="Worked out from the figures listed under Sources on this slide">${content.trim()}</button>`;
  });

  // {% src "id" %}  ->  a small superscript "source" mark after a claim (a statement,
  // designation or quote, stored as a fact with unit "statement"). Tapping it opens
  // the same details box as a figure.
  eleventyConfig.addShortcode("src", (id) => {
    if (id.startsWith("def.")) {
      if (!data.definitions.some((d) => "def." + d.id === id)) throw new Error(`Definition "${id.slice(4)}" is not in definitions.yaml`);
    } else get(id);
    return `<button type="button" class="fact srcmark" data-fact="${id}" aria-label="Source for this statement"><sup>\u2020</sup></button>`;
  });
  // {% diffClass "a", "b" %}  ->  "up", "down" or "flat", for colouring a table cell.
  eleventyConfig.addShortcode("diffClass", (a, b) => {
    const d = value(b) - value(a);
    return d > 0 ? "up" : d < 0 ? "down" : "flat";
  });
  // {% product "a", "b", scale, decimals %}  ->  a x b x scale, e.g. a per-acre
  // rate times acres, scaled to millions: {% product "rate", "acres", 0.000001, 1 %} -> "6.9"
  eleventyConfig.addShortcode("product", (a, b, scale = 1, decimals = 0) => num(value(a) * value(b) * scale, decimals));
  // {% sumM "a", "b", ... %}  ->  the total of several USD-million facts: "$88.4M"
  eleventyConfig.addShortcode("sumM", (...ids) => usdM(ids.reduce((t, id) => t + value(id), 0)));
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
