# Rangeland Boulevard Guide

A plain-language guide to the Rangeland Boulevard Route Study for Bexley neighbors,
built from Pasco County, Pasco MPO and FDOT public documents.

Live at **https://patricka3s.github.io/rangeland/**.

Static site: no build step and no dependencies beyond a Google Fonts stylesheet
and the GoatCounter visit counter.

## Files

| File | Purpose |
|---|---|
| `index.html` | All the wording. Regions are fenced with banner comments. |
| `styles.css` | Layout, light/dark themes, the network map and the print stylesheet. |
| `app.js` | Behaviour: the Highlights / Full detail toggle, the meeting box switch after the workshop, opening the corrections list from `#notes`, and the network map's traffic figures. |
| `og-image.png` | 1200×630 social preview card, used by the Open Graph tags. |

## Editing

**Wording** lives in `index.html`. You should not need to open the other two
files to change what the page says.

**The page has two reading modes, and some figures appear in both.** The
Highlights view is the deck (`#deck`, eight slides); Full detail is the guide
(`#doc`, sections 01–10). If you change a number in one, check the other.

**Network map numbers live in `app.js`**, not the HTML. The `SEG` table holds
daily traffic per street segment and the `INT` table holds intersection grades,
each as `[2023, 2050 not built, 2050 built]`. Tab labels and captions are in
`index.html`. The same grades also appear in the slide 05 table and the section 5
chart, so a changed grade means three edits.

**Corrections** at the foot of the page are numbered automatically by CSS, so they
can be reordered freely — but the body text refers to some of them by number
("see correction 10"), so check those references if you insert one.

## Publishing

The site deploys from `main` via GitHub Pages (**Settings → Pages**, *Deploy
from a branch*, `main`, `/ (root)`). Changes appear a minute or two after a push.

The canonical, `og:url`, `og:image` and `twitter:image` tags already point at the
live address. If the site moves, update all four.

## Checking the preview card

After changing the preview image or description, paste the URL into Facebook's
[Sharing Debugger](https://developers.facebook.com/tools/debug/). It shows what the
card will look like and lets you force a re-scrape — platforms cache aggressively,
so a fix without a re-scrape looks like no fix.

## Printing

The page carries a print stylesheet: colour is stripped, the meeting box gets a
black border, and figures avoid page breaks. Ctrl/Cmd-P produces a handout suitable
for a noticeboard or a doorstep.

## Keeping it honest

Every factual claim traces to a document listed in section 10. If something turns
out to be wrong, fix it visibly rather than quietly — the value of the page is that
people can check it, and a page that corrects itself in public is more trustworthy
than one that never appears to err.

## Dates that will go stale

- **Workshop #3, 24 September 2026** — has happened. `app.js` switches the meeting
  box to its post-workshop copy automatically, but some prose in sections 4, 5, 8
  and 9 is still written in the future tense.
- **Comment deadline, 8 October 2026** — after it passes, update the meeting box,
  the "Still ahead" list, and section 9, or add a note at the top saying what
  happened.
- **"Updated" date** in the page header — bump it with each substantive change.
