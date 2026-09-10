#!/usr/bin/env node
/**
 * Enrich records that lack a description or groups (SPEC.md 4).
 *
 * The prompt is the body of .claude/skills/enrich-bookmarks/SKILL.md, so the
 * automated path and an interactive fix-up share one contract. Tools are
 * disabled: with none available the model can only transform the facts handed
 * to it, which is the whole reason this is safe to run unattended over
 * hundreds of records.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadStore, saveStore, loadTaxonomy } from './lib/store.mjs';
import { scrapeAll } from './lib/scrape.mjs';

const SKILL = '.claude/skills/enrich-bookmarks/SKILL.md';
const BATCH = 20;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const argOf = (n) => {
  const i = args.indexOf(n);
  return i === -1 ? null : args[i + 1];
};

const skillBody = () => readFileSync(SKILL, 'utf8').replace(/^---[\s\S]*?\n---\n/, '').trim();

const needsWork = (r, maxDesc) =>
  (!r.description || !r.groups?.length || r.description.length > maxDesc) &&
  r.enriched?.by !== 'human';

function callClaude(prompt) {
  const raw = execFileSync(
    'claude',
    ['-p', '--output-format', 'json', '--allowed-tools', ''],
    { input: prompt, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300000 },
  );
  const env = JSON.parse(raw);
  const text = typeof env === 'string' ? env : env.result ?? '';
  // The model is told to return a bare array; tolerate a stray fence rather
  // than discarding a good batch over formatting.
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error(`no JSON array in model output: ${text.slice(0, 200)}`);
  return JSON.parse(m[0]);
}

function validate(item, byId, taxonomy) {
  const rec = byId.get(item.id);
  if (!rec) return { ok: false, why: 'unknown id' };

  const allowed = new Set(taxonomy.groups);
  const { maxGroups = 3, maxTags = 8, maxDescriptionChars = 160 } = taxonomy.limits || {};

  const groups = (item.groups || []).filter((g) => allowed.has(g)).slice(0, maxGroups);
  const rejected = (item.groups || []).filter((g) => !allowed.has(g));
  const desc = String(item.description ?? '').trim();

  if (desc.length > maxDescriptionChars) {
    return { ok: false, why: `description ${desc.length} chars > ${maxDescriptionChars}` };
  }
  return {
    ok: true,
    rejected,
    patch: {
      description: desc || rec.description,
      groups: groups.length ? groups : rec.groups,
      tags: [...new Set([...(rec.tags || []), ...(item.tags || [])])].slice(0, maxTags),
    },
  };
}

const main = async () => {
  const taxonomy = loadTaxonomy();
  const store = loadStore();
  const byId = new Map(store.map((r) => [r.id, r]));

  const maxDesc = taxonomy.limits?.maxDescriptionChars ?? 160;
  let targets = flag('--all')
    ? store.filter((r) => r.enriched?.by !== 'human')
    : store.filter((r) => needsWork(r, maxDesc));
  const onlyId = argOf('--id');
  if (onlyId) targets = store.filter((r) => r.id === onlyId);
  if (flag('--force') && !onlyId && !flag('--all')) targets = store;

  const limit = Number(argOf('--limit') || 0);
  if (limit > 0) targets = targets.slice(0, limit);

  if (!targets.length) {
    console.log('nothing to enrich');
    return;
  }

  const contract = skillBody();

  // Step 1 of SPEC.md 4: ask each page what it is, before asking the model to
  // summarise it. Without this the model gets a URL and must invent.
  process.stdout.write(`scraping ${targets.length} pages`);
  const scraped = await scrapeAll(
    targets.map((r) => ({ url: r.url, kind: r.kind })),
    {
      onProgress: (done, total) => {
        if (done % 25 === 0 || done === total) process.stdout.write(`\r  scraped ${done}/${total}   `);
      },
    },
  );
  const scrapeFailed = scraped.filter((x) => x.error).length;
  console.log(
    `\n  ${targets.length - scrapeFailed} pages answered, ${scrapeFailed} did not (dead links, timeouts, bot walls)`,
  );

  // A URL-derived title ("github.com/foo/bar") is a placeholder from the Slack
  // importer. A real page title beats it — except for repos, where owner/repo
  // is already the clearest name.
  const scrapedById = new Map(targets.map((r, i) => [r.id, scraped[i]]));
  let retitled = 0;
  for (const r of targets) {
    const sc = scrapedById.get(r.id) || {};
    const host = (() => {
      try {
        return new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    })();
    const placeholder = host && (r.title === host || r.title.startsWith(`${host}/`) || r.title === `${host} video`);
    if (placeholder && r.kind !== 'repo' && sc.title) {
      r.title = sc.title.slice(0, 120);
      retitled++;
    }
  }
  if (retitled) console.log(`  ${retitled} placeholder titles replaced with the page's own title`);

  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  console.log(`enriching ${targets.length} records in ${batches.length} batches of <=${BATCH}`);

  let okCount = 0;
  let failed = 0;
  const problems = [];

  batches.forEach((batch, n) => {
    const input = batch.map((r) => ({
      id: r.id,
      url: r.url,
      kind: r.kind,
      scraped: {
        title: scrapedById.get(r.id)?.title || r.title,
        ogDescription: scrapedById.get(r.id)?.description || r.description,
        siteName: scrapedById.get(r.id)?.siteName || r.meta?.siteName || '',
        author: scrapedById.get(r.id)?.author || '',
        metaDescription: '',
        topics: r.tags || [],
        language: r.meta?.language || '',
        fetchError: scrapedById.get(r.id)?.error || '',
      },
      context: (r.sources || []).map((s) => `${s.type} ${s.ref ?? ''}`).join(', '),
    }));

    const prompt = [
      contract,
      '',
      '## Allowed groups (use these names verbatim, or an empty array)',
      JSON.stringify(taxonomy.groups),
      '',
      '## Limits',
      JSON.stringify(taxonomy.limits),
      '',
      '## Input',
      JSON.stringify(input, null, 1),
      '',
      'Return only the JSON array described in the Output section.',
    ].join('\n');

    let items;
    try {
      items = callClaude(prompt);
    } catch (e) {
      failed += batch.length;
      problems.push(`batch ${n + 1}: ${e.message.split('\n')[0]}`);
      console.log(`  batch ${n + 1}/${batches.length}: FAILED (${batch.length} records left as-is)`);
      return;
    }

    const at = new Date().toISOString();
    let applied = 0;
    for (const item of items) {
      const v = validate(item, byId, taxonomy);
      if (!v.ok) {
        problems.push(`${item.id}: ${v.why}`);
        continue;
      }
      if (v.rejected.length) problems.push(`${item.id}: invented groups ${v.rejected.join(', ')}`);
      const rec = byId.get(item.id);
      Object.assign(rec, v.patch, { enriched: { at, by: 'claude' }, updatedAt: at });
      applied++;
      okCount++;
    }
    // Save after every batch: a crash or a rate limit must not discard work
    // already paid for.
    saveStore([...byId.values()]);
    console.log(`  batch ${n + 1}/${batches.length}: ${applied}/${batch.length} applied`);
  });

  const records = [...byId.values()];
  const ungrouped = records.filter((r) => !r.groups.length).length;
  const undescribed = records.filter((r) => !r.description).length;
  console.log(`\nenriched ${okCount}, failed ${failed}`);
  console.log(`store: ${records.length} records, ${ungrouped} ungrouped (${((100 * ungrouped) / records.length).toFixed(1)}%), ${undescribed} without a description`);
  if (problems.length) {
    console.log(`\n${problems.length} problems (loudly, per SPEC.md 4 step 3):`);
    for (const p of problems.slice(0, 25)) console.log(`  - ${p}`);
    if (problems.length > 25) console.log(`  ... and ${problems.length - 25} more`);
  }
};

await main();
