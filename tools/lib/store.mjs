import { readFileSync, writeFileSync } from 'node:fs';
import { canonicalUrl, makeId } from './url.mjs';

export const STORE_PATH = 'docs/data/bookmarks.json';
export const TAXONOMY_PATH = 'docs/data/taxonomy.json';

export const loadStore = (p = STORE_PATH) => JSON.parse(readFileSync(p, 'utf8'));
export const loadTaxonomy = (p = TAXONOMY_PATH) => JSON.parse(readFileSync(p, 'utf8'));

/** Sorted by id and pretty-printed so diffs stay readable (SPEC.md 1). */
export function saveStore(records, p = STORE_PATH) {
  const sorted = [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  writeFileSync(p, JSON.stringify(sorted, null, 2) + '\n');
  return sorted;
}

const uniq = (xs) => [...new Set(xs.filter(Boolean))];

export function newRecord({
  url,
  kind = 'web',
  title = '',
  description = '',
  groups = [],
  tags = [],
  meta = {},
  source,
}) {
  const now = new Date().toISOString();
  return {
    id: makeId(url),
    url: canonicalUrl(url),
    kind,
    title,
    description,
    groups: [...groups],
    tags: uniq(tags),
    starred: false,
    notes: '',
    sources: source ? [{ ...source, at: source.at || now }] : [],
    meta,
    related: [],
    enriched: { at: null, by: 'none' },
    addedAt: now,
    updatedAt: now,
  };
}

const dedupeSources = (sources) => {
  const seen = new Set();
  return sources.filter((s) => {
    const k = `${s.type} ${s.ref ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * The merge rule (SPEC.md 3.4). Re-importing must never destroy work:
 * starred, notes, and human-set groups/tags survive untouched; empty fields
 * are filled; groups/tags/sources union rather than overwrite.
 *
 * `existing` wins on every field a human may have touched. That asymmetry is
 * the whole point: an importer is a worse authority than a person.
 */
export function mergeRecord(existing, incoming) {
  const humanEdited = existing.enriched?.by === 'human';
  return {
    ...existing,
    kind: existing.kind || incoming.kind,
    title: existing.title || incoming.title,
    description: humanEdited
      ? existing.description
      : existing.description || incoming.description,
    groups: uniq([...(existing.groups || []), ...(incoming.groups || [])]),
    tags: uniq([...(existing.tags || []), ...(incoming.tags || [])]),
    starred: existing.starred,
    notes: existing.notes,
    sources: dedupeSources([...(existing.sources || []), ...(incoming.sources || [])]),
    meta: { ...incoming.meta, ...existing.meta },
    related: uniq([...(existing.related || []), ...(incoming.related || [])]),
    enriched: existing.enriched,
    addedAt: existing.addedAt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fold incoming records into the store by id. Returns counts so callers can
 * report concretely instead of claiming "imported successfully".
 */
export function upsertAll(store, incoming) {
  const byId = new Map(store.map((r) => [r.id, r]));
  let added = 0;
  let merged = 0;
  for (const rec of incoming) {
    const prev = byId.get(rec.id);
    if (prev) {
      byId.set(rec.id, mergeRecord(prev, rec));
      merged++;
    } else {
      byId.set(rec.id, rec);
      added++;
    }
  }
  return { records: [...byId.values()], added, merged };
}
