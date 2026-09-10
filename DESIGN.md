---
name: BookmarkNotes
description: The collection as a pull request under review — a dark instrument ground where colour only ever means something.
colors:
  void: "#0f1215"
  sheet: "#14181c"
  raise: "#1a1f24"
  rule: "#242b31"
  rule-soft: "#1c2227"
  ink: "#d9dee4"
  ink-2: "#98a2ac"
  ink-3: "#7c8792"
  open: "#d9a12c"
  keep: "#d9a12c"
  settled: "#47a76a"
  settled-legible: "#5d8f70"
  active: "#4a90e2"
typography:
  tally:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tabular-nums"
  mark:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "0.01em"
  ident:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.06em"
    fontFeature: "tabular-nums"
rounded:
  hair: "1px"
  control: "2px"
  dialog: "3px"
spacing:
  xs: "4px"
  sm: "6px"
  base: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  gutter: "22px"
  column-gap: "26px"
  tail: "96px"
components:
  button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "5px 9px"
  button-hover:
    textColor: "{colors.ink}"
  button-pressed:
    textColor: "{colors.active}"
  button-go:
    backgroundColor: "{colors.active}"
    textColor: "#08111c"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "5px 9px"
  button-warn:
    textColor: "{colors.open}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  input-search:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.ident}"
    rounded: "{rounded.control}"
    padding: "7px 30px 7px 10px"
  chip-filter:
    textColor: "{colors.active}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "1px 5px"
  chip-shelf:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 5px"
  facet:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    padding: "3px 6px 3px 8px"
  facet-selected:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.ink}"
  row-action:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    width: "22px"
    height: "20px"
  row-action-on:
    textColor: "{colors.keep}"
---

# Design System: BookmarkNotes

## Overview

**Creative North Star: "The Collection as a Pull Request Under Review"**

The page is an instrument, not a product. It is read at an evening desk with a terminal open
beside the browser, so it commits to one dark ground (`void`) and never flips with a system
preference — `color-scheme: dark` is declared, and there is no light variant anywhere in the
stylesheet. Every screen opens with the amount of unresolved work stated as counts, and every
record is a row with a status gutter, exactly the way a diff opens a line.

Structure is made entirely of hairlines and gutters. There are no cards, and the stylesheet
contains no `box-shadow` at all. Density is the point: rows are 4–5px of vertical padding on a
1px rule, descriptions clamp to one line at rest and open to three on hover or focus, and the
whole listing fills the width beside a 216px rail. Nothing about the surface is designed to be
cold-read by a visitor; it is designed for one owner's recall of his own material.

Colour is semantic and nothing else. Amber marks work outstanding, green marks settled, blue
marks the active filter — and no fourth accent exists. Because colour has been spent on
meaning, hierarchy is carried by type weight, monospace-versus-sans, and the four-step size
ramp. The build's declared visual anti-references are the bookmark-manager card grid that
shows six things at once, and the incumbent neutral list with a single teal accent.

**Key Characteristics:**
- One committed dark ground; no light mode, no theme toggle.
- Zero shadows; structure from 1px rules, gutters and a single 26px column gap.
- Three semantic accents only: amber outstanding, green settled, blue active filter.
- Monospace for identifiers, tallies and metadata; system sans for prose.
- Four type sizes, no literal `font-size` values left in the stylesheet.
- A status gutter (`!`, `~`, `·`) opens every row.
- Authored SVG sprite at one 1.5 stroke weight is the entire icon system, favicon included.
- One authored animation: a tally settling when a bucket empties.

## Colors

A near-black instrument ground with tinted (never neutral-grey) ink, on which three accents
carry the only colour meaning in the system.

### Primary
- **Outstanding Amber** (`open`): work owed. It colours the `!` and `~` gutter marks, the
  queue bucket marks, the read-only mode button and its border, the token banner, the
  "no description" italic stand-in, and the duplicate-pair heading. If something is amber, the
  owner has something to do.
- **Interest Amber** (`keep`): the star. Deliberately the same value as Outstanding Amber — a
  star is outstanding interest, so it stays in the same family rather than earning a hue.

