import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, makeId } from './url.mjs';

// Identity is the basis of all deduping (SPEC.md 3.1). If two spellings of one
// resource produce two ids, the store silently accumulates duplicates and no
// amount of UI work hides it.

test('the four YouTube URL shapes for one video collapse to one id', () => {
  const shapes = [
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
  ];
  const ids = new Set(shapes.map(makeId));
  assert.equal(ids.size, 1, 'one video must be one bookmark regardless of how it was copied');
});

test('a video reached from inside a playlist is not a separate bookmark', () => {
  assert.equal(
    makeId('https://www.youtube.com/watch?v=abc12345678&list=PLxyz'),
    makeId('https://www.youtube.com/watch?v=abc12345678'),
    'the video is the resource; the playlist is context',
  );
});

test('a playlist URL with no video keeps the playlist as its identity', () => {
  assert.equal(
    canonicalUrl('https://www.youtube.com/playlist?list=PLxyz'),
    'https://www.youtube.com/playlist?list=PLxyz',
  );
});

test('GitHub repo spellings collapse, including case', () => {
  // GitHub redirects case variants, so treating them as distinct would let the
  // same repo be starred once and imported twice.
  const shapes = [
    'https://github.com/pgvector/pgvector',
    'https://github.com/PGVector/PGVector',
    'http://www.github.com/pgvector/pgvector.git',
    'https://github.com/pgvector/pgvector/tree/master',
  ];
  assert.equal(new Set(shapes.map(makeId)).size, 1);
});

test('a deep GitHub path stays distinct and keeps filename case', () => {
  // Paths below the repo are real filenames: collapsing them would merge a
  // specific file into the repo root and lose what was bookmarked.
  assert.equal(
    canonicalUrl('https://github.com/Owner/Repo/blob/main/README.md'),
    'https://github.com/owner/repo/blob/main/README.md',
  );
  assert.notEqual(
    makeId('https://github.com/owner/repo'),
    makeId('https://github.com/owner/repo/blob/main/README.md'),
  );
});

test('arXiv abs, pdf, and versioned forms are one paper', () => {
  const shapes = [
    'https://arxiv.org/abs/1706.03762',
    'https://arxiv.org/pdf/1706.03762',
    'https://arxiv.org/pdf/1706.03762v5.pdf',
  ];
  assert.equal(new Set(shapes.map(makeId)).size, 1);
});

test('query param order does not create a second id', () => {
  // Two people copying the same link from different tools must not produce two
  // records, and param order is not information about the resource.
  assert.equal(
    makeId('https://example.com/x?b=2&a=1'),
    makeId('https://example.com/x?a=1&b=2'),
  );
});

test('tracking params are dropped but real params are kept', () => {
  assert.equal(
    canonicalUrl('https://example.com/search?q=vector&utm_source=slack&si=abc'),
    'https://example.com/search?q=vector',
    'q changes what the page shows; utm_source does not',
  );
});

test('an SPA route fragment is identity, a plain fragment is not', () => {
  // Dropping #/board/2 would collapse every view of an app into one bookmark.
  assert.equal(canonicalUrl('https://app.example.com/#/board/2'), 'https://app.example.com/#/board/2');
  assert.equal(canonicalUrl('https://example.com/post#section-3'), 'https://example.com/post');
});

test('a local file path is returned untouched', () => {
  // Guessing at a non-URL would corrupt the pointer to a local mp3 or PDF.
  const p = '/home/arun/Music/talk.mp3';
  assert.equal(canonicalUrl(p), p);
});

test('empty input throws rather than producing a bogus id', () => {
  // A silently-generated id for nothing would be an unremovable ghost record.
  assert.throws(() => canonicalUrl(''), /empty input/);
});

test('tweet share parameters do not create separate ids', () => {
  // The same tweet copied from the app, the web and a share sheet arrives as
  // ?s=12, ?s=46 and ?t=…; treating those as distinct would duplicate it.
  const shapes = [
    'https://x.com/dzhng/status/2090252351533973768',
    'https://x.com/dzhng/status/2090252351533973768?s=46',
    'https://twitter.com/dzhng/status/2090252351533973768?s=20&t=abc',
    'https://mobile.twitter.com/dzhng/status/2090252351533973768',
  ];
  assert.equal(new Set(shapes.map(makeId)).size, 1);
});

test('an x.com profile or non-status path is left alone', () => {
  // Only a tweet has the owner/status/id shape; do not rewrite anything else.
  assert.equal(canonicalUrl('https://x.com/dzhng'), 'https://x.com/dzhng');
});
