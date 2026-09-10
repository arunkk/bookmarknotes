#!/usr/bin/env node
/**
 * Validate the store (SPEC.md 6). Exits non-zero on any violation so a broken
 * store can never be what Pages is serving.
 */
import { loadStore, loadTaxonomy } from './lib/store.mjs';
import { canonicalUrl, makeId } from './lib/url.mjs';

const KINDS = new Set(['web', 'pdf', 'doc', 'video', 'playlist', 'audio', 'repo', 'local']);
const ENRICHED_BY = new Set(['claude', 'scrape', 'human', 'none']);

const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

const store = loadStore();
const taxonomy = loadTaxonomy();
const allowed = new Set(taxonomy.groups);
const { maxGroups = 3, maxTags = 8, maxDescriptionChars = 160 } = taxonomy.limits || {};

if (!Array.isArray(store)) {
  console.error('store is not an array');
  process.exit(1);
}
if (allowed.has('Unsorted')) {
  err('taxonomy', 'contains "Unsorted"; ungrouped is groups: [] (SPEC.md 2)');
}

const seenId = new Map();
const seenUrl = new Map();
const ids = new Set(store.map((r) => r.id));

for (const r of store) {
  const id = r.id ?? '(missing id)';

  if (!r.id || !/^b_[0-9a-f]{8}$/.test(r.id)) err(id, 'malformed id');
  if (seenId.has(r.id)) err(id, `duplicate id (also ${seenId.get(r.id)})`);
  seenId.set(r.id, r.title || r.url);

  if (!r.url) err(id, 'missing url');
  else {
    const canon = canonicalUrl(r.url);
    if (canon !== r.url) err(id, `url is not canonical (should be ${canon})`);
    if (makeId(r.url) !== r.id) err(id, 'id does not match its url');
    if (seenUrl.has(canon)) err(id, `duplicate canonical url (also ${seenUrl.get(canon)})`);
    seenUrl.set(canon, r.id);
  }

  if (!KINDS.has(r.kind)) err(id, `unknown kind "${r.kind}"`);

  if (!Array.isArray(r.groups)) err(id, 'groups is not an array');
  else {
    for (const g of r.groups) if (!allowed.has(g)) err(id, `group "${g}" not in taxonomy`);
    if (r.groups.length > maxGroups) err(id, `${r.groups.length} groups > ${maxGroups}`);
    if (new Set(r.groups).size !== r.groups.length) err(id, 'duplicate groups');
  }

  if (!Array.isArray(r.tags)) err(id, 'tags is not an array');
  else {
    if (r.tags.length > maxTags) err(id, `${r.tags.length} tags > ${maxTags}`);
    if (new Set(r.tags).size !== r.tags.length) err(id, 'duplicate tags');
    for (const t of r.tags) if (t !== t.toLowerCase()) err(id, `tag "${t}" is not lowercase`);
  }

  if (typeof r.description !== 'string') err(id, 'description is not a string');
  else if (r.description.length > maxDescriptionChars) {
    err(id, `description ${r.description.length} chars > ${maxDescriptionChars}`);
  }

  if (typeof r.starred !== 'boolean') err(id, 'starred is not a boolean');
  if (typeof r.notes !== 'string') err(id, 'notes is not a string');
  if (!Array.isArray(r.sources)) err(id, 'sources is not an array');
  if (!ENRICHED_BY.has(r.enriched?.by)) err(id, `unknown enriched.by "${r.enriched?.by}"`);

  // mergedFrom is the audit trail for a merge: the addresses this record
  // absorbed. Optional, but when present it must be usable URLs.
  if (r.mergedFrom !== undefined) {
    if (!Array.isArray(r.mergedFrom)) err(id, 'mergedFrom is not an array');
    else {
      for (const u of r.mergedFrom) {
        if (typeof u !== 'string' || !u) err(id, 'mergedFrom holds a non-string');
        else if (u === r.url) err(id, 'mergedFrom lists this record\'s own url');
      }
      if (new Set(r.mergedFrom).size !== r.mergedFrom.length) err(id, 'duplicate mergedFrom urls');
    }
  }

  if (!Array.isArray(r.related)) err(id, 'related is not an array');
  else {
    for (const rel of r.related) {
      if (!ids.has(rel)) err(id, `related id ${rel} does not resolve`);
      if (rel === r.id) err(id, 'related to itself');
    }
  }
}

// Sorted-by-id is what keeps diffs readable and conflicts local (SPEC.md 1).
const sorted = [...store].map((r) => r.id).sort();
if (JSON.stringify(sorted) !== JSON.stringify(store.map((r) => r.id))) {
  errors.push('store is not sorted by id');
}

const ungrouped = store.filter((r) => !r.groups?.length).length;
const undescribed = store.filter((r) => !r.description).length;

console.log(`${store.length} records, ${allowed.size} groups in taxonomy`);
console.log(`  ungrouped: ${ungrouped} (${store.length ? ((100 * ungrouped) / store.length).toFixed(1) : 0}%)`);
console.log(`  without description: ${undescribed}`);
console.log(`  with related links: ${store.filter((r) => r.related?.length).length}`);
console.log(`  merged previously: ${store.filter((r) => r.mergedFrom?.length).length}`);

if (errors.length) {
  console.error(`\n${errors.length} validation errors:`);
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
  process.exit(1);
}
console.log('ok');
