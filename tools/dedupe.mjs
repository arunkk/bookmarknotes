#!/usr/bin/env node
/**
 * Find near-duplicates and closely related records (SPEC.md 3.2).
 *
 * Exact duplicates cannot reach this tool: identical canonical URLs collapse at
 * import. What is left needs judgment, so this reports and never acts on its
 * own. Two buckets, because conflating them loses data:
 *
 *   MERGE     structurally the same resource reached by a different address —
 *             an arXiv abstract and its PDF, a repo root and a deep link into
 *             it. Merging is right and lossless.
 *   RELATED   different resources about the same subject — a project and its
 *             community fork, two competing awesome-lists. Merging these would
 *             destroy one; they get a `related` link instead.
 *
 * Same name is not the same thing: four unrelated repos in this collection are
 * called "skills". So a name collision never proposes a merge — only a look.
 * Collisions are reported as clusters rather than pairs, both because four
 * repos sharing a name would otherwise produce six near-identical entries, and
 * because the cluster itself is the tell: two repos sharing a name is
 * interesting, four means the name is generic.
 *
 * Usage:
 *   node tools/dedupe.mjs [--deep] [--json] [--min <score>] [--deep-min <score>]
 *   node tools/dedupe.mjs --merge <keep-id> <drop-id>
 *   node tools/dedupe.mjs --relate <id> <id>
 */
import { loadStore, saveStore, mergePair, relatePair } from './lib/store.mjs';
import { arxivId, githubRepo, contentSimilarity, projectName } from './lib/similar.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const after = (n, count = 1) => {
  const i = args.indexOf(n);
  return i === -1 ? [] : args.slice(i + 1, i + 1 + count);
};

// Above this, shared wording corroborates the shared name. Below it the name
// may be the only thing the two have in common — still worth a look, since
// word overlap cannot see that "explanatory math videos" and "programmatic
// mathematical animations" are the same subject.
const RELATED_MIN = Number(after('--min')[0] || 0.28);
// Chosen from the corpus, not taste: on 542 records only 14 pairs score above
// 0.30 and all of them are genuinely related (a repo and its own frontend, a
// project and its fork, a CLI and an awesome-list for the same database). At
// 0.55 the sweep returned nothing, which is a threshold set above what word
// overlap ever reaches for paraphrased descriptions.
const DEEP_MIN = Number(after('--deep-min')[0] || 0.3);

const short = (r) => `${r.id}  ${r.title}`;

/* ---------------- actions ---------------- */

function exit(msg) {
  console.error(msg);
  process.exit(1);
}

function doMerge(keepId, dropId) {
  if (!keepId || !dropId) exit('usage: --merge <keep-id> <drop-id>');
  if (keepId === dropId) exit('refusing to merge a record into itself');

  const store = loadStore();
  const keep = store.find((r) => r.id === keepId);
  const drop = store.find((r) => r.id === dropId);
  if (!keep) exit(`no record ${keepId}`);
  if (!drop) exit(`no record ${dropId}`);

  const merged = mergePair(keep, drop);
  // Any record pointing at the dropped id must now point at the survivor,
  // otherwise validate fails on an unresolvable related id.
  const rest = store
    .filter((r) => r.id !== keepId && r.id !== dropId)
    .map((r) =>
      (r.related || []).includes(dropId)
        ? {
            ...r,
            related: [...new Set(r.related.map((id) => (id === dropId ? keepId : id)))].filter(
              (id) => id !== r.id,
            ),
          }
        : r,
    );

  saveStore([...rest, merged]);
  console.log(`merged ${dropId} into ${keepId}`);
  console.log(`  kept    ${keep.url}`);
  console.log(`  folded  ${drop.url}  (recorded in mergedFrom)`);
  console.log(`  groups  ${merged.groups.join(', ') || '(none)'}`);
  console.log(`  tags    ${merged.tags.length}`);
  console.log(`  starred ${merged.starred}`);
  console.log(`  notes   ${merged.notes ? `${merged.notes.length} chars kept` : '(none)'}`);
  console.log(`store now ${rest.length + 1} records — run: make check`);
}

