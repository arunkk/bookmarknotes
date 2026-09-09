# BookmarkNotes — see SPEC.md
# Targets marked TODO are declared but not implemented yet; each names its milestone.

STORE := docs/data/bookmarks.json
TAXONOMY := docs/data/taxonomy.json
PORT ?= 8000

.DEFAULT_GOAL := help
.PHONY: help add import-chrome import-stars import-slack enrich check test serve

help:
	@echo "BookmarkNotes"
	@echo ""
	@echo "  make add URL=<url> [KIND=<kind>]        add one bookmark            (TODO: M2)"
	@echo "  make import-chrome FILE=<bookmarks.html> import Chrome bookmarks    (TODO: M2)"
	@echo "  make import-stars                      import your GitHub stars    (TODO: M2)"
	@echo "  make import-slack [FILE=<export-dir>]  import links from Slack      (TODO: M2)"
	@echo "  make enrich                            describe + categorize        (TODO: M3)"
	@echo "  make check                             validate the store           (TODO: M1)"
	@echo "  make test                              run unit tests               (TODO: M1)"
	@echo "  make serve                             preview the site locally"
	@echo ""
	@echo "Store: $(STORE)"

add:
	@echo "not yet implemented — see SPEC.md section 2 (milestone M2)"; exit 1

import-chrome:
	@echo "not yet implemented — see SPEC.md section 2 (milestone M2)"; exit 1

import-stars:
	@echo "not yet implemented — see SPEC.md section 2 (milestone M2)"; exit 1

import-slack:
	@echo "not yet implemented — see SPEC.md section 2 (milestone M2)"; exit 1

enrich:
	@echo "not yet implemented — see SPEC.md section 3 (milestone M3)"; exit 1

check:
	@echo "not yet implemented — see SPEC.md section 5 (milestone M1)"
	@echo "interim check: JSON parses"
	@node -e "JSON.parse(require('fs').readFileSync('$(STORE)','utf8'));JSON.parse(require('fs').readFileSync('$(TAXONOMY)','utf8'));console.log('  ok: $(STORE), $(TAXONOMY)')"

test:
	@echo "no tests yet — see SPEC.md section 5 (milestone M1)"

serve:
	@echo "http://localhost:$(PORT)"
	@python3 -m http.server $(PORT) -d docs
