# BookmarkNotes

One place for every link worth keeping — websites, PDFs, docs, YouTube videos and
playlists, mp3s — collected from GitHub stars, Chrome bookmarks, Slack, and one-off pastes;
each with a short auto-discovered description, organized by overlapping groups, and
browsable as a real web page on GitHub Pages.

Stars and notes are saved back into this repo as commits, so they follow you across devices
instead of dying with a browser cache.

> **Status: design only.** [`SPEC.md`](SPEC.md) is the approved design. The tools and the
> site are not implemented yet — see the milestones in §9.

## ⚠️ This repo is public

The bookmarks **and your notes** are world-readable. Write nothing in a note you would not
post publicly. If you need private notes, the spec describes a gitignored
`docs/data/bookmarks.local.json` overlay that stays on your machine.

## How it works

- **Store** — `docs/data/bookmarks.json`, one JSON array, pretty-printed and sorted so git
  diffs stay readable.
- **Groups are tags, not folders** — a bookmark belongs to *several* groups at once, so
  `pgvector` can be both AI/ML and Data & Databases. No hierarchy anywhere; ungrouped is
  simply an empty array.
- **Import** — zero-dependency Node scripts pull from each source and dedupe on one
  canonical URL function. Re-importing never overwrites a star, a note, or a group you set
  yourself.
- **Enrich** — a metadata scrape, then `claude -p` turns the scraped facts into a one-line
  description and picks groups from the curated taxonomy.
- **Site** — plain HTML/JS in `docs/`, no build step. Read-only for visitors; with a
  fine-grained GitHub token pasted into its settings panel, starring and note-taking commit
  straight back to the repo.
- **Deploy** — `git push`. There is no build, so nothing can break between commit and live.

## Quickstart

```sh
make                                  # list every target
make import-stars                     # your GitHub stars (the seed corpus: 542 repos)
make import-youtube URL=<playlist>    # a playlist, expanded per video
make import-chrome FILE=~/Downloads/bookmarks.html
make import-slack FILE=<slack-export> # or write data/inbox/slack-links.json
make add URL=https://example.com      # one-off link
make enrich                           # describe + group new entries
make dedupe                           # near-duplicate candidates to review
make check                            # validate the store
make serve                            # preview at localhost:8000
make publish                          # one time: create the repo, enable Pages
make deploy                           # check, pull, push
```

## Claude skills, in this repo

Both travel with the data they describe, so any clone behaves identically:

| Skill | Use it for |
|---|---|
| `curate-bookmarks` | Importing and updating from any source, deduping, and grouping related things. "Import my ML playlist", "pull the links out of #ml-papers", "re-sync my stars". |
| `enrich-bookmarks` | The per-record contract: description style, group and tag rules, JSON shape. Inlined into `make enrich`. |

## Layout

| Path | What |
|---|---|
| `SPEC.md` | The design document — read this first |
| `docs/` | GitHub Pages root (branch `main`, `/docs`) |
| `docs/data/bookmarks.json` | The store |
| `docs/data/taxonomy.json` | Curated group names, limits, description style |
| `tools/` | Importers, dedupe, enrichment, validation |
| `.claude/skills/` | The two repo skills above |
| `data/inbox/` | Raw source dumps (gitignored) |