### Secondary
- **Settled Green** (`settled`): filed, nothing owed. Used for a cleared bucket's `·` mark and
  as the origin colour of the settle animation.
- **Legible Settled Green** (`settled-legible`): the same green lightened for the settled row
  gutter, where the mark is small and permanent; it measures 4.0:1 against the ground. Use it
  wherever settled green must be read as text rather than glimpsed as a state flash.

### Tertiary
- **Filter Blue** (`active`): the current filter and only the current filter — selected facet
  hairline and count, active-filter chips, `aria-pressed` buttons, focus rings, caret colour,
  and link hover. It is also the primary-action fill (`button-go`) on the one committing
  control in the page.

### Neutral
- **Void** (`void`): the page and header ground; also the inset fill of scrollbar thumbs and
  the text colour of an inverted selected option.
- **Sheet** (`sheet`): the queue band, control fills, inline panels, hover ground for rows and
  facets.
- **Raise** (`raise`): the pressed/current state ground — a selected facet, an opened row, a
  shelf chip, a hovered row action.
- **Rule** (`rule`): the structural hairline and control border; also the dim colour of an
  empty gutter mark and of the `/` separators between metadata parts.
- **Rule Soft** (`rule-soft`): the interior hairline — between rows, between queue buckets,
  under the rail. Softer than `rule` so the outer structure stays dominant.
- **Ink** (`ink`): identifiers, tallies, headings, the value being read.
- **Ink 2** (`ink-2`): descriptions, facet labels, prose in panels.
- **Ink 3** (`ink-3`): metadata, counts, hints, placeholders — present, never competing.

### Named Rules
**The Semantic Colour Rule.** Amber, green and blue mean outstanding, settled and active
filter. A colour is never applied for emphasis, decoration, category or delight. If a new
element needs colour, it must first be assigned one of those three meanings, or it stays ink.

**The Hairline Rule.** Separation is a 1px rule or a gutter. Never a card, never a fill, never
a shadow. A selected facet is marked by a 1px `active` bar at its left edge, not a coloured
slab.

**The Tinted Neutral Rule.** Every grey in the palette is tinted from the foreground hue. No
pure `#888`-family neutrals enter the system.

## Typography

**Display / Data Font:** JetBrains Mono (with `ui-monospace`, SFMono-Regular, Menlo, Consolas)
**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto, Helvetica, Arial)

**Character:** A terminal voice for anything that is data or measurement, and the reader's own
system face for anything that is prose. The pairing is the argument: identifiers, counts, tags,
timestamps and marks are measured things and get the mono; descriptions and notes are written
by a person and get the sans.

### Hierarchy
- **Tally** (mono, 700, 24px, 1.1, tabular): queue bucket counts. The largest thing on the
  page is the amount of work outstanding.
- **Mark** (mono, 700, 18px): the wordmark, empty-state lead, dialog heading, and the `!` /
  `~` / `·` queue marks.
- **Ident** (mono, 500, 14px): record identifiers and the search field's own text. Rises to 700
  when a row's state is `open` or `dup`.
- **Body** (sans, 400, 14px, 1.5): descriptions, notes, facet labels, prose. Measure is capped
  at 74ch for descriptions and read notes, 62ch for dialog prose, 56ch for empty states.
- **Label** (mono, 500, 12px, 0.06em tracking on rail headings, tabular): metadata, counts,
  chips, hints, rail section headings, status lines.

### Named Rules
**The Four Steps Rule.** The ramp is exactly four sizes — 12 / 14 / 18 / 24 — exposed as
tokens. No literal `font-size` value may enter the stylesheet; if a new element needs a size,
it takes one of the four.

**The Mono-Means-Measured Rule.** Monospace is reserved for identifiers, counts, tags,
metadata and marks. Prose in monospace, or an identifier in sans, is a category error.

**The Mass-As-Information Rule.** Type weight carries state. A row with work outstanding is
700; a settled row is 500. The eye must find outstanding work before reading a word.

## Layout

A centred 1320px maximum measure with a 22px inline gutter (14px below 560px), applied
uniformly to the header, find bar, queue band and main shell so every band shares one
left edge.

