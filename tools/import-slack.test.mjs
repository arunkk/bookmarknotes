import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlsFromText, kindFor } from './import-slack.mjs';

// Slack's own link syntax and the shapes actually present in the source
// channel. Getting extraction wrong either loses bookmarks or, worse, pulls
// surrounding message text into a public repo.

test('angle-bracket and labelled links are both extracted', () => {
  assert.deepEqual(urlsFromText('<https://example.com/a>'), ['https://example.com/a']);
  // Slack duplicates the URL as its own label; that must yield one address.
  assert.deepEqual(urlsFromText('<https://example.com/a|https://example.com/a>'), [
    'https://example.com/a',
  ]);
});

test('two links in one message are both found', () => {
  assert.deepEqual(urlsFromText('<https://github.com/temporalio/>\n<https://github.com/mage-ai/mage-ai>'), [
    'https://github.com/temporalio/',
    'https://github.com/mage-ai/mage-ai',
  ]);
});

test('a link with surrounding prose yields only the link', () => {
  // The prose is exactly what must not travel: the channel mixes notes and
  // credentials in with the links.
  assert.deepEqual(urlsFromText('Text 2 SQL\n<https://arxiv.org/pdf/2410.01066>'), [
    'https://arxiv.org/pdf/2410.01066',
  ]);
});

test('a message with no link yields nothing', () => {
  assert.deepEqual(urlsFromText('192.168.11.173  - Desktop'), []);
  assert.deepEqual(urlsFromText('pip install -U pyOpenSSL cryptography'), []);
  assert.deepEqual(urlsFromText(''), []);
});

test('kind is derived from the address', () => {
  assert.equal(kindFor('https://github.com/pgvector/pgvector'), 'repo');
  assert.equal(kindFor('https://gist.github.com/x/abc'), 'doc');
  assert.equal(kindFor('https://arxiv.org/abs/1706.03762'), 'pdf');
  assert.equal(kindFor('https://example.com/report.pdf'), 'pdf');
  assert.equal(kindFor('https://github.com/o/r/blob/main/nb.ipynb'), 'repo');
  assert.equal(kindFor('https://youtu.be/abc'), 'video');
  assert.equal(kindFor('https://www.youtube.com/playlist?list=PL1'), 'playlist');
  assert.equal(kindFor('https://example.com/stream/master.m3u8'), 'video');
  assert.equal(kindFor('https://pypika.readthedocs.io/en/latest/'), 'doc');
  assert.equal(kindFor('https://wezterm.org/'), 'web');
});

test('an unparseable address does not throw', () => {
  // One malformed row must not abort an import of hundreds.
  assert.equal(kindFor('not a url'), 'web');
});