function doRelate(idA, idB) {
  if (!idA || !idB) exit('usage: --relate <id> <id>');
  if (idA === idB) exit('refusing to relate a record to itself');
  const store = loadStore();
  const a = store.find((r) => r.id === idA);
  const b = store.find((r) => r.id === idB);
  if (!a) exit(`no record ${idA}`);
  if (!b) exit(`no record ${idB}`);
  relatePair(a, b);
  saveStore(store);
  console.log(`related ${idA} <-> ${idB}`);
  console.log(`  ${a.title}`);
  console.log(`  ${b.title}`);
}

/* ---------------- detection ---------------- */

function* pairs(list) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) yield [list[i], list[j]];
  }
}

const maxScore = (members) => {
  let best = 0;
  for (const [a, b] of pairs(members)) best = Math.max(best, contentSimilarity(a, b));
  return best;
};

function findCandidates(store, { deep }) {
  const merge = [];
  const clusters = [];
  const deepPairs = [];
  const seen = new Set();
  const key = (a, b) => [a.id, b.id].sort().join('|');

  const pushMerge = (a, b, why) => {
    const k = key(a, b);
    if (seen.has(k)) return;
    seen.add(k);
    merge.push({ a, b, why });
  };

  // --- structural: the same arXiv paper under two addresses -------------
  const byArxiv = new Map();
  for (const r of store) {
    const id = arxivId(r.url);
    if (id) byArxiv.set(id, [...(byArxiv.get(id) || []), r]);
  }
  for (const [id, group] of byArxiv) {
    for (const [a, b] of pairs(group)) pushMerge(a, b, `same arXiv id ${id}`);
  }

  // --- structural: a link to a repo's own front page ---------------------
  // Only a README or a bare branch view IS the repo. A link to one example
  // file, a notebook, or a pull request is a pointer to that specific thing —
  // merging it into the root would bury exactly what was worth saving. Those
  // are surfaced as related instead.
  const repoRoots = new Map();
  for (const r of store) {
    const repo = githubRepo(r.url);
    if (repo && r.url === `https://github.com/${repo}`) repoRoots.set(repo, r);
  }
  const deepIntoSavedRepo = [];
  for (const r of store) {
    const repo = githubRepo(r.url);
    if (!repo || r.url === `https://github.com/${repo}`) continue;
    const root = repoRoots.get(repo);
    if (!root) continue;
    const rest = r.url.slice(`https://github.com/${repo}/`.length);
    const isFrontPage = /^(?:blob\/[^/]+\/readme(?:\.[a-z]+)?|tree\/[^/]+)$/i.test(rest);
    if (isFrontPage) {
      pushMerge(root, r, `${repo} front page, and the repo is already saved`);
    } else {
      deepIntoSavedRepo.push({ repo, root, deep: r, rest });
    }
  }

  // --- relational: name collisions, as clusters ------------------------
  const byName = new Map();
  for (const r of store) {
    const n = projectName(r.url);
    if (n) byName.set(n, [...(byName.get(n) || []), r]);
  }
  for (const [name, members] of byName) {
    if (members.length < 2) continue;
    // Two records under one owner are the same project by different paths;
    // that is a merge question, already handled structurally above.
    const owners = new Set(members.map((r) => githubRepo(r.url)?.split('/')[0]));
    if (owners.size < 2) continue;
    clusters.push({ name, members, score: maxScore(members) });
  }

  // --- relational: a full sweep, only when asked -----------------------
  if (deep) {
    for (const [a, b] of pairs(store)) {
      const k = key(a, b);
      if (seen.has(k)) continue;
      const score = contentSimilarity(a, b);
      if (score >= DEEP_MIN) {
        seen.add(k);
        deepPairs.push({ a, b, score });
      }
    }
  }

  return {
    merge,
    clusters: clusters.sort((x, y) => y.score - x.score),
    deepPairs: deepPairs.sort((x, y) => y.score - x.score),
    deepIntoSavedRepo,
  };
}

/* ---------------- report ---------------- */

