#!/usr/bin/env node
/**
 * Import links from Slack (SPEC.md 3).
 *
 * Reads `data/inbox/slack-links.json`, the deliberately dumb contract any
 * producer can fill: [{url, context, channel, ts}]. With FILE=<dir> it instead
 * walks a Slack export directory's channel JSON.
 *
 * Two safety properties, both enforced here rather than trusted upstream:
 *
 *  1. Only the `url` field is ever read into a record. Slack message text is
 *     not imported, because a personal scratchpad channel mixes links with API
 *     keys, passwords, internal hostnames and notes about colleagues, and this
 *     repository is public.
 *  2. Every URL passes rejectReason() before becoming a record, so internal
 *     hosts and private documents are refused by code, with the reason
 *     reported.
 *
 * Usage:
 *   node tools/import-slack.mjs [--dry-run]
 *   node tools/import-slack.mjs --file <slack-export-dir>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadStore, saveStore, newRecord, upsertAll, loadTaxonomy } from './lib/store.mjs';
import { classify, tagsFromTopics } from './lib/classify.mjs';
import { canonicalUrl } from './lib/url.mjs';
import { rejectReason } from './lib/private.mjs';

const INBOX = 'data/inbox/slack-links.json';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const argOf = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1];
};

/** Slack wraps links as <url> or <url|label>; pull the addresses out. */
export function urlsFromText(text) {
  const out = [];
  const s = String(text || '');
  for (const m of s.matchAll(/<((?:https?:\/\/)[^|>\s]+)(?:\|[^>]*)?>/g)) out.push(m[1]);
  // Bare URLs typed without Slack's angle brackets.
  for (const m of s.matchAll(/(?<![<|\w])(https?:\/\/[^\s<>|)"']+)/g)) out.push(m[1]);
  return [...new Set(out)];
}

/** What kind of thing this address points at, from the address alone. */
export function kindFor(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'web';
  }
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname.toLowerCase();

  if (host === 'gist.github.com') return 'doc';
  if (host === 'github.com') return 'repo';
  if (host === 'arxiv.org') return 'pdf';
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.ipynb')) return 'doc';
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
    return u.pathname === '/playlist' ? 'playlist' : 'video';
  }
  if (path.endsWith('.m3u8') || path.endsWith('.mp4')) return 'video';
  if (path.endsWith('.mp3') || path.endsWith('.wav')) return 'audio';
  if (/readthedocs\.io$/.test(host) || /^docs\./.test(host)) return 'doc';
  return 'web';
}

/**
 * The meaningful part of a path below owner/repo. `blob|tree` plus its branch
 * are routing noise; `pull/5902` and `issues/12` are not, so only the former
 * is dropped. Percent-encoding is decoded because the title is read by a
 * person, not a server.
 */
function repoSubPath(parts) {
  const rest = /^(?:blob|tree)$/.test(parts[0]) ? parts.slice(2) : parts;
  const joined = (rest.length ? rest : parts).join('/');
  try {
    return decodeURIComponent(joined);
  } catch {
    return joined;
  }
}

/** A readable title from the address, since Slack gives us none. */
function titleFor(url, kind) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    if (host === 'github.com' && parts.length >= 2) {
      const repo = `${parts[0]}/${parts[1]}`;
      return parts.length > 2 ? `${repo}: ${repoSubPath(parts.slice(2))}` : repo;
    }
    if (host === 'arxiv.org') return `arXiv ${parts[parts.length - 1]}`;
    if (kind === 'video' || kind === 'playlist') return `${host} video`;
    if (!parts.length) return host;
    return `${host}/${parts.join('/')}`.slice(0, 120);
  } catch {
    return url;
  }
}

/**
 * Slack exports use epoch seconds; a hand-written inbox file is easier to read
 * as a date. Accept both so real chronology survives either way — without it
 * every imported link claims to have arrived at import time, which makes
 * "recently added" meaningless.
 */
