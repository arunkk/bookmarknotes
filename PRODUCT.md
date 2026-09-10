# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: Arun, the owner of the collection. The public repository and public Pages site
are a hosting convenience, not an audience — nothing is designed for a visitor, and no
onboarding, explanation, or cold-read legibility is owed to anyone else.

The consequence is that the site optimizes entirely for one person's recall of his own
material. Familiarity with the collection can be assumed. Density beats hand-holding.

## Product Purpose

A single place for every link worth keeping — websites, PDFs, docs, YouTube videos and
playlists, mp3s, repos — gathered from wherever they were found (GitHub stars, Chrome
bookmarks, Slack, one-off pastes), each carrying a short description of what it is, and
organized so the collection has a shape rather than being a pile.

Success is a collection that stays *meaningfully organized* as it grows: things are in the
right groups, duplicates are merged, and the notes explain why something mattered.

## Positioning

The store is the git repository itself, and every edit — a star, a note — is a commit
through the GitHub Contents API. There is no server and no database, so the collection is
plain, diffable, portable data the owner controls outright, while still being editable from
a web page. A hosted bookmarking service cannot truthfully offer that; a plain static site
cannot offer the editing.

## Operating Context

- Links arrive already scattered across GitHub stars, Chrome bookmarks, Slack messages, and
  YouTube playlists. Importing from those sources is the normal way material enters, not an
  edge case.
- Import runs from the command line (`make`), while browsing and editing happen on the
  published page. Both act on the same JSON file in the same repository.
- The owner's own agent tooling is part of the workflow: two skills in this repo
  (`curate-bookmarks` for collection-level import/dedupe/grouping, `enrich-bookmarks` for a
  single record's description and groups) define the contracts that both `make enrich` and
  an interactive session follow.
- Enrichment shells out to the `claude` CLI already installed on the owner's machine.

## Capabilities and Constraints

**Built and live**
- 542 starred GitHub repos imported, described, and grouped; 9 ungrouped, 8 without a
  description.
- One canonical-URL function is the sole basis of identity, so re-importing can never
  duplicate or clobber. Stars, notes, and hand-set groups survive every re-import.
- Browse, multi-select group facets with counts, an Ungrouped facet, instant search, sort,
  URL-reflected filters, deep links.
- Token-gated star and note write-back (built; not yet exercised against a real token).

**Not built**
- Importers for Chrome bookmarks, Slack, YouTube playlists, and one-off `add`.
- Near-duplicate detection and merging (`dedupe`), and group renaming.

**Binding constraints**
- **No server and no database.** The repository is the store. No hosted backend, no
  managed database, no API of our own.
- **Must stay free to run.** No paid hosting or paid services. This rules out private
  GitHub Pages, which is why the repository is public.

**Explicitly not binding** — both were the assistant's choices while building, and the
owner has confirmed they are incidental rather than requirements:
- *No build step.* The site is currently plain HTML/CSS/JS served from `/docs`, but future
  work may introduce a build.
- *Zero npm dependencies.* `tools/` is currently dependency-free with no `package.json`,
  but dependencies are permitted.

**Terminology**
- **Groups** — a curated, closed vocabulary in `docs/data/taxonomy.json`. Overlapping tags,
  never a hierarchy: a record belongs to 0–3 groups at once. Ungrouped is `groups: []`, not
  a sentinel value.
- **Tags** — free-form, lowercase, hyphenated specifics. Reserved prefixes `playlist:` and
  `src:` are set by importers.
- **Kinds** — `web`, `pdf`, `doc`, `video`, `playlist`, `audio`, `repo`, `local`.
- **Sources** — an array; one link legitimately arrives from several places.

**Undecided**
- Whether the site should ever become the primary capture path (a bookmarklet, a paste box)
  rather than importers plus the CLI.
- Whether private notes are needed. The repository is public, so everything written today
  is world-readable; the spec records a gitignored local-overlay escape hatch, but it has
  not been built or committed to.

## Brand Commitments

Name: **BookmarkNotes**. No logo, no prior identity, no external brand obligations. The
owner has set no binding visual constraints.

## Evidence on Hand

- `docs/data/bookmarks.json` — 542 real records with real descriptions and groups. This is
  genuine data, not fixtures, and is the corpus any future work should be tested against.
  It is authentically messy: some repos arrive with `description: null` and `topics: []`.
- Live site: <https://arunkk.github.io/bookmarknotes/>
- `SPEC.md` — the design record, including the twelve browser-validation checks and their
  current pass state.
- 22 unit tests in `tools/lib/*.test.mjs`.

There are **no** users besides the owner, no testimonials, no case studies, no press, no
benchmarks, no pricing, and no adoption numbers. Future work must not invent any of these,
and must not write copy implying an audience or a community.

## Product Principles

1. **Never destroy what the human wrote.** Stars, notes, and hand-set groups outrank
   anything an importer or a model produces. When in doubt, union and keep both.
2. **Curation is the job.** When retrieval, capture, and organization conflict, the
   collection's coherence wins: good groups, merged duplicates, and notes that say why
   something mattered.
3. **Surface gaps; never paper over them.** Ungrouped is a work queue, and an empty
   description is honest. A wrong group hides, an empty one gets fixed.
4. **Automation proposes, the owner disposes.** Exact duplicates collapse silently, but
   anything requiring judgment — a near-duplicate merge, a clustering change — is shown as
   a diff and waits for approval.
5. **One owner, no visitors.** Design for one person's recall. Density, keyboard reach, and
   speed over explanation.