function report(store, { merge, clusters, deepPairs, deepIntoSavedRepo }, deep) {
  if (flag('--json')) {
    const rec = (r) => ({ id: r.id, title: r.title, url: r.url });
    console.log(
      JSON.stringify(
        {
          scanned: store.length,
          merge: merge.map(({ a, b, why }) => ({ why, keep: rec(a), drop: rec(b) })),
          nameClusters: clusters.map(({ name, members, score }) => ({
            name,
            maxSimilarity: Number(score.toFixed(3)),
            corroborated: score >= RELATED_MIN,
            members: members.map(rec),
          })),
          similarPairs: deepPairs.map(({ a, b, score }) => ({
            score: Number(score.toFixed(3)),
            a: rec(a),
            b: rec(b),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`${store.length} records scanned${deep ? ' (deep sweep)' : ''}\n`);

  console.log(`Same resource, two addresses — safe to merge: ${merge.length}`);
  if (!merge.length) {
    console.log('  None. Every record names a distinct resource.');
  } else {
    for (const { a, b, why } of merge) {
      console.log(`\n  ${why}`);
      console.log(`    keep  ${short(a)}`);
      console.log(`    drop  ${short(b)}`);
      console.log(`    node tools/dedupe.mjs --merge ${a.id} ${b.id}`);
    }
  }

  console.log(
    `\nA specific file or PR inside a repo you already have: ${deepIntoSavedRepo.length}`,
  );
  if (!deepIntoSavedRepo.length) {
    console.log('  None.');
  } else {
    console.log('  Keep both: the deep link is the part that was worth saving.\n');
    for (const { repo, root, deep: d, rest } of deepIntoSavedRepo) {
      console.log(`  ${repo} -> ${rest}`);
      console.log(`      ${short(root)}`);
      console.log(`      ${short(d)}`);
      console.log(`    node tools/dedupe.mjs --relate ${root.id} ${d.id}`);
    }
  }

  console.log(`\nSame name, different owners — look, do not merge: ${clusters.length}`);
  if (!clusters.length) {
    console.log('  None.');
  } else {
    for (const { name, members, score } of clusters) {
      const verdict =
        members.length > 2 && score < RELATED_MIN
          ? `${members.length} repos share it, so the name is probably just generic`
          : score >= RELATED_MIN
            ? 'wording overlaps too, so these are likely the same project or a fork'
            : 'only the name matches, but wording cannot see paraphrases — worth a glance';
      console.log(`\n  "${name}" — ${verdict} (max similarity ${score.toFixed(2)})`);
      for (const m of members) console.log(`      ${short(m)}`);
      if (members.length === 2) {
        console.log(`    node tools/dedupe.mjs --relate ${members[0].id} ${members[1].id}`);
      } else {
        console.log('    node tools/dedupe.mjs --relate <id> <id>   (for any pair worth linking)');
      }
    }
  }

  if (deep) {
    console.log(`\nSimilar wording anywhere in the collection: ${deepPairs.length}`);
    if (!deepPairs.length) {
      console.log(`  None scoring ${DEEP_MIN} or above.`);
    } else {
      for (const { a, b, score } of deepPairs) {
        console.log(`\n  ${score.toFixed(2)}`);
        console.log(`      ${short(a)}`);
        console.log(`      ${short(b)}`);
        console.log(`    node tools/dedupe.mjs --relate ${a.id} ${b.id}`);
      }
    }
  }

  const linked = store.filter((r) => (r.related || []).length).length;
  const merged = store.filter((r) => (r.mergedFrom || []).length).length;
  console.log(`\n${linked} records already have related links; ${merged} were merged previously.`);
  console.log('This report changes nothing.');
  if (!deep) console.log('--deep also compares every pair by wording, not just name collisions.');
}

/* ---------------- main ---------------- */

if (flag('--merge')) {
  const [keepId, dropId] = after('--merge', 2);
  doMerge(keepId, dropId);
} else if (flag('--relate')) {
  const [idA, idB] = after('--relate', 2);
  doRelate(idA, idB);
} else {
  const store = loadStore();
  const deep = flag('--deep');
  report(store, findCandidates(store, { deep }), deep);
}
