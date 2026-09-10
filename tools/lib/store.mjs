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

/**
 * Tag and group caps are display limits from the taxonomy, and a union can
 * legitimately exceed them: a repo imported from stars with 8 topic tags then
 * seen in Slack would gain a 9th and fail validation.
 *
 * Capping keeps the EARLIER tags and drops the incoming surplus, because the
 * established ones are more likely to be the human's or the richer source's.
 * Read once — this is a hot path during a bulk import.
 */
let limitsCache = null;
const limits = () => {
  if (!limitsCache) {
    try {
      limitsCache = loadTaxonomy().limits || {};
    } catch {
      limitsCache = {};
    }
  }
  return limitsCache;
};
const capTags = (xs) => uniq(xs).slice(0, limits().maxTags ?? 8);
const capGroups = (xs) => uniq(xs).slice(0, limits().maxGroups ?? 3);

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
    groups: capGroups([...(existing.groups || []), ...(incoming.groups || [])]),
    tags: capTags([...(existing.tags || []), ...(incoming.tags || [])]),
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

/**
 * Merge two records into one (SPEC.md 3.2). `keep` survives and its id and url
 * remain; `drop` is folded in and then removed from the store by the caller.
 *
 * Nothing the human wrote is discarded: notes from both are kept under
 * headings, stars OR together, and the dropped URL is recorded in `mergedFrom`
 * so a merge stays traceable rather than silently swallowing an address.
 */
export function mergePair(keep, drop) {
  const notes = [];
  if (keep.notes) notes.push(keep.notes.trim());
  if (drop.notes) notes.push(`## from ${drop.url}\n\n${drop.notes.trim()}`);

  const older = (a, b) => ((a || '') <= (b || '') ? a : b);

  return {
    ...keep,
    title: keep.title || drop.title,
    description: keep.description || drop.description,
    groups: capGroups([...(keep.groups || []), ...(drop.groups || [])]),
    tags: capTags([...(keep.tags || []), ...(drop.tags || [])]),
    starred: Boolean(keep.starred || drop.starred),
    notes: notes.join('\n\n'),
    sources: dedupeSources([...(keep.sources || []), ...(drop.sources || [])]),
    related: uniq([...(keep.related || []), ...(drop.related || [])]).filter(
      (id) => id !== keep.id && id !== drop.id,
    ),
    mergedFrom: uniq([...(keep.mergedFrom || []), ...(drop.mergedFrom || []), drop.url]),
    meta: { ...drop.meta, ...keep.meta },
    // The pair is one thing that was saved twice; the earlier date is when it
    // actually entered the collection.
    addedAt: older(keep.addedAt, drop.addedAt),
    updatedAt: new Date().toISOString(),
  };
}

/** Add a symmetric related-link between two records, in place. */
export function relatePair(a, b) {
  a.related = uniq([...(a.related || []), b.id]).filter((id) => id !== a.id);
  b.related = uniq([...(b.related || []), a.id]).filter((id) => id !== b.id);
  const at = new Date().toISOString();
  a.updatedAt = at;
  b.updatedAt = at;
}
