# BookmarkNotes — Design Spec

A single place for every link worth keeping — websites, PDFs, docs, YouTube videos and
playlists, mp3s — collected from scattered sources, each carrying a short auto-discovered
description, grouped by overlapping tags, and browsable *and editable* as a real web page
on GitHub Pages.

Status: **live** at <https://arunkk.github.io/bookmarknotes/> with the 542-repo seed corpus.
Importers for Chrome, Slack and YouTube are still to come (see [Milestones](#9-milestones)).

---

## 0. The central problem

GitHub Pages serves static files, but this site must *write*: stars and notes have to
persist across devices and survive a cleared browser cache.

**Resolution:** the repo *is* the database, and the GitHub Contents API is the write path.
There is no server to run, no hosted database, and every edit lands as a versioned commit.
The site is read-only for anyone without a token.

### Decisions

| Decision | Choice |
|---|---|
| Persistence | Git-backed writes through the GitHub Contents API |
| Site stack | Vanilla JS + JSON, **no build step** |
| Importers | GitHub stars, Chrome bookmarks, Slack, YouTube playlists, manual add |
| Organization | **Overlapping groups-as-tags, no hierarchy** (see §2) |
| Enrichment | Metadata scrape + `claude -p`, driven by a repo skill |
| Binary files | **Reference only** — never copied into the repo |
| Visibility | Public repo, public Pages site |
| Seed corpus | The 542 repos already starred by `arunkk` |

> ⚠️ **Privacy.** A public repo and public Pages site means the bookmarks *and your notes*
> are world-readable. Write nothing in a note you would not post publicly. If that becomes
> a problem, the escape hatch is a gitignored `docs/data/bookmarks.local.json` overlay that
> the site merges client-side and that never leaves your machine.

---

## 1. Data model

`docs/data/bookmarks.json` is the single source of truth: a JSON array, 2-space
pretty-printed, sorted by `id`. That formatting is deliberate — it keeps git diffs readable
and keeps merge conflicts local to the one record that changed.

```json
{
  "id": "b_9f3a1c4e",
  "url": "https://github.com/pgvector/pgvector",
  "kind": "web|pdf|doc|video|playlist|audio|repo|local",
  "title": "pgvector",
  "description": "one sentence, <=160 chars, auto-discovered",
  "groups": ["AI/ML", "Data & Databases"],
  "tags": ["vector-search", "postgres"],
  "starred": false,
  "notes": "your markdown, free-form",
  "sources": [{ "type": "github-stars", "ref": "arunkk", "at": "2026-09-09T12:00:00Z" }],
  "meta": { "siteName": "", "author": "", "published": "", "durationSec": null },
  "related": ["b_1a2b3c4d"],
  "enriched": { "at": "2026-09-09T12:00:00Z", "by": "claude|scrape|human|none" },
  "addedAt": "2026-09-09T12:00:00Z",
  "updatedAt": "2026-09-09T12:00:00Z"
}
```

**`id`** = `b_` + first 8 hex characters of `sha1(canonicalUrl)` (§3.1). Deriving the id
from the URL makes ids stable across re-imports and makes exact-duplicate detection free.

**`sources`** is an array, not a scalar — the same link legitimately arrives from both
Chrome and Slack, and both origins are worth knowing.

**`groups`** and **`tags`** are both arrays; see §2 for the distinction and the rules.

**`related`** holds ids of bookmarks the curation pass judged to be about the same thing
(§3.3). It is advisory: the site renders "related" links from it, and nothing breaks if it
is empty or stale.

**Local files.** An mp3 or PDF sitting on disk gets `kind: "local"` and records its
absolute path. No binary is ever copied into the repo — the store keeps metadata and a
pointer, so the repo stays small and nothing private gets published by accident.

---

## 2. Organization: groups as tags, not a hierarchy

A folder tree forces every bookmark into exactly one place, and the interesting ones never
fit. `pgvector` is genuinely both AI/ML and Data & Databases; a conference talk about
Kubernetes belongs with both DevOps and the talks you mean to watch. So there is **no
hierarchy anywhere in this system** — no folder tree, no parent groups, no single primary
category.

Instead, membership is a flat, many-to-many relation expressed in two arrays:

| Field | Vocabulary | Count | Purpose |
|---|---|---|---|
| `groups` | **Curated** — must be a member of `groups` in `docs/data/taxonomy.json` | 0–3 | The stable shelves you browse by. Rendered as the sidebar facets. |
| `tags` | **Free-form** — anything, lowercase and hyphenated | 0–8 | The specifics a group is too coarse to hold: technologies, products, concepts. |

Both are just tags mechanically. The split exists so the sidebar stays stable and legible:
a curated `groups` vocabulary cannot fragment into `ml`, `ML`, `machine-learning`, and
`AI/ML`, while `tags` stay free to be as specific as needed.

**Rules**

- A bookmark may belong to **many** groups. Nothing is "moved" between groups; it is added
  to or removed from each independently.
- **Ungrouped is `groups: []`** — not a sentinel value like `Unsorted`. The site computes
  an "Ungrouped" facet from the empty array, so the review queue is derived state and can
  never drift out of sync with a stored label.
- A group name is never a substring path (`AI/ML` is one opaque name, not `AI` → `ML`).
  Slashes in a name are just characters.
- Tags never restate a group. If `AI/ML` is on the record, `ai` is not a useful tag.
- Renaming a group is a taxonomy edit plus a mechanical rewrite across the store
  (`make rename-group FROM=… TO=…`), validated by `make check`.
- **Reserved tag namespaces**, using a `prefix:` convention so they sort and filter
  together without needing schema support:
  - `playlist:<slug>` — every video imported from a YouTube playlist carries it, which is
    how a playlist stays browsable as a unit without becoming a folder.
  - `src:<type>` — coarse origin, mirroring `sources[].type`, so "everything from Slack"
    is one filter click.

---

## 3. Ingestion

Importers are plain Node ESM scripts under `tools/`, with **zero npm dependencies**.

| Command | Behavior |
|---|---|
| `make add URL=… [KIND=…]` | One-off link. Also the endpoint behind the site's paste box. |
| `make import-stars` | `gh api user/starred --paginate` (the `gh` CLI is already authenticated as `arunkk`). `kind: "repo"`, description from the repo, tags from its topics. |
| `make import-chrome FILE=…` | Parses the Chrome `bookmarks.html` export — `<DT><A HREF ADD_DATE>` entries against a folder stack. The folder path becomes `sources[].ref` and a *group hint* for enrichment; it does **not** become a hierarchy. |
| `make import-slack [FILE=…]` | With `FILE`, walks a Slack export directory's channel JSON for URLs in message text and attachments, keeping the surrounding message as context. Without `FILE`, consumes `data/inbox/slack-links.json`. |
| `make import-youtube URL=…` | A playlist or channel. Reads `https://www.youtube.com/feeds/videos.xml?playlist_id=…` — a public RSS feed, so no API key and no dependency. Creates one `kind: "playlist"` record plus one `kind: "video"` record per entry, all sharing `playlist:<slug>`. **Truncation caveat below.** |

**YouTube playlist caveat — verified, not assumed.** The RSS feed needs no API key and
returns HTTP 200, but it is **truncated**: a probe of a real playlist returned only 2
entries, and the feed caps out around the 15 most recent in any case. So the feed alone
cannot import a long playlist.

Therefore `import-youtube` degrades explicitly rather than silently importing a partial
list: it uses the feed when the entry count looks complete, falls back to `yt-dlp
--flat-playlist -J` when that binary is present (still no API key, still no npm
dependency), and otherwise **reports how many it got and tells you it is partial**. A
half-imported playlist that claims success is worse than a refusal.

**The Slack inbox contract.** `data/inbox/slack-links.json` is a deliberately dumb file:

```json
[{ "url": "https://…", "context": "message text", "channel": "#ml-papers", "ts": "…" }]
```

Anything can produce it — a Slack export, a script, or an interactive Claude session using
the Slack MCP server. The importer only has to understand this one shape.

### 3.1 Canonicalization — the basis of all deduping

Every importer routes its URLs through one `canonicalUrl()` in `tools/lib/url.mjs`. One
function, one set of rules, so no two importers can disagree about whether two links are
the same link:

1. Lowercase the scheme and host; strip a leading `www.`; force `https` where the host is
   known to serve it.
2. Drop tracking params: `utm_*`, `fbclid`, `gclid`, `ref`, `ref_src`, `si`, `feature`.
3. Drop the fragment, **except** where it carries identity (`#/`-style SPA routes).
4. Strip a trailing slash and a trailing `index.html`.
5. Sort the surviving query params, so param order cannot produce two ids.
6. Apply per-host identity rules, which reduce a URL to the thing it actually names:
   - YouTube — any of `youtu.be/<id>`, `/watch?v=<id>`, `/embed/<id>`, `/shorts/<id>`
     collapses to a single canonical watch URL for `<id>`. A `list=` param becomes the
     playlist's identity only for `kind: "playlist"` records.
   - GitHub — `owner/repo` (deep links to a file or tree keep their path; a repo root,
     `/tree/main`, and a trailing `.git` all collapse).
   - arXiv — `abs`, `pdf`, and versioned (`v2`) forms collapse to the bare arXiv id.
   - Google Docs/Drive — the document id, dropping `/edit`, `/view`, and `gid=`.

### 3.2 Deduping — exact, then near

**Exact.** Identical `id` (i.e. identical canonical URL) is the same bookmark. Automatic,
silent, always on. Every importer and `make add` is idempotent by construction: running the
same import twice is a no-op on the store.

**Near.** Different canonical URLs that plausibly name one thing — an arXiv abstract and
the author's PDF mirror, a repo and its docs site, the same talk on YouTube and on a
conference site. These are **surfaced, never auto-merged**: `make dedupe` reports candidate
pairs (shared title after normalization, shared `owner/repo`, shared arXiv id, same host
and >0.9 title similarity) and takes an explicit `--merge <id> <id>` to act. Silent
automatic merging of things that merely look alike would lose data.

A merge keeps the older `addedAt`, unions `sources`, `groups`, `tags`, and `related`,
concatenates `notes` under `## from <url>` headings, and `starred` is true if either was.

### 3.3 Grouping related things

Beyond deduping, curation clusters bookmarks that are *about the same subject* without
being the same resource, and records the cluster as (a) shared `groups`/`tags` and (b)
`related` ids. Clustering is driven by the `curate-bookmarks` skill (§4.1) — shared GitHub
topics, shared tags, title and description similarity — and every proposed change is shown
as a diff before it is written.

### 3.4 The merge rule

Re-importing must never destroy your work. When an incoming record's `id` already exists:

- `starred`, `notes`, and any human-set `groups`/`tags` are **preserved untouched**
- empty fields are filled from the incoming record
- `groups`, `tags`, and `sources` are **unioned**, never replaced
- `updatedAt` advances; `addedAt` does not

This is the highest-risk behavior in the system, so it is asserted directly by a test.

---

## 4. Enrichment

`make enrich` runs `tools/enrich.mjs` over records with an empty `description` or empty
`groups`. Flags: `--all`, `--id <id>`, `--force`.

**Step 0 — classify deterministically, no LLM.** GitHub topics, language, and description
words are matched against an inspectable rule table (`tools/lib/classify.mjs`). Most repos
carry topics that map to a shelf unambiguously, and an LLM call for
`topics: ["postgres","database"]` is waste. On the seed corpus this grouped 62% of records
for free. When no rule matches, the record contributes nothing and falls through to the LLM
rather than being guessed at: a wrong group hides, an empty one surfaces in Ungrouped.

**Step 1 — scrape, no LLM.** HTTP GET with a 10s timeout and a real user agent, then read
`<title>`, `og:title`, `og:description`, `og:site_name`, and `meta[name=description]`.
YouTube URLs go to the oEmbed endpoint instead. PDFs get a range request for the first
64 KB, scanned for a `/Title` entry. Audio falls back to the filename, plus duration when
it is cheap to obtain.

**Step 2 — summarize.** In batches of ~20 records, the prompt is assembled from the body of
`.claude/skills/enrich-bookmarks/SKILL.md` plus the taxonomy plus the scraped facts, and run
as:

```
claude -p --output-format json --allowed-tools ""
```

Empty `--allowed-tools` matters: with no tools the model cannot browse, shell out, or
wander — it only transforms the facts it was handed. The expected reply is
`[{id, description, groups, tags}]`.

**Step 3 — validate.** Every group must be in the taxonomy, at most 3 groups and 8 tags,
`description` ≤160 characters. Any violation falls back to the scraped description with
`groups: []`, and logs loudly — a bad summary must be visible, never silently accepted.

**Step 4 — write back**, setting `enriched.by` and `enriched.at`. A record marked
`enriched.by: "human"` is never overwritten without `--force`: your own words outrank any
regenerated ones.

### 4.1 Repo skills

Two skills live in this repo — not in the user's global config — so that the contracts
travel with the data they describe and any clone behaves identically.

| Skill | Role |
|---|---|
| `.claude/skills/enrich-bookmarks/` | The **per-record contract**: description style, the group and tag rules, the exact JSON in/out shape. Inlined into the `claude -p` prompt by `enrich.mjs`, so the automated path and an interactive fix-up produce identically-styled results. |
| `.claude/skills/curate-bookmarks/` | The **collection-level workflow**: run the right importer for a source, canonicalize, dedupe (exact then near), enrich what's new, cluster related items, then validate and report. Used interactively — "import my YouTube ML playlist", "pull the links out of #ml-papers", "re-sync my stars" — where judgment about merging and grouping is needed. |

---

## 5. The site

`docs/` is the Pages root: `index.html`, `app.js`, and plain CSS. No bundler, no framework,
no build step — pushing the branch *is* the deploy. On load it fetches
`data/bookmarks.json` and `data/taxonomy.json`; everything after that is client-side.

**Browse.** A sidebar of group facets with counts, including a computed **Ungrouped**
facet. Facets are **multi-select**, matching the many-to-many model: selecting two groups
shows their intersection, with an AND/OR toggle. Kind-filter chips, a "starred only"
toggle, and a tag list beside them. Search is instant substring matching over title,
description, notes, tags, and URL.

**Cards.** Kind icon, title linking out, description, its group chips and tag chips, a star
toggle, an expandable notes editor, and — when `related` is non-empty — a "related" row.
Adding or removing a group on a card is a chip toggle, never a move.

**Read-only by default.** A settings panel accepts a fine-grained GitHub PAT scoped to
*Contents: read+write on this repo only*. It is held in `localStorage` and sent only to
`api.github.com`. Without a token the UI shows a read-only badge and hides every edit
affordance.

**The write path.** `GET` the file to obtain its `sha` → apply the single changed field →
`PUT` the base64 content with that `sha`. Writes are debounced ~2s and coalesced, so a
burst of typing produces one commit rather than one per keystroke. On a 409 `sha` mismatch:
re-`GET`, re-apply only the changed field, retry once, then surface an error banner —
an edit is never silently dropped.

**Scale.** The seed corpus is 542 records and will grow. The store is one fetch, and
rendering is **paged**: 60 rows initially, extended by an IntersectionObserver as you
scroll. This is not true virtualization — the DOM grows to the number of matches (542
today) and rows are never recycled — which is fine at this size and measured in §7 check 10
rather than assumed. A deep link near the end of the list renders everything before it. If
the corpus reaches a few thousand, that is when windowed rendering earns its complexity.
If the file passes ~5 MB, M8 covers sharding by group — not before, since a single file is
what makes the write path simple.

**Addressability.** `?q=`, `?g=` (repeatable), and `?tag=` are reflected in the URL so a
filtered view is shareable; `#/b/<id>` deep-links a single record. Keyboard: `/` focuses
search, `j`/`k` navigate, `s` stars, `n` opens notes, `Esc` closes. Theme follows
`prefers-color-scheme`.

---

## 6. Guardrails

`make check` runs `tools/validate.mjs`: schema conformance, unique ids, every group present
in the taxonomy, group/tag count caps, no two records sharing a canonical URL, `related`
ids all resolving, valid JSON. A `validate.yml` GitHub Action runs it on push and PR. There
is no build workflow — Pages serves `/docs` directly.

Tests use Node's built-in runner (`node --test`), no dependencies, against small fixtures:

- `canonicalUrl()` — the per-host identity rules, especially the four YouTube URL shapes
  collapsing to one id, and param-order independence
- the Chrome bookmarks HTML parser, including nested folders
- **the merge rule** — asserting stars, notes, and human-set groups survive a re-import,
  and that `groups`/`tags`/`sources` union rather than overwrite
- multi-group membership — a record in two groups appears under both facets and is not
  duplicated by an OR query
- the ungrouped invariant — `groups: []` is the only representation; no sentinel string
- taxonomy validation and the `groups: []` fallback on bad LLM output

Each test encodes *why* the behavior matters, not merely that the function returns
something.

### 6.1 Seed corpus: your GitHub stars

Initial testing uses real data, not fixtures invented for the occasion: the **542 repos
already starred by `arunkk`**. It is the right first corpus because it is large enough to
expose performance and pagination problems, it arrives with genuine metadata (descriptions
and topics) to test enrichment against, and it is authentically messy — a sample shows
repos with `description: null` and `topics: []`, which is exactly the fallback path that
needs proving.

`make seed` = `import-stars` → `enrich` → `check`. Expected outcomes, checked by hand once:

- ~542 records, zero duplicate ids, zero duplicate canonical URLs (a repo starred under
  both `github.com/o/r` and `github.com/o/r.git` must land once)
- every record has a description — repos with a `null` description exercise the scrape and
  LLM path rather than being skipped
- fewer than 10% of records land `groups: []`; a higher rate means the taxonomy is missing
  a shelf, and the fix is the taxonomy, not per-record patching.
  **Result: 9 of 542 (1.7%) ungrouped, 8 without a description.** The deterministic topic
  classifier handled 62% of grouping for free; `claude -p` grouped the remaining 271 in 14
  batches with 0 failures
- `make dedupe` candidate pairs get eyeballed once; the awesome-lists in particular should
  cluster via shared topics

---

## 7. Browser validation

Correct JSON is not a working site, so the site's acceptance criteria are checked in a real
browser using the Playwright and Chrome DevTools MCP servers against a local
`make serve` (`http://localhost:8000`), then once more against the live Pages URL after
deployment.

**Checks — each is pass/fail, not a screenshot to eyeball:**

| # | Check | Criterion |
|---|---|---|
| 1 | Load | Page renders the full record count; **zero console errors** and zero failed network requests (`list_console_messages`, `list_network_requests`). |
| 2 | Facet counts | Each sidebar group count equals the number of records containing that group in `bookmarks.json` — asserted by comparing DOM text against the JSON, not by looking. |
| 3 | Multi-membership | A record with two groups appears under each facet separately, and exactly **once** in their OR view. This is the §2 model working or not. |
| 4 | Ungrouped facet | Its count equals the number of records with `groups: []`. |
| 5 | Search | Typing a known token filters to the expected ids; clearing restores the full count. |
| 6 | Deep link | Navigating straight to `#/b/<id>` opens that record on a cold load. |
| 7 | Read-only default | With no token in `localStorage`, no star or notes control is interactive. |
| 8 | Write-back | With a token, clicking star produces exactly **one** commit for a burst (verified via `gh api` on the commit list), and the reloaded page shows the new state. |
| 9 | Conflict path | Change the file out-of-band, then edit in the browser: the 409 retry must succeed or show the error banner — never silently discard. |
| 10 | Scale | With the full ~542-record corpus, interaction stays responsive and DOM node count stays bounded (virtualization actually virtualizing) — a performance trace, not a vibe. |
| 11 | Responsive | Usable at 400 px wide with no horizontal body scroll. |
| 12 | Accessibility | A Lighthouse a11y pass: keyboard reachability for star/notes/facets, and contrast in both themes. |

**Always cache-bust.** Pages sits behind a CDN, and a browser that has already loaded
the site will happily hand back the previous version — which reads as a passing run against
code you did not deploy. This is not hypothetical: the first validation run of this repo
reported "zero console errors" against a stale copy that did not contain the change being
tested. Navigate with a unique query string (`?cachebust=<n>`) on every check, and confirm
something version-specific is actually present in the DOM before trusting any result.

Checks 1–7 and 11–12 need no token and are the pre-push gate. 8–10 run against the deployed
site as the post-deploy gate.

---

## 8. Deployment and publishing

Deployment is `git push`. There is no build, so there is nothing to break between commit
and live — the Action only validates.

### 8.1 One-time publish

```sh
gh repo create arunkk/bookmarknotes --public --source=. --remote=origin --push
gh api -X POST repos/arunkk/bookmarknotes/pages \
  -f 'source[branch]=main' -f 'source[path]=/docs'
gh api repos/arunkk/bookmarknotes/pages --jq '.html_url, .status'
```

Live at **`https://arunkk.github.io/bookmarknotes/`**. Serving from `main` + `/docs` (rather
than a `gh-pages` branch) is deliberate: the site and the store it reads are the same
commit, so the deployed page can never be reading a store from a different revision.

Wrapped as `make publish`, which refuses to run if `make check` fails, and prints the
privacy warning from §0 with a confirmation prompt before creating a **public** repo.

### 8.2 Routine deploys

`make deploy` = `check` → `git push`. The Action re-runs `check` on the server; a red run
means the store is invalid and the fix is a commit, not a retry.

Edits made *from the site* are already deploys: the Contents API write is a commit to
`main`, and Pages republishes within ~a minute. So the site updating itself and a local
`make deploy` are the same mechanism, which is why local edits must be pushed before a
browsing session — `make deploy` is also `git pull --rebase` first.

### 8.3 Write-back token

The site needs a **fine-grained** PAT: *Only select repositories* → `bookmarknotes`;
*Repository permissions* → **Contents: Read and write**, nothing else; a 90-day expiry.
Paste it into the site's settings panel, where it lives in `localStorage` and is sent only
to `api.github.com`.

- A classic PAT would grant far more than this needs — use fine-grained.
- The token is **never committed**; `.gitignore` covers `.env*`, and CI needs no secret
  because validation reads only public files.
- If it leaks, revoke at `github.com/settings/tokens` — the blast radius is commits to this
  one repo, which are revertible.

### 8.4 Recovery

Every change is a commit, so recovery is `git revert` plus `git push`. A bad bulk enrich or
a regretted merge is undone the same way. `make check` runs pre-push precisely so a broken
store is never what Pages is serving.

---

## 9. Milestones

| # | Scope |
|---|---|
| M1 | ✅ Data model, `store.mjs`, `url.mjs` (canonicalization), `validate.mjs`, 22 tests |
| M2 | GitHub stars ✅; `add`, Chrome, Slack, YouTube playlists and `dedupe` still to build |
| M3 | ✅ `enrich.mjs` — scrape signals plus a deterministic classifier, then `claude -p` |
| M4 | ✅ **Seeded** with 542 starred repos; §6.1 outcomes verified |
| M5 | ✅ Site: browse, multi-select facets, search, sort, deep links |
| M6 | Site: token-gated star/notes write-back — built, not yet exercised against a real token |
| M7 | ✅ Published; §7 checks 1–7 and 11–12 pass. Checks 8–10 need a token |
| M8 | *If and only if the store passes ~5 MB:* shard by group |

M4 lands before any UI exists, on purpose: a real 542-record store is what makes the site's
scale and facet behavior testable at all.

---

## 10. Repository layout

```
bookmarknotes/
├── SPEC.md
├── README.md
├── Makefile
├── .claude/skills/
│   ├── enrich-bookmarks/SKILL.md    # per-record: description, groups, tags
│   └── curate-bookmarks/SKILL.md    # collection: import, dedupe, cluster
├── .github/workflows/validate.yml
├── data/inbox/                       # raw source dumps, gitignored
├── tools/                            # Node ESM, zero dependencies
│   ├── add.mjs  import-stars.mjs  import-chrome.mjs
│   ├── import-slack.mjs  import-youtube.mjs
│   ├── dedupe.mjs  enrich.mjs  validate.mjs  rename-group.mjs
│   └── lib/{store.mjs,url.mjs,scrape.mjs}
└── docs/                             # GitHub Pages root (branch main, /docs)
    ├── index.html  app.js  style.css
    └── data/{bookmarks.json,taxonomy.json}
```