function tsToIso(ts) {
  if (ts === undefined || ts === null || ts === '') return null;
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString();
  const d = new Date(String(ts));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fromInbox() {
  let raw;
  try {
    raw = readFileSync(INBOX, 'utf8');
  } catch {
    console.error(`no ${INBOX}.`);
    console.error('Write it as [{url, context, channel, ts}] — anything can produce it,');
    console.error('including a Claude session using the Slack MCP server. See SPEC.md 3.');
    process.exit(1);
  }
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) {
    console.error(`${INBOX} must be a JSON array`);
    process.exit(1);
  }
  return rows;
}

function fromExport(dir) {
  const rows = [];
  const walk = (p) => {
    for (const name of readdirSync(p)) {
      const full = join(p, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      let messages;
      try {
        messages = JSON.parse(readFileSync(full, 'utf8'));
      } catch {
        continue;
      }
      if (!Array.isArray(messages)) continue; // users.json, channels.json etc.
      const channel = p.split('/').filter(Boolean).pop();
      for (const m of messages) {
        const texts = [m.text, ...(m.attachments || []).flatMap((a) => [a.title_link, a.from_url, a.text])];
        for (const url of urlsFromText(texts.filter(Boolean).join(' '))) {
          rows.push({ url, channel: `#${channel}`, ts: m.ts, context: '' });
        }
      }
    }
  };
  walk(dir);
  return rows;
}

const main = () => {
  const taxonomy = loadTaxonomy();
  const maxGroups = taxonomy.limits?.maxGroups ?? 3;
  const maxTags = taxonomy.limits?.maxTags ?? 8;

  const file = argOf('--file');
  const rows = file ? fromExport(file) : fromInbox();

  const at = new Date().toISOString();
  const rejected = [];
  const seen = new Map();

  for (const row of rows) {
    const url = String(row?.url || '').trim();
    if (!url) continue;
    const why = rejectReason(url);
    if (why) {
      rejected.push({ url, why });
      continue;
    }
    const canon = canonicalUrl(url);
    // Keep the earliest sighting: that is when it entered the collection.
    const prev = seen.get(canon);
    if (!prev || (row.ts && prev.ts && Number(row.ts) < Number(prev.ts))) {
      seen.set(canon, { ...row, url: canon });
    }
  }

  const incoming = [...seen.values()].map((row) => {
    const kind = kindFor(row.url);
    const title = titleFor(row.url, kind);
    const { groups } = classify({ topics: [], language: '', description: '', title, maxGroups });
    return newRecord({
      url: row.url,
      kind,
      title,
      description: '',
      groups,
      // Message text is deliberately not imported; the only tag is the origin.
      tags: tagsFromTopics(['src:slack'], '', maxTags),
      meta: { siteName: new URL(row.url).hostname.replace(/^www\./, '') },
      source: {
        type: 'slack',
        ref: row.channel || 'self-DM',
        at: tsToIso(row.ts) || at,
      },
    });
  });

  // A link saved in 2021 entered the collection in 2021. newRecord() stamps
  // "now", so correct it from the source timestamp where we have one.
  for (const rec of incoming) {
    const srcAt = rec.sources?.[0]?.at;
    if (srcAt) rec.addedAt = srcAt;
  }

  console.log(`${rows.length} links read from ${file ? file : INBOX}`);
  console.log(`  ${incoming.length} distinct publishable URLs`);
  if (rejected.length) {
    const byWhy = {};
    for (const r of rejected) byWhy[r.why] = (byWhy[r.why] || 0) + 1;
    console.log(`  ${rejected.length} refused as unpublishable:`);
    for (const [why, n] of Object.entries(byWhy)) console.log(`      ${n}  ${why}`);
    console.log('    (add one deliberately with `make add URL=…` if a refusal is wrong)');
  }

  if (flag('--dry-run')) {
    console.log('\ndry run — nothing written');
    const kinds = {};
    for (const r of incoming) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    console.log('kinds:', kinds);
    return;
  }

  const store = loadStore();
  const { records, added, merged } = upsertAll(store, incoming);
  saveStore(records);

  console.log(`\n  ${added} new, ${merged} already present (sources unioned)`);
  console.log(`  store now ${records.length} records`);
  const undescribed = records.filter((r) => !r.description).length;
  console.log(`  ${undescribed} without a description — next: make enrich`);
};

// Only run when invoked directly. This file exports urlsFromText/kindFor for
// tests, and importing it must never perform an import — that would mutate the
// store from a test run, and race any other writer.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
