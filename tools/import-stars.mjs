#!/usr/bin/env node
/**
 * Import starred GitHub repos (SPEC.md 3).
 *
 * Uses the authenticated `gh` CLI rather than a token of our own, so there is
 * no secret to manage. Idempotent: re-running merges by canonical URL and
 * cannot duplicate or clobber (see mergeRecord).
 */
import { execFileSync } from 'node:child_process';
import { loadStore, saveStore, newRecord, upsertAll, loadTaxonomy } from './lib/store.mjs';
import { classify, tagsFromTopics } from './lib/classify.mjs';
import { cleanText } from './lib/text.mjs';

const fetchStars = () => {
  const out = execFileSync(
    'gh',
    ['api', 'user/starred', '--paginate', '--jq',
     '.[] | {full_name, html_url, description, topics, language, stargazers_count, pushed_at, owner: .owner.login}'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
};

const main = () => {
  const taxonomy = loadTaxonomy();
  const maxGroups = taxonomy.limits?.maxGroups ?? 3;
  const maxTags = taxonomy.limits?.maxTags ?? 8;

  const repos = fetchStars();
  const at = new Date().toISOString();

  const incoming = repos.map((r) => {
    const { groups } = classify({
      topics: r.topics,
      language: r.language,
      description: cleanText(r.description),
      title: r.full_name,
      maxGroups,
    });
    return newRecord({
      url: r.html_url,
      kind: 'repo',
      title: r.full_name,
      description: cleanText(r.description),
      groups,
      tags: tagsFromTopics(r.topics, r.language, maxTags),
      meta: {
        siteName: 'GitHub',
        author: r.owner || r.full_name.split('/')[0],
        published: r.pushed_at || '',
        durationSec: null,
        language: r.language || '',
        stars: r.stargazers_count ?? null,
      },
      source: { type: 'github-stars', ref: 'arunkk', at },
    });
  });

  // Records that came in with a usable description and a group needed no LLM:
  // mark them so `enrich` knows not to spend a call, and so the provenance is
  // honest. An over-length repo blurb is deliberately NOT marked done: it goes
  // to the LLM to be rewritten, because truncating mid-word ("a pure-python PDF
  // library capable of splitting, merging, cro") is worse than no description.
  const maxDesc = taxonomy.limits?.maxDescriptionChars ?? 160;
  for (const rec of incoming) {
    const usable = rec.description && rec.description.length <= maxDesc;
    if (usable && rec.groups.length) rec.enriched = { at, by: 'scrape' };
  }

  const store = loadStore();
  const { records, added, merged } = upsertAll(store, incoming);
  saveStore(records);

  const ungrouped = records.filter((r) => !r.groups.length).length;
  const undescribed = records.filter((r) => !r.description).length;
  console.log(`fetched ${repos.length} starred repos`);
  console.log(`  ${added} new, ${merged} already present (sources unioned)`);
  console.log(`  store now ${records.length} records`);
  console.log(`  ${ungrouped} ungrouped (${((100 * ungrouped) / records.length).toFixed(1)}%), ${undescribed} without a description`);
  if (ungrouped || undescribed) console.log('  next: make enrich');
};

main();
