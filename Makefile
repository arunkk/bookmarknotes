# BookmarkNotes — see SPEC.md
# Targets marked TODO are declared but not implemented yet; each names its milestone.

STORE    := docs/data/bookmarks.json
TAXONOMY := docs/data/taxonomy.json
REPO     := arunkk/bookmarknotes
PORT     ?= 8000

.DEFAULT_GOAL := help
.PHONY: help add import-stars import-chrome import-slack import-youtube \
        dedupe enrich rename-group seed check test serve publish deploy

help:
	@echo "BookmarkNotes"
	@echo ""
	@echo "  Import"
	@echo "    make add URL=<url> [KIND=<kind>]          one bookmark              (TODO: M2)"
	@echo "    make import-stars                        your GitHub stars                  "
	@echo "    make import-chrome FILE=<bookmarks.html> Chrome bookmarks          (TODO: M2)"
	@echo "    make import-slack [FILE=<export-dir>]    links from Slack          (TODO: M2)"
	@echo "    make import-youtube URL=<playlist>       playlist or channel       (TODO: M2)"
	@echo ""
	@echo "  Curate"
	@echo "    make dedupe [ARGS=--deep]                what looks duplicated or related  "
	@echo "    make dedupe ARGS=\"--merge A B\"          fold B into A                      "
	@echo "    make dedupe ARGS=\"--relate A B\"         link two related records            "
	@echo "    make enrich                              describe + group with claude -p    "
	@echo "    make rename-group FROM=<a> TO=<b>        rewrite a group name      (TODO: M2)"
	@echo "    make seed                                stars -> enrich -> check           "
	@echo ""
	@echo "  Verify and ship"
	@echo "    make check                               validate the store                 "
	@echo "    make test                                unit tests                         "
	@echo "    make serve                               preview at localhost:$(PORT)"
	@echo "    make publish                             create repo + enable Pages (one time)"
	@echo "    make deploy                              check, pull, push"
	@echo ""
	@echo "  Store: $(STORE)    Repo: $(REPO)"

import-stars:
	node tools/import-stars.mjs

add import-chrome import-slack import-youtube:
	@echo "not yet implemented — see SPEC.md section 3 (milestone M2)"; exit 1

dedupe:
	node tools/dedupe.mjs $(ARGS)

rename-group:
	@echo "not yet implemented — see SPEC.md section 3.2 (milestone M2)"; exit 1

enrich:
	node tools/enrich.mjs $(ARGS)

seed:
	$(MAKE) import-stars
	$(MAKE) enrich
	$(MAKE) check

check:
	node tools/validate.mjs

test:
	node --test 'tools/**/*.test.mjs'

serve:
	@echo "http://localhost:$(PORT)"
	@python3 -m http.server $(PORT) -d docs

# One-time. Creates a PUBLIC repo — bookmarks and notes become world-readable.
publish: check
	@echo "About to create PUBLIC repo $(REPO) and publish it via GitHub Pages."
	@echo "Everything in $(STORE), INCLUDING YOUR NOTES, becomes world-readable."
	@read -p "Type 'publish' to continue: " ans; [ "$$ans" = "publish" ] || { echo "aborted"; exit 1; }
	gh repo create $(REPO) --public --source=. --remote=origin --push
	gh api -X POST repos/$(REPO)/pages -f 'source[branch]=main' -f 'source[path]=/docs'
	@gh api repos/$(REPO)/pages --jq '"live: " + .html_url + " (" + .status + ")"'

deploy: check
	git pull --rebase
	git push
	@echo "pushed — Pages republishes within ~a minute"
