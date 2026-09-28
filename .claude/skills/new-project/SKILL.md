---
name: new-project
description: Add a new Pasco County road project to the site - find and register its documents, report what exists, extract checked facts, and build its page from the common template. Use when Patrick asks to cover a new project (e.g. "/new-project Sunlake Blvd").
---

# Adding a road project

Follow these steps in order. **Stop at the two marked checkpoints and wait for
Patrick.** Everything in CLAUDE.md still applies - especially: every figure is a
fact from a document you have actually read, facts stay apart from analysis, and
every project is treated the same way.

## 1. Identify the project

Pin down exactly which project is meant: its name, termini (from / to), the MPO or
FDOT project number (e.g. 454568-1), and LRTP number if it has one. The MPO's List
of Project Priorities is the quickest place to confirm this. If the request could
mean more than one project or segment, ask.

## 2. Find the documents

Search all of these, and note what each one says about the project. Download PDFs
to the scratchpad and read them (PyMuPDF: `pip install pymupdf`; boards whose
numbers are drawn as graphics must be rendered to images and read visually).

| Where | What to look for | How |
|---|---|---|
| County project pages | A route study page with newsletters, workshop boards, matrix | `pascocountyfl.gov/community/capital_improvement_projects.php` lists them |
| MPO List of Project Priorities (LOPP) | Row for the project: termini, status, funding years | PDF linked from `pascocountyfl.gov/services/mpo/plans.php` |
| MPO Transportation Improvement Program (TIP) | Same, plus FDOT project number | Same page |
| LRTP 2050, Appendix B project sheets | Length, lanes, cost, scheduled phases | Same page (only some projects have a sheet) |
| County adopted budget (capital plan) | Dollars by fiscal year, per segment | `pascocountyfl.gov/services/office_of_management_and_budget/index.php` - the "Road Improvements" table |
| County Commission agendas | Study and design contracts, change orders, easements, resolutions | CivicClerk API: `https://pascocofl.api.civicclerk.com/v1/Search?search=<terms>&$skip=N` (15 results a page - keep paging); a meeting's items and attachments: `/v1/Meetings/<agendaId>` |
| FDOT | State or federal money | FDOT work program; federal obligations report (`fdotewp1.dot.state.fl.us`) |
| Turnpike / FDOT studies | Interchanges, widenings that touch the project | `floridasturnpike.com` |

