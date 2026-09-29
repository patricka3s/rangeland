# Rangeland Boulevard Guide

A plain-language guide to the Rangeland Boulevard Route Study for Bexley neighbors,
built from Pasco County, Pasco MPO and FDOT public documents.

Live at **https://patricka3s.github.io/rangeland/**.

The page is built from **data files** — sources, facts and definitions — so every
figure on it is stored once, cites the document it came from, and can be checked.

## What's where

| Path | What it holds |
|---|---|
| `data/sources.yaml` | Every document a fact can cite: title, publisher, date, link. |
| `data/facts/rangeland.yaml` | Every figure the page shows from the county's documents — traffic, intersection grades, costs, matrix quantities — each with its source. |
| `data/projects.yaml` | The road projects the site covers. Each facts file must match one. |
| `data/site.yaml` | Site settings: the error-report form's address. |
| `data/definitions.yaml` | Plain-language definitions of the terms the site uses. Not yet shown as a glossary. |
| `src/index.njk` | The page. All the wording lives here; figures are pulled in from the facts file. |
| `src/sunlake/index.njk` | The **Sunlake Blvd corridor** page at `/sunlake/`, laid out like Rangeland's Highlights: slides for the three pieces of the corridor, the planned road, the process and funding, with a plain "not yet published" wherever nothing is. "Full detail" is switched off until the county publishes a study or holds a workshop. |
| `data/events.yaml` | The **timeline**: each project's workshops, Commission actions, contracts, change orders, plan documents, deadlines and planned phases, each with its source. |
| `tools/preview.mjs` | Makes the private preview copy (`npm run preview`) that Claude publishes so you can look before merging. Not part of the live site. |
| `src/timeline/index.njk` | The **Timeline** page at `/timeline/`, built from `events.yaml`. The guide's "What's happened lately" box is built from it too. |
| `src/_includes/share.njk` | The **Share this page** button in every page's footer (it opens the phone's share menu, or copies the link on a computer). |
| `src/_includes/project-bar.njk` | The bar at the top of every page: projects on the left, Timeline and All figures & sources on the right. Add a project link to the left-hand group when a project gets a page. |
| `src/facts.njk` | The **Figures and sources** page (`/facts/`): every fact, grouped, with its source and a report link. Built entirely from the data files. |
| `src/_includes/shared-head.njk` | Head tags both pages share: icon, fonts, stylesheet. |
| `src/app.js.njk` | Page behaviour: the reading-mode toggle, the meeting box, and the network map (whose figures also come from the facts file). |
| `src/styles.css`, `src/og-image.png` | Styling and the social preview card. |
| `eleventy.config.js` | The build: loads and checks the data, and defines the tags the page uses. |
| `.github/workflows/site.yml` | Builds the site on every pull request and publishes it on every merge to `main`. |

## Changing a figure

Edit it in `data/facts/rangeland.yaml`, not in the page. Each fact looks like this:

```yaml
- id: rangeland.aadt.bvd-rndbt.2050-nobuild
  statement: Daily traffic (AADT), Bexley Village Dr, by the roundabout, 2050 no-build
  value: 23500
  unit: vehicles per day
  source: pasco-2026-09-traffic-nobuild
  as_of: '2026-09-24'
  status: current
```

Every place that uses it — the map, the tables, the charts, the paragraphs —
updates together. If a newer document replaces a figure, set the old one's
`status` to `superseded` and add the new one rather than overwriting, so the
history stays visible.

Figures that are **worked out** from facts — the build-vs-no-build differences, the
cost per mile — are calculated when the site is built, so they can't drift from
the facts they come from.

**Not yet linked:** numbers written out in words ("ten thousand fewer vehicles",
"six of the eleven"), the stat tiles on slide 05 other than the −10,000 one, and
the figures inside the correction notes (which record what the page said at the
time, on purpose). Check those by hand when a related fact changes.

## Marking a figure as verified

Two optional dates record who has compared a figure with its document:

```yaml
  ai_checked: '2026-09-28'   # Claude (AI) checked it on this date
  verified: '2026-10-02'     # you checked it yourself on this date
```

The site shows these as **Checked by AI** (outlined) and **Verified by a human**
(filled), and the Figures and sources page has a key with how many figures are
in each state. Only you add `verified`; Claude never does. To mark one:

1. On GitHub, open `data/facts/` and the project's file, then click the pencil
   (**Edit this file**).
2. Find the figure (press Ctrl+F or ⌘F and type part of its id), and under its
   other lines add `  verified: 'YYYY-MM-DD'` with today's date, lined up with
   the lines above it and with the quote marks.
