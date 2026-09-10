import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rejectReason } from './private.mjs';

// This filter is the only thing standing between a personal Slack scratchpad
// and a public repository. The channel it reads holds API keys, internal
// hostnames, and notes about colleagues alongside the links. Each test below
// corresponds to something actually found in that channel.

test('private network addresses are refused', () => {
  for (const u of [
    'http://192.168.11.203/',
    'http://10.0.0.5/admin',
    'http://172.16.4.1/',
    'http://127.0.0.1:8000/',
    'http://localhost:3000/',
  ]) {
    assert.ok(rejectReason(u), `${u} must not be publishable`);
  }
});

test('a public address that merely looks numeric is allowed', () => {
  // 192.168.x is private; 8.8.8.8 is not. An over-broad rule would silently
  // drop legitimate links.
  assert.equal(rejectReason('http://8.8.8.8/'), null);
  assert.equal(rejectReason('https://172.15.0.1/'), null, '172.15 is outside the private range');
});

test('internal company hosts are refused', () => {
  assert.ok(rejectReason('https://jenkins.mirage.percipient.ai/view/Build/job/x/'));
  assert.ok(rejectReason('https://ingest-test.mirage.percipient.ai/admin/'));
  assert.ok(rejectReason('https://percipient.ai/'));
});

test('the public GitHub org is NOT treated as an internal host', () => {
  // github.com/percipient-ai/... is a different host from *.percipient.ai.
  // Conflating them would drop legitimate repo links.
  assert.equal(rejectReason('https://github.com/percipient-ai/mirage-backend-django'), null);
});

test('internal cloud hostnames are refused', () => {
  assert.ok(rejectReason('http://ec2-3-15-225-166.us-east-2.compute.amazonaws.com'));
  assert.ok(rejectReason('http://nga-ob-phase3-1661979559.us-east-2.elb.amazonaws.com'));
});

test('public AWS content is still allowed', () => {
  // Blocking all of amazonaws.com would drop blog posts and docs.
  assert.equal(rejectReason('https://aws.amazon.com/blogs/big-data/something/'), null);
});

test('private assistant sessions and shares are refused', () => {
  assert.ok(rejectReason('https://claude.ai/code/session_01SuqtEUnVoMgTTBzqmvesM6'));
  assert.ok(rejectReason('https://chatgpt.com/share/688a917d-39f8-800f-abc5-e7e859d7464c'));
});

test('public pages on those same hosts are allowed', () => {
  assert.equal(rejectReason('https://claude.ai/'), null);
});

test('private documents are refused', () => {
  assert.ok(rejectReason('https://docs.google.com/document/d/1BiotUrJ/edit'));
  assert.ok(rejectReason('https://drive.google.com/file/d/abc/view'));
});

test('a URL carrying a credential is refused', () => {
  // A key in a query string would be published verbatim and indexed.
  assert.ok(rejectReason('https://example.com/api?api_key=sk-live-123'));
  assert.ok(rejectReason('https://example.com/x?access_token=abc'));
  assert.ok(rejectReason('https://example.com/x?password=hunter2'));
});

test('a normal query string is not mistaken for a credential', () => {
  assert.equal(rejectReason('https://example.com/search?q=vector+search&page=2'), null);
});

test('non-http schemes and non-URLs are refused', () => {
  assert.ok(rejectReason('mailto:arun@percipient.ai'));
  assert.ok(rejectReason('file:///etc/passwd'));
  assert.ok(rejectReason('192.168.11.203 ( Bosc Camera )'));
  assert.ok(rejectReason(''));
});

test('an ordinary public link passes', () => {
  assert.equal(rejectReason('https://github.com/pgvector/pgvector'), null);
  assert.equal(rejectReason('https://arxiv.org/abs/1706.03762'), null);
});
