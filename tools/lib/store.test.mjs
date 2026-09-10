import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRecord, mergeRecord, upsertAll, mergePair, relatePair } from './store.mjs';

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

// A merge is the only destructive operation in the system, and the live corpus
// currently has zero merge candidates — so these tests are the only thing
// exercising it. They assert the "never destroy what the human wrote" promise
// (PRODUCT.md principle 1) field by field.

const pairToMerge = () => {
  const keep = {
    ...newRecord({ url: 'https://arxiv.org/abs/1706.03762', title: 'Attention Is All You Need' }),
    starred: false,
    notes: 'the original',
    groups: ['AI/ML'],
    tags: ['transformers'],
    addedAt: '2021-01-01T00:00:00.000Z',
    sources: [{ type: 'slack', ref: '#ml-papers', at: 'x' }],
  };
  const drop = {
    ...newRecord({ url: 'https://example.com/mirror/attention.pdf', title: 'attention.pdf' }),
    starred: true,
    notes: 'grabbed the mirror',
    groups: ['Science'],
    tags: ['paper'],
    addedAt: '2019-05-05T00:00:00.000Z',
    sources: [{ type: 'chrome', ref: 'reading', at: 'y' }],
  };
  return { keep, drop };
};

test('merging keeps a star that lived on either record', () => {
  const { keep, drop } = pairToMerge();
  assert.equal(mergePair(keep, drop).starred, true,
    'the star was a deliberate act; which copy carried it is an accident');
});

test('merging keeps the notes from both, attributed', () => {
  const { keep, drop } = pairToMerge();
  const out = mergePair(keep, drop);
  assert.match(out.notes, /the original/);
  assert.match(out.notes, /grabbed the mirror/);
  assert.match(out.notes, /## from https:\/\/example\.com\/mirror\/attention\.pdf/,
    'the folded note says where it came from, or it becomes unattributable');
});

test('merging unions groups and tags across both records', () => {
  const { keep, drop } = pairToMerge();
  const out = mergePair(keep, drop);
  assert.deepEqual(out.groups.sort(), ['AI/ML', 'Science']);
  assert.deepEqual(out.tags.sort(), ['paper', 'transformers']);
});

test('merging keeps the earlier addedAt', () => {
  const { keep, drop } = pairToMerge();
  assert.equal(mergePair(keep, drop).addedAt, '2019-05-05T00:00:00.000Z',
    'the collection gained this thing on the earlier date, whichever copy survives');
});

test('the dropped URL is recorded so a merge stays traceable', () => {
  const { keep, drop } = pairToMerge();
  assert.deepEqual(mergePair(keep, drop).mergedFrom, ['https://example.com/mirror/attention.pdf'],
    'without this the second address is gone and the merge cannot be audited');
});

test('the surviving record keeps its own id and url', () => {
  const { keep, drop } = pairToMerge();
  const out = mergePair(keep, drop);
  assert.equal(out.id, keep.id);
  assert.equal(out.url, keep.url);
});

test('merging never leaves a record related to itself', () => {
  const { keep, drop } = pairToMerge();
  keep.related = [drop.id];
  drop.related = [keep.id];
  assert.deepEqual(mergePair(keep, drop).related, [],
    'a self-reference would fail validation and render as a link to nowhere');
});

test('relating two records is symmetric and idempotent', () => {
  const a = newRecord({ url: 'https://github.com/3b1b/manim' });
  const b = newRecord({ url: 'https://github.com/ManimCommunity/manim' });
  relatePair(a, b);
  relatePair(a, b);
  assert.deepEqual(a.related, [b.id], 'relating twice must not duplicate the link');
  assert.deepEqual(b.related, [a.id], 'the reader needs the link from either side');
});

test('a union that would exceed the tag cap is trimmed, keeping the earlier tags', () => {
  // Real failure: a repo imported from stars with 8 topic tags, then seen in
  // Slack, gained a 9th and made the whole store fail validation.
  const mine = starRecord({ tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
  const after = mergeRecord(mine, starRecord({ tags: ['src:slack'] }));
  assert.equal(after.tags.length, 8, 'the cap is what validate enforces, so the merge must respect it');
  assert.deepEqual(after.tags, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    'the established tags survive; the incoming surplus is what drops');
});

test('a union within the cap is untouched', () => {
  const mine = starRecord({ tags: ['a', 'b'] });
  assert.deepEqual(mergeRecord(mine, starRecord({ tags: ['c'] })).tags.sort(), ['a', 'b', 'c']);
});

test('a group union is capped too', () => {
  const mine = starRecord({ groups: ['AI/ML', 'Security', 'Science'] });
  const after = mergeRecord(mine, starRecord({ groups: ['Personal'] }));
  assert.equal(after.groups.length, 3);
});
