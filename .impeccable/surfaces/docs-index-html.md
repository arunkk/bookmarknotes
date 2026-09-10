---
version: 1
slug: "docs-index-html"
primary_target: "docs/index.html"
related_targets: ["docs/app.js","docs/style.css"]
---

Scope: the single BookmarkNotes page at `docs/index.html`. Visitor mode: Operate.

Audience: one owner, no visitors (PRODUCT.md). Job: work the queue — assign shelves to
unfiled records, replace thin descriptions, link things that look duplicated. Untouchable by
the owner's answer: density of many rows per screen, shelf facets with live counts, instant
search. Failure condition: anything that reads as a consumer product.

## Direction contract

THESIS: The collection is a pull request you are reviewing. It refuses two arrangements —
the bookmark-manager card grid that shows six things at once, and the incumbent build's
neutral list with a single teal accent, which had no point of view. Chosen by the owner over
the roll's assigned direction, its familiarity risk stated on the card and accepted.

OWN-WORLD: A dark instrument ground (#0f1215) under a workbench-at-evening scene, ink at
#d7dde3, and colour used only semantically: amber marks work outstanding, green marks
settled, blue marks the active filter. A status gutter opens every row. Identifiers, counts
and metadata are monospace because they are data and measurement; prose is a system sans.
Structure comes from rules and gutters, never from cards or shadows. Icons are authored SVG
on one stroke weight — no glyph stand-ins.

STORY: The owner sees immediately how much is unresolved and what kind, works rows down
without leaving the keyboard, and watches the tallies fall as the queue empties.

FIRST VIEWPORT: A review header states the totals as one line of counts. Directly under it,
three queue buckets — unfiled, undescribed, looks-duplicated — each with its tally, as the
page's lead rather than a sidebar afterthought. A left rail lists shelves with counts and the
queue buckets as selectable filters. The listing fills the remaining width as rows, each
opening with a status gutter mark, the identifier in mono, the description in sans, shelf and
tag labels beneath, and notes as an indented review comment. Primary action is per-row and
inline: assign a shelf, star, or note without leaving the row.

FORM: Code review and unified diff interfaces; candidate 1 of my ordered list of seven, taken
as IMPECCABLE'S PICK over assigned candidate 5 (The Classified Column). Seed key 7ee98e79.
Carried disciplines, named: preview before committing — a shelf assignment shows the tallies
move before it lands; one control propagating — one assignment recalculates the whole rail at
once, not a single widget; mass as information — type weight carries state so the eye finds
outstanding work before reading a word.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
