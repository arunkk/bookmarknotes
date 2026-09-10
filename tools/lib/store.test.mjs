import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRecord, mergeRecord, upsertAll } from './store.mjs';

const starRecord = (over = {}) => ({
  ...newRecord({
    url: 'https://github.com/pgvector/pgvector',
    kind: 'repo',
    title: 'pgvector',
    description: 'Open-source vector similarity search for Postgres',
    tags: ['postgres'],
    source: { type: 'github-stars', ref: 'arunkk' },
  }),
  ...over,
});

// The merge rule is the highest-risk behavior in the system (SPEC.md 3.4).
// A regression here quietly destroys the only irreplaceable data in the repo:
// what the human wrote.

test('re-importing preserves a star', () => {
  const mine = starRecord({ starred: true });
  assert.equal(mergeRecord(mine, starRecord()).starred, true,
    'an importer must never un-star something the human starred');
});

test('re-importing preserves notes', () => {
  const mine = starRecord({ notes: 'read section 4 before the review' });
  assert.equal(mergeRecord(mine, starRecord()).notes, 'read section 4 before the review');
});

test('re-importing preserves a human-set description', () => {
  const mine = starRecord({
    description: 'my own wording',
    enriched: { at: 'now', by: 'human' },
  });
  const after = mergeRecord(mine, starRecord({ description: 'the repo blurb' }));
  assert.equal(after.description, 'my own wording',
    'human wording outranks a regenerated or scraped description');
});

test('groups union instead of being overwritten', () => {
  // Groups are many-to-many (SPEC.md 2). Replacing them would silently undo
  // the human's second group every time an importer ran.
  const mine = starRecord({ groups: ['Data & Databases'] });
  const after = mergeRecord(mine, starRecord({ groups: ['AI/ML'] }));
  assert.deepEqual(after.groups.sort(), ['AI/ML', 'Data & Databases']);
});

test('tags union without duplicating', () => {
  const mine = starRecord({ tags: ['postgres', 'vector-search'] });
  const after = mergeRecord(mine, starRecord({ tags: ['postgres', 'embeddings'] }));
  assert.deepEqual(after.tags.sort(), ['embeddings', 'postgres', 'vector-search']);
});

test('a second origin is appended, not replaced', () => {
  // Knowing a link came from both Slack and your stars is real information.
  const mine = starRecord();
  const after = mergeRecord(mine, starRecord({
    sources: [{ type: 'slack', ref: '#ml-papers', at: 'now' }],
  }));
  assert.deepEqual(after.sources.map((s) => s.type).sort(), ['github-stars', 'slack']);
});

test('the same origin twice does not accumulate', () => {
  const mine = starRecord();
  const after = mergeRecord(mine, starRecord());
  assert.equal(after.sources.length, 1, 're-running one import must not grow the source list');
});

test('addedAt is preserved and updatedAt advances', () => {
  // Both timestamps are pinned to the past rather than compared against "now":
  // a merge that lands in the same millisecond as record creation would make a
  // notEqual assertion flake, which is a broken test, not a caught bug.
  const mine = starRecord({
    addedAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
  });
  const after = mergeRecord(mine, starRecord());
  assert.equal(after.addedAt, '2020-01-01T00:00:00.000Z', 'when you first saved it does not change');
  assert.ok(after.updatedAt > mine.updatedAt, 'a merge must record that the record changed');
});

test('importing twice is a no-op on the store size', () => {
  // Idempotence is what lets `make import-stars` be run on a whim.
  const batch = [starRecord()];
  const first = upsertAll([], batch);
  const second = upsertAll(first.records, batch);
  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(second.merged, 1);
  assert.equal(second.records.length, 1);
});

test('differently-spelled URLs for one repo import as one record', () => {
  // This is canonicalization and the store working together; either alone is
  // not enough to keep the store free of duplicates.
  const a = newRecord({ url: 'https://github.com/pgvector/pgvector' });
  const b = newRecord({ url: 'https://github.com/PGVector/pgvector.git' });
  assert.equal(upsertAll([], [a, b]).records.length, 1);
});

test('a new record starts unstarred, unnoted, and ungrouped', () => {
  // Ungrouped is the empty array, never a sentinel string (SPEC.md 2).
  const r = newRecord({ url: 'https://example.com' });
  assert.deepEqual(r.groups, []);
  assert.equal(r.starred, false);
  assert.equal(r.notes, '');
});
