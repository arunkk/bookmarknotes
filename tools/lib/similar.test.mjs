import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens, jaccard, basename, githubRepo, arxivId, contentSimilarity, normalizeName, projectName } from './similar.mjs';

// These helpers decide which pairs a human is asked to look at. Too loose and
// the report is noise nobody reads; too tight and real fork families are
// silently dropped (SPEC.md 3.2).

test('boilerplate words do not make two projects look alike', () => {
  // Without a stop list, every "open source library for python" scores as
  // related and the report fills with pairs that share nothing but filler.
  const a = { title: 'alpha', description: 'An open source library for building things', tags: [] };
  const b = { title: 'beta', description: 'A simple open source library used to build things', tags: [] };
  assert.ok(contentSimilarity(a, b) < 0.3, 'shared filler must not imply a relationship');
});

test('singular and plural forms count as the same word', () => {
  assert.ok(jaccard(tokens('mathematical animation'), tokens('mathematical animations')) > 0.9);
});

test('a distinctive shared subject scores as related', () => {
  const a = { title: 'clickhouse-cli', description: 'Command line client for ClickHouse', tags: ['clickhouse'] };
  const b = { title: 'awesome-clickhouse', description: 'ClickHouse tools and clients', tags: ['clickhouse'] };
  assert.ok(contentSimilarity(a, b) >= 0.3, 'same named technology plus shared tag is real evidence');
});

test('unrelated repos that share a generic name score low', () => {
  // Four repos in the real collection are called "skills". The name alone must
  // never be enough to claim a relationship.
  const a = { title: 'browserbase/skills', description: 'Agent skills for browsing and acting on the web', tags: ['browser'] };
  const b = { title: 'molefrog/skills', description: 'Claude skill that generates PDFs using react-pdf', tags: ['pdf'] };
  assert.ok(contentSimilarity(a, b) < 0.28, 'a shared generic name is not corroboration');
});

test('empty descriptions score zero rather than matching everything', () => {
  // 8 records have no description. If empty matched empty, they would all
  // appear related to each other.
  const a = { title: 'grafana/skills', description: '', tags: [] };
  const b = { title: 'other/skills', description: '', tags: [] };
  assert.ok(contentSimilarity(a, b) < 0.28);
});

test('githubRepo extracts owner/repo and ignores other hosts', () => {
  assert.equal(githubRepo('https://github.com/pgvector/pgvector'), 'pgvector/pgvector');
  assert.equal(githubRepo('https://github.com/o/r/blob/main/README.md'), 'o/r');
  assert.equal(githubRepo('https://example.com/o/r'), null);
});

test('basename is the last path segment', () => {
  assert.equal(basename('https://github.com/3b1b/manim'), 'manim');
  assert.equal(basename('https://example.com/'), '');
});

test('normalizeName collapses punctuation so django-easy-pdf matches', () => {
  assert.equal(normalizeName('django-easy-pdf'), normalizeName('django_easy.pdf'));
});

test('arxivId is read from the canonical abs form only', () => {
  assert.equal(arxivId('https://arxiv.org/abs/1706.03762'), '1706.03762');
  assert.equal(arxivId('https://github.com/o/r'), null);
});

test('a name collision only counts on a code forge', () => {
  // Five unrelated ReadTheDocs pages all end in /latest/, and two unrelated
  // products both end in /chat. Those are routing, not names, and treating
  // them as collisions filled the review queue with noise.
  assert.equal(projectName('https://pypika.readthedocs.io/en/latest/'), '');
  assert.equal(projectName('https://mulerun.com/chat'), '');
  assert.equal(projectName('https://www.phind.com/search'), '');
});

test('a forge URL yields the repo name', () => {
  assert.equal(projectName('https://github.com/3b1b/manim'), 'manim');
  assert.equal(projectName('https://github.com/ManimCommunity/manim'), 'manim');
  assert.equal(
    projectName('https://github.com/nigma/django-easy-pdf'),
    projectName('https://gitlab.com/other/django_easy.pdf'),
    'punctuation must not split a name across forges',
  );
});

test('a forge URL with no repo yields nothing', () => {
  assert.equal(projectName('https://github.com/temporalio'), '');
});