The shell is a two-column grid: a 216px rail and a `minmax(0, 1fr)` listing, separated by a
26px gap and a `rule-soft` right border on the rail, with 96px of tail space under the listing.
The header, find bar and queue band form one sticky block whose measured height is written to
`--top-h` at runtime; the rail's sticky offset, its `max-height`, and row `scroll-margin-top`
all derive from that variable rather than a hard-coded number.

Rows are a three-column grid — an 18px status gutter, the flexible line, and the action cluster
— with expanded content (assign panel, note thread, related links) spanning columns 2–3 so it
reads as an indented review comment. Queue buckets are a four-column grid (`16px 5ch auto
minmax(0,1fr)`) so marks, tallies and labels align down the band.

**Responsive.** At 900px the sticky block becomes static (it measured 333px, 39% of an 844px
viewport, and earned its space only on desktop), the shell collapses to one column, the rail
becomes a collapsible band of pill-shaped facets, and the selected-facet hairline is replaced by
an `active` border. At 560px the gutter tightens to 14px, the search field takes its own row,
the row grid drops to two columns with actions on their own line, and the metadata run sheds
host and language so the first shelf chip can ride the metadata line — measured at a 104px row
pitch with the chip visible.

### Named Rules
**The Measured Sticky Rule.** Anything that depends on the height of the sticky block reads
`--top-h`. Hard-coding that height is how the rail and scroll anchoring drift apart.

**The One Left Edge Rule.** Every full-width band uses the same `max` measure and `gutter`
padding. No band gets its own inset.

## Elevation & Depth

There are no shadows in this system — the stylesheet contains no `box-shadow` declaration, and
none may be added. Depth is tonal and structural: a three-step ground ramp (`void` page →
`sheet` hover and control fill → `raise` current/pressed) plus two hairline weights
(`rule` for structure, `rule-soft` for interior divisions). The only true overlay is the
settings dialog, and it separates from the page with a `rgba(6, 8, 10, 0.66)` backdrop and a
1px `rule` border, not a lift.

### Named Rules
**The No-Shadow Rule.** Zero shadows, at rest or in any state. If an element needs to feel
forward, move it one step up the ground ramp or give it a hairline.

**The Three Grounds Rule.** Rest is `void`, hover is `sheet`, current is `raise`. A fourth
ground, or a coloured fill in place of one of them, is not part of the system.

## Shapes

Corners are effectively square. Controls, chips, panels and inline fills take a 2px radius
(`control`); the dialog takes 3px; focus rings take 1px so the ring hugs the shape it outlines.
Nothing rounder exists — the only 6px radius in the build is on the webkit scrollbar thumb, a
browser surface, not a page shape.

Borders do the work radius does not: 1px `rule` on controls and structure, 1px `rule-soft`
inside repeating collections, and colour swapped into the border (`active`, `open`) to express
state rather than filling the shape. Icons are an authored SVG sprite drawn on a 16×16 box at a
single 1.5 stroke weight with `currentColor`, round joins and caps, rendered at 9–16px; the
favicon is the same drawing at the same weight.

### Named Rules
**The One Stroke Weight Rule.** Every icon is authored SVG at 1.5 stroke, filled only to
express an on-state (the starred star). No icon font, no emoji, no glyph stand-in, and no
second stroke weight.

## Components

### Buttons
- **Shape:** square-cornered (2px), 1px `rule` border.
- **Default:** `sheet` fill, `ink-2` mono label at 12px, 5px/9px padding.
- **Hover / Focus:** label rises to `ink` and the border lightens to `#39424b`; transitions are
  120ms on colour and border only, never on position or size. Focus is the global 2px `active`
  outline at 2px offset.
- **Pressed (`aria-pressed`):** label and border both become `active`.
- **Commit (`button-go`):** `active` fill with near-black `#08111c` label at 700; hover is
  `brightness(1.08)`, not a colour change. This is the only filled button in the page.
- **Warning (`mode-state`):** transparent with an `open` border and label, hover fills
  `#2a1f0a`. Used for the read-only/token state.

### Chips
- **Active filter chip:** transparent, 1px `active` border, `active` mono label at 12px, with
  the 9px close icon inline; hover fills `#16283c`.
