# Rangeland Boulevard Guide

A plain-language guide to the Rangeland Boulevard Route Study for Bexley neighbors,
built from Pasco County, Pasco MPO and FDOT public documents.

Single static page. No build step, no JavaScript, no dependencies beyond a Google
Fonts stylesheet.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole guide. Self-contained apart from the fonts link. |
| `og-image.png` | 1200×630 social preview card, used by the Open Graph tags. |

## Publishing on GitHub Pages

1. Create a repository — `rangeland-guide` works.
2. Add `index.html` and `og-image.png` to the repository root.
3. **Settings → Pages → Build and deployment.** Source: *Deploy from a branch*.
   Branch: `main`, folder: `/ (root)`. Save.
4. Wait a minute or two. The site appears at
   `https://<your-username>.github.io/rangeland-guide/`.

## Edit these three things before you share it

**1. The URLs in the `<head>`.** Four tags contain the placeholder
`EXAMPLE.github.io/rangeland-guide` — `canonical`, `og:url`, `og:image` and
`twitter:image`. Replace all four with your real address. If you skip this, the
page still works, but shared links on Facebook and Nextdoor will show no preview
card, which measurably reduces how many people click.

**2. The attribution line** in the introduction, which currently reads
"Put together by a Bexley resident." Correct it if you live elsewhere on the
corridor — an error there is the kind of small thing that gets used to dismiss
everything else.

**3. The corrections offer.** The introduction and the footer both invite people to
report errors, but give them no way to do it. Add an email address, or say you'll
watch the replies on wherever you post it.

## Checking the preview card

After publishing, paste the URL into Facebook's
[Sharing Debugger](https://developers.facebook.com/tools/debug/). It shows what the
card will look like and lets you force a re-scrape if you change the image later —
both platforms cache aggressively, so a fix without a re-scrape looks like no fix.

## Printing

The page carries a print stylesheet: colour is stripped, the meeting box gets a
black border, and figures avoid page breaks. Ctrl/Cmd-P produces a handout suitable
for a noticeboard or a doorstep.

## Keeping it honest

Every factual claim traces to a document listed in section 9. If something turns
out to be wrong, fix it visibly rather than quietly — the value of the page is that
people can check it, and a page that corrects itself in public is more trustworthy
than one that never appears to err.

Dates that will go stale: the workshop on 24 September 2026 and the comment
deadline of 8 October 2026. After those pass, either update the page or add a note
at the top saying what happened.
