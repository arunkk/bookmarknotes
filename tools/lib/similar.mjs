/**
 * Similarity helpers for near-duplicate detection (SPEC.md 3.2).
 *
 * Deliberately boring: token overlap, no embeddings, no model call. The output
 * is a candidate list a human reads, so a score only has to be good enough to
 * rank pairs worth looking at.
 */

// Words that say nothing about which project this is. Without this list every
// pair of repos sharing "the open source library for python" scores as related.
const STOP = new Set([
  'a', 'an', 'and', 'the', 'for', 'of', 'to', 'in', 'on', 'with', 'from', 'by', 'or', 'as',
  'at', 'is', 'are', 'be', 'it', 'its', 'that', 'this', 'you', 'your', 'we', 'our',
  'library', 'framework', 'tool', 'tools', 'toolkit', 'project', 'repo', 'repository',
  'open', 'source', 'opensource', 'free', 'simple', 'easy', 'fast', 'modern', 'official',
  'implementation', 'based', 'using', 'used', 'use', 'built', 'build', 'support',
  'awesome', 'list', 'curated', 'collection', 'resources',
]);

export const normalizeName = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Crude suffix stripping so "animation" and "animations" count as one token.
 * Not a real stemmer: it will not join "math" and "mathematical", which is a
 * known limit of comparing words instead of meanings — see the note in
 * dedupe.mjs about paraphrases this cannot see.
 */
const stem = (w) =>
  w.length > 4 ? w.replace(/(?:ies|ing|ers|er|es|s)$/, (m) => (m === 'ies' ? 'y' : '')) : w;

export function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  );
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const x of a) if (b.has(x)) hits++;
  return hits / (a.size + b.size - hits);
}

/** The repo (or file) name at the end of a URL path. */
export const basename = (url) => {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
};

/** owner/repo for a GitHub URL, or null. */
export function githubRepo(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const p = u.pathname.split('/').filter(Boolean);
    return p.length >= 2 ? `${p[0]}/${p[1]}` : null;
  } catch {
    return null;
  }
}

export function arxivId(url) {
  const m = String(url).match(/arxiv\.org\/abs\/(.+)$/);
  return m ? m[1] : null;
}

/**
 * How much two records look like the same subject, from their words and tags.
 * Title carries more weight than description: a shared description phrase is
 * often boilerplate, a shared distinctive title rarely is.
 */
export function contentSimilarity(a, b) {
  const titleScore = jaccard(tokens(a.title), tokens(b.title));
  const descScore = jaccard(tokens(a.description), tokens(b.description));
  const tagScore = jaccard(new Set(a.tags || []), new Set(b.tags || []));
  return 0.45 * titleScore + 0.3 * descScore + 0.25 * tagScore;
}