- **Shelf chip:** `raise` fill, 1px `rule` border, `ink-2` mono label; hover lightens the label
  and turns the border `active`. It rides the identifier line and costs no row height.
- **Tag:** no border and no fill at all — `ink-3` mono text that turns `active` and underlines
  on hover. Tags are the quietest interactive thing in the system.

### Cards / Containers
There are no cards. Grouped content (the shelf-assign panel, the note thread, a read note, a
duplicate side) is a `sheet` region with a 1px `rule` border, 2px corners, 7–10px of internal
padding, and no shadow. Duplicate pairs draw their borders on the cells rather than filling the
grid gap, so an unfilled trailing cell never reads as a grey block.

### Inputs / Fields
- **Style:** `sheet` fill, 1px `rule` border, 2px corners, mono text at 14px (search) or 12px
  (settings), `ink-3` placeholder.
- **Focus:** the border becomes `active` and the default outline is suppressed — the field
  itself lights up rather than gaining a ring. Caret is `active` globally.
- **Note textarea:** the one field in sans, because its content is prose; 72px minimum height,
  vertical resize only.

### Navigation
The left rail is the navigation. Section headings are 12px mono, 500, `ink-3`, tracked 0.06em.
Facets are full-width text rows (`ink-2`) that take a `sheet` ground on hover and a `raise`
ground plus a 1px `active` left bar when selected, with tabular counts that turn `active` with
the selection. Zero-count facets stay in place at 40% opacity rather than disappearing. Below
900px the rail becomes a wrapped band of bordered pills toggled by a Filters button.

### The Status Gutter
The signature component. Every row opens with a fixed 18px monospace column (16px below 560px)
carrying one 700-weight mark: `!` for open, `~` for looks-duplicated, `·` for settled. Open and
duplicated marks are `open`; the settled mark uses `settled-legible`; an unset gutter is `rule`.
The mark is `user-select: none` so copying a row copies the record, not the diff. The same
vocabulary repeats at 18px in the queue buckets, where a cleared bucket shows `·` in `settled`.

### The Queue Band
The page's lead, not a sidebar. A `sheet` band under the header rule holding three buckets —
unfiled, undescribed, looks-duplicated — each a button laid out as mark, 24px tabular tally,
sans label, and mono next-action hint. Selected buckets take the `raise` ground. When a tally
falls to empty, its number runs the 700ms `settle` animation from `settled` green back to rest
with a 2px rise; that is the only authored motion in the build, and all motion is disabled under
`prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** spend colour only on meaning: amber for outstanding, green for settled, blue for the
  active filter.
- **Do** build structure from 1px hairlines (`rule` outside, `rule-soft` inside) and gutters.
- **Do** take type sizes from the four tokens (12 / 14 / 18 / 24) and set monospace for
  anything measured, sans for anything written.
- **Do** carry state with weight and ground step — 700 identifiers for open rows, `raise` for
  current — before reaching for colour.
- **Do** derive any sticky-dependent offset from `--top-h`.
- **Do** author new icons as SVG at 1.5 stroke on a 16×16 box using `currentColor`.
- **Do** keep transitions to 120ms colour/border/background on the `cubic-bezier(0.16, 1, 0.3, 1)`
  curve, and honour `prefers-reduced-motion`.
- **Do** cap prose measure (74ch descriptions and notes, 62ch dialog prose).

### Don't:
- **Don't** add a `box-shadow`. There are none in the build and depth comes from the ground
  ramp.
- **Don't** wrap content in a card, or use a filled coloured slab where a 1px mark will do.
- **Don't** introduce a fourth accent hue, a decorative colour, or a per-category colour.
- **Don't** write a literal `font-size` into the stylesheet, or add a fifth size step.
- **Don't** use an icon font, an emoji, or a text glyph as an icon — the only characters that
  stand alone are the three status-gutter marks, which are the diff idiom itself, not icons.
- **Don't** add a light theme or a theme toggle; the ground is committed.
- **Don't** animate anything besides the settling tally, and never animate on page load.
- **Don't** use an untinted neutral grey.
- **Don't** add onboarding, marketing copy, testimonials, adoption numbers, or anything else
  implying an audience. There is one owner and no visitors.
