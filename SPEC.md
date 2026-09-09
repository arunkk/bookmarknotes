# BookmarkNotes — Design Spec

A single place for every link worth keeping — websites, PDFs, docs, YouTube videos, mp3s —
collected from scattered sources, each carrying a short auto-discovered description,
organized into categories, and browsable *and editable* as a real web page on GitHub Pages.

Status: **design approved, implementation pending** (see [Milestones](#6-milestones)).

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
| Importers | Chrome bookmarks, GitHub stars, Slack, manual add |
| Enrichment | Metadata scrape + `claude -p`, driven by a repo skill |
| Binary files | **Reference only** — never copied into the repo |
| Visibility | Public repo, public Pages site |
| Categories | Fixed taxonomy + free-form tags |

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
  "url": "https://example.com/paper.pdf",
  "kind": "web|pdf|doc|video|audio|repo|local",
  "title": "Attention Is All You Need",
  "description": "one sentence, <=160 chars, auto-discovered",
  "category": "AI/ML",
  "tags": ["transformers", "paper"],
  "starred": false,
  "notes": "your markdown, free-form",
  "sources": [{ "type": "slack", "ref": "#ml-papers", "at": "2026-09-09T12:00:00Z" }],
  "meta": { "siteName": "", "author": "", "published": "", "durationSec": null },
  "enriched": { "at": "2026-09-09T12:00:00Z", "by": "claude|scrape|human|none" },
  "addedAt": "2026-09-09T12:00:00Z",
  "updatedAt": "2026-09-09T12:00:00Z"
}
```

**`id`** = `b_` + first 8 hex characters of `sha1(normalizedUrl)`. Normalization: lowercase
the host, drop `utm_*` / `fbclid` / `gclid` params, drop the fragment, strip a trailing
slash. Deriving the id from the URL makes ids stable across re-imports and makes deduping
free.

**`sources`** is an array, not a scalar — the same link legitimately arrives from both
Chrome and Slack, and both origins are worth knowing.

**`category`** must be a member of `docs/data/taxonomy.json`. Anything else becomes
`Unsorted`, which is itself a valid category and doubles as the review queue.

**Local files.** An mp3 or PDF sitting on disk gets `kind: "local"` and records its
absolute path. No binary is ever copied into the repo — the store keeps metadata and a
pointer, so the repo stays small and nothing private gets published by accident.

---

## 2. Ingestion

Importers are plain Node ESM scripts under `tools/`, with **zero npm dependencies**.

| Command | Behavior |
|---|---|
| `make add URL=… [KIND=…]` | One-off link. Also the endpoint behind the site's paste box. |
| `make import-chrome FILE=…` | Parses the Chrome `bookmarks.html` export — `<DT><A HREF ADD_DATE>` entries against a folder stack. The folder path becomes `sources[].ref` and a category *hint* for enrichment. |
| `make import-stars` | `gh api user/starred --paginate` (the `gh` CLI is already authenticated). `kind: "repo"`, description from the repo, tags from its topics. |
| `make import-slack [FILE=…]` | With `FILE`, walks a Slack export directory's channel JSON for URLs in message text and attachments, keeping the surrounding message as context. Without `FILE`, consumes `data/inbox/slack-links.json`. |

**The Slack inbox contract.** `data/inbox/slack-links.json` is a deliberately dumb file:

```json
[{ "url": "https://…", "context": "message text", "channel": "#ml-papers", "ts": "…" }]
```

Anything can produce it — a Slack export, a script, or an interactive Claude session using
the Slack MCP server. The importer only has to understand this one shape.

### The merge rule

Re-importing must never destroy your work. When an incoming record's `id` already exists:

- `starred`, `notes`, and a human-set `category` are **preserved untouched**
- empty fields are filled from the incoming record
- the new source is appended to `sources[]`
- `updatedAt` advances; `addedAt` does not

This is the highest-risk behavior in the system, so it is asserted directly by a test.

---

## 3. Enrichment

`make enrich` runs `tools/enrich.mjs` over records with an empty `description` or no
`category`. Flags: `--all`, `--id <id>`, `--force`.

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
`[{id, description, category, tags}]`.

**Step 3 — validate.** `category` must be in the taxonomy, `description` ≤160 characters,
at most 5 tags. Any violation falls back to the scraped description with category
`Unsorted`, and logs loudly — a bad summary must be visible, never silently accepted.

**Step 4 — write back**, setting `enriched.by` and `enriched.at`. A record marked
`enriched.by: "human"` is never overwritten without `--force`: your own words outrank any
regenerated ones.

The skill file is the single source of the prompt contract, so `make enrich` and an
interactive Claude session produce identically-styled descriptions.

---

## 4. The site

`docs/` is the Pages root: `index.html`, `app.js`, and plain CSS. No bundler, no
framework, no build step — pushing the branch *is* the deploy. On load it
fetches `data/bookmarks.json` and `data/taxonomy.json`; everything after that is
client-side.

**Browse.** A sidebar of categories with counts, kind-filter chips, a "starred only"
toggle, and a tag list. Search is instant substring matching over title, description,
notes, tags, and URL.

**Cards.** Kind icon, title linking out, description, category, tags, a star toggle, and an
expandable notes editor.

**Read-only by default.** A settings panel accepts a fine-grained GitHub PAT scoped to
*Contents: read+write on this repo only*. It is held in `localStorage` and sent only to
`api.github.com`. Without a token the UI shows a read-only badge and hides every edit
affordance.

**The write path.** `GET` the file to obtain its `sha` → apply the single changed field →
`PUT` the base64 content with that `sha`. Writes are debounced ~2s and coalesced, so a
burst of typing produces one commit rather than one per keystroke. On a 409 `sha` mismatch:
re-`GET`, re-apply only the changed field, retry once, then surface an error banner —
an edit is never silently dropped.

**Addressability.** `?q=` and `?cat=` are reflected in the URL so a filtered view is
shareable; `#/b/<id>` deep-links a single record. Keyboard: `/` focuses search, `j`/`k`
navigate, `s` stars, `n` opens notes, `Esc` closes. Theme follows
`prefers-color-scheme`.

---

## 5. Guardrails

`make check` runs `tools/validate.mjs`: schema conformance, unique ids, every category
present in the taxonomy, no duplicate normalized URLs, valid JSON. A `validate.yml` GitHub
Action runs it on push and PR. There is no build workflow — Pages serves `/docs` directly.

Tests use Node's built-in runner (`node --test`), no dependencies, against small fixtures:

- URL normalization and id stability
- the Chrome bookmarks HTML parser, including nested folders
- **the merge rule** — asserting stars and notes survive a re-import
- taxonomy validation and the `Unsorted` fallback

Each test encodes *why* the behavior matters, not merely that the function returns
something.

---

## 6. Milestones

| # | Scope |
|---|---|
| M1 | Data model, store module, `validate.mjs`, tests |
| M2 | Importers: `add`, Chrome, GitHub stars, Slack |
| M3 | `enrich.mjs` (the prompt contract in `.claude/skills/enrich-bookmarks/` already exists) |
| M4 | Site: browse, search, filter — read-only |
| M5 | Site: token-gated star/notes write-back |
| M6 | Enable Pages, seed with a real import, verify end to end |

---

## 7. Repository layout

```
bookmarknotes/
├── SPEC.md
├── README.md
├── Makefile
├── .claude/skills/enrich-bookmarks/SKILL.md
├── data/inbox/                   # raw source dumps, gitignored
├── tools/                        # Node ESM, zero dependencies
│   ├── add.mjs  import-chrome.mjs  import-stars.mjs  import-slack.mjs
│   ├── enrich.mjs  validate.mjs
│   └── lib/{store.mjs,url.mjs,scrape.mjs}
└── docs/                         # GitHub Pages root (branch main, /docs)
    ├── index.html  app.js  style.css
    └── data/{bookmarks.json,taxonomy.json}
```