3. Click **Commit changes…**, choose **Create a new branch**, then **Propose
   changes** and **Create pull request**. Once the check passes, merge it.

If you mistype the date, the build stops and says which figure.

**Watch out for `#`.** In these files, a `#` after a space starts a comment and
everything after it is silently dropped. Wrap any value containing ` #` or `: `
in double quotes: `title: "Public Workshop #3 newsletter"`.

## Sources and error reports on the page

Every figure pulled from the facts file shows with a dotted underline. Tapping it
opens a small box with what the figure is, the document it comes from (with a
link), and **"Think this is wrong? Tell me →"**. That link opens the Google Form
with the first question already filled in with the fact's id, what it states and
its value, so you know exactly which figure a report is about.

**When a newer document updates a figure**, don't overwrite the old one. Add the
new fact with `replaces:` naming the old fact's id, and change the old one's
`status` to `superseded`. The Figures and sources page then shows the new figure
with a **Revised** badge that opens its history, and lists the change under
**What's changed** at the top of the page. Add a `change_note` if the two
figures aren't measured the same way.

The **Figures and sources** page (`/facts/`) lists every fact the same way —
grouped by project and kind, searchable, each with its source link and a
**Report an error** link — followed by every source document and how many
figures cite it. It needs no editing: add or change a fact and it appears there.
The guide links to it under the reading-mode toggle, in the footer, and from each
figure's details box.

The form's address and question code are in `data/site.yaml`. If you rebuild the
form, get the new code from the form's **⋮ → Get pre-filled link** (type anything
in the first question, then **Get link**; the code is the `entry.` number).

## Adding something to the timeline

Add an entry to `data/events.yaml` (the header explains each field). It appears on
the Timeline page and, if it's one of the project's five latest, in the guide's
"What's happened lately" box. The site rebuilds every morning, so upcoming items
move below the "today" line on their own.

## Changing the wording

Edit `src/index.njk` as before. The page has two reading modes: the Highlights
view (`#deck`, eight slides) and Full detail (`#doc`, sections 01–10). If you
reword something in one, check whether the other repeats it.

## Safety checks

The build stops with a plain-English error, and nothing is published, if:

- the page asks for a fact that doesn't exist (usually a typo in the id);
- a fact names a source that isn't in `sources.yaml`;
- a fact is missing a required field, is listed twice, or has a status other than
  `current`, `disputed` or `superseded`.

On a pull request this shows as a red ✗ next to the build check. Fix it before merging.

## Publishing

Changes reach the live site through a pull request: merge it, and the workflow
builds and publishes the site a minute or two later. `main` is protected, so
nothing can reach it without a merge.

GitHub setting this depends on: **Settings → Pages → Source: GitHub Actions**.

**Is my change live?** The last line of the page reads e.g.
*Version 0c08780 · pull request #3 · published September 28, 2026 at 10:26 AM EDT*.
Every pull request says which number to look for. The version is
the start of the commit's code. Compare it with the latest commit on `main` —
shown on the repository's front page, or in the **Actions** tab next to the
newest "Build and publish site" run. If they match, the change is live. If the
page still shows an old version, force a refresh (Ctrl+Shift+R, or Cmd+Shift+R
on a Mac).

## Previewing on your own computer (optional)

With [Node.js](https://nodejs.org) installed: `npm install` once, then
`npm run serve` and open the address it prints. `npm run build` writes the
finished site to `_site/`.

## Checking the preview card

After changing the preview image or description, paste the URL into Facebook's
[Sharing Debugger](https://developers.facebook.com/tools/debug/) to see the card
and force a re-scrape — platforms cache aggressively.

## Printing

The page carries a print stylesheet: colour is stripped, the meeting box gets a
black border, and figures avoid page breaks.

## Keeping it honest

Every figure traces to a source in `data/sources.yaml`, and every factual claim in
the text to a document listed in section 10. If something turns out to be wrong,
fix it visibly rather than quietly — a page that corrects itself in public is more
trustworthy than one that never appears to err.

## Dates that will go stale

- **Workshop #3, 24 September 2026** — has happened. The meeting box switches to
  its post-workshop copy automatically, but some prose in sections 4, 5, 8 and 9
  is still written in the future tense.
- **Comment deadline, 8 October 2026** — after it passes, update the meeting box,
  the "Still ahead" list and section 9, or add a note at the top.
- **"Updated" date** in the page header — bump it with each substantive change.