Commission agenda attachments and staff memos are stored on
`civicclerk.blob.core.windows.net` (allowed since 28 Sep 2026): in `/v1/Meetings/<agendaId>`
each item's `reportsList` (the memo) and `attachmentsList` give `pdfMediaFullPath` /
`pdfVersionFullPath` download links. Published minutes download from
`/v1/Meetings/GetMeetingFileStream(fileId=<id>,plainText=false)` (file ids are in the
event's `publishedFiles`; find events with `/v1/Events?$filter=startDateTime ge ...`).
Change orders and small task orders often appear as **Noted Items** - "receive and
file", not a vote - so don't describe them as approved by the Board. Only the
minutes record how a vote went; if they aren't published yet, say the outcome isn't
confirmed.
If any other site is blocked, say which and ask - never reconstruct what a
document says from memory or from other pages.

## 3. Report what exists - CHECKPOINT

Before writing any facts or page, give Patrick a short inventory:

- **Found:** each document, its date, and what it tells us (in a line).
- **Not found / not published:** traffic forecasts, alternatives, costs, noise,
  workshops - whatever the standard sections need and nobody has published.
- **Couldn't reach:** blocked or missing documents.
- **Recommendation:** a full guide page, or a short project card until more is
  published.

Wait for Patrick to choose before going on.

## 4. Register sources and extract facts

- Add each document to `data/sources.yaml` (quote any value containing ` #`).
- Add the project to `data/projects.yaml` and create `data/facts/<id>.yaml`.
- Use the same kinds and scenarios as Rangeland wherever the documents support
  them: `aadt`, `los`, `cost`, `matrix`, `length-miles`, plus `funding`
  (`<id>.funding.<phase-or-segment>.fy<year>`) for capital-plan dollars. A new
  kind needs a heading in `TOPICS` in `eleventy.config.js`.
- Every fact gets `location` (where in the document). Once you have compared it
  with the document yourself, add `ai_checked` with the date. Never add `verified`:
  that's Patrick's own check.
- Add the project's events to `data/events.yaml` - the same kinds as other projects
  (workshops, Commission actions, contracts, every change order, plan documents,
  deadlines, and planned phases by fiscal year) - and give it a `short` name in
  `projects.yaml`, a link in `src/_includes/project-bar.njk`, and a tag shade
  (`.pj-<project-id>`) in the Timeline section of `src/styles.css`. A change order
  that moves a completion date gets `moved: {from, to}` rather than dates in its title.
- A figure that a newer document updates: new fact with `replaces:`, old one
  `superseded` - never overwrite.

## 5. Check the facts with Patrick - CHECKPOINT

Give Patrick the list of new facts in document order (what you read, where, and
how confident you are - flag anything read off a map or graphic). He spot-checks
them against the originals and adds his own `verified` dates.

## 6. Build the page

Project pages live at `/<project-id>/` (`src/<project-id>/index.njk`), and every
page carries the project bar linking all projects. Use these sections, in this
order, for every project. When nothing has been published for a section, say so
plainly ("No traffic forecast has been published yet") - never leave it out, and
never fill it with anything that isn't a sourced fact or labelled analysis.

1. What the project would build (termini, length, lanes, cross-section)
2. How it fits the bigger plan (LRTP, neighbouring projects, network)
3. What kind of road it is (functional classification, freight network)
4. Where it is in the process (stage, schedule, what's decided and what isn't)
5. Traffic (today, no-build, build; level of service - evening peak, say so)
6. Noise and environment (matrix ratings, wetlands, noise studies)
7. Cost and funding (estimates; capital plan by year; state / federal money)
8. Questions worth asking (the same standing questions as other projects, plus
   project-specific ones)
9. How to get involved (comment channels, deadlines, meetings)
10. Where this comes from (sources)

Figures go in with `{% fact %}`; differences and ratios with the computed
shortcodes, never typed.

Layout: the page looks like the Rangeland guide's Highlights view - the
"What's happened lately" box, the Reading mode bar, then one slide per section
(number tiles, a headline, a source line at the foot). Sections with nothing
published can share one "Not yet published" slide; the sources section sits
below the slides. Until a study or workshop gives enough for a full guide, the
"Full detail" button is disabled with a note saying why (copy
`src/sunlake/index.njk`). Headlines state what is published, neutrally; Patrick
rewords them in his own voice if he wants.

## 7. Neutrality review

Before opening the pull request, reread the page and check:

- [ ] No loaded words (e.g. "only", "just", "massive", "slams") around figures.
- [ ] Every claim is a sourced fact or clearly labelled analysis.
- [ ] The same standing questions are asked as of the other projects.
- [ ] Missing information is stated as missing, not implied either way.
- [ ] No red/green for rising or falling figures.
- [ ] Nothing in Patrick's first-person voice added or changed without asking.

## 8. Pull request

Build (`npm run build`), browser-check at desktop and phone widths in light and
dark, branch from the latest `main`, open a pull request, and end its description
with **When it's live:** the foot of the page will show *pull request #N*.
Then publish the preview (see Workflow in CLAUDE.md) and give Patrick the link.

## Site structure (decided 28 Sep 2026)

- New projects go at `/<project-id>/` now, with a project bar on every page.
- After 8 Oct 2026: move the Rangeland guide to `/rangeland/`, turn the home page
  into a projects page (one card per project: stage, next date), and add a script
  on the home page that forwards old `/#section` links to `/rangeland/#section`.
