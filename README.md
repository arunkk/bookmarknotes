# BookmarkNotes

One place for every link worth keeping — websites, PDFs, docs, YouTube videos, mp3s —
collected from Chrome bookmarks, GitHub stars, Slack, and one-off pastes; each with a short
auto-discovered description, sorted into categories, and browsable as a real web page on
GitHub Pages.

Stars and notes are saved back into this repo as commits, so they follow you across devices
instead of dying with a browser cache.

> **Status: design only.** [`SPEC.md`](SPEC.md) is the approved design. The tools and the
> site are not implemented yet — see the milestones at the end of the spec.

## ⚠️ This repo is public

The bookmarks **and your notes** are world-readable. Write nothing in a note you would not
post publicly. If you need private notes, the spec describes a gitignored
`docs/data/bookmarks.local.json` overlay that stays on your machine.

## How it works

- **Store** — `docs/data/bookmarks.json`, one JSON array, pretty-printed and sorted so git
  diffs stay readable.
- **Import** — zero-dependency Node scripts pull from each source and dedupe by normalized
  URL. Re-importing never overwrites a star, a note, or a category you set yourself.
- **Enrich** — a metadata scrape, then `claude -p` turns the scraped facts into a one-line
  description and picks a category from the fixed taxonomy.
- **Site** — plain HTML/JS in `docs/`, no build step. Read-only for visitors; with a
  fine-grained GitHub token pasted into its settings panel, starring and note-taking commit
  straight back to the repo.

## Quickstart

```sh
make add URL=https://example.com     # add one link
make import-chrome FILE=~/Downloads/bookmarks.html
make import-stars                    # your GitHub stars, via gh
make enrich                          # describe + categorize new entries
make check                           # validate the store
make serve                           # preview the site at localhost:8000
```

## Layout

| Path | What |
|---|---|
| `SPEC.md` | The design document — read this first |
| `docs/` | GitHub Pages root (branch `main`, `/docs`) |
| `docs/data/bookmarks.json` | The store |
| `docs/data/taxonomy.json` | Category list + description style rules |
| `tools/` | Importers, enrichment, validation |
| `.claude/skills/enrich-bookmarks/` | The enrichment prompt contract |
| `data/inbox/` | Raw source dumps (gitignored) |
