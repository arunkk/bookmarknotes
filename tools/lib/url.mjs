import { createHash } from 'node:crypto';

// Params that identify nothing about the resource itself.
const TRACKING = new Set([
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
  'ref', 'ref_src', 'ref_url', 'referrer', 'source',
  'si', 'feature', 'app', 'ab_channel',
]);

const isTracking = (k) => TRACKING.has(k) || k.startsWith('utm_');

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);

/**
 * Reduce a URL to the thing it actually names, so that two spellings of one
 * resource produce one id. This is the ONLY place URL identity is decided —
 * every importer routes through it (SPEC.md §3.1). Adding normalization
 * anywhere else reintroduces the duplicates this exists to prevent.
 *
 * Non-http(s) input (a local file path, a mailto:) is returned trimmed and
 * unchanged: there is nothing to canonicalize and guessing would corrupt it.
 */
export function canonicalUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('canonicalUrl: empty input');

  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw; // not a URL (e.g. a local filesystem path)
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw;

  u.protocol = 'https:';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.username = u.password = '';
  u.port = '';

  const host = u.hostname;

  // --- per-host identity rules -------------------------------------------
  if (YOUTUBE_HOSTS.has(host)) {
    const videoId =
      host === 'youtu.be'
        ? u.pathname.slice(1).split('/')[0]
        : u.searchParams.get('v') ||
          (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/) || [])[1];
    const listId = u.searchParams.get('list');

    // A playlist URL with no video is the playlist; otherwise the video wins,
    // so the same video reached from inside a playlist is not a new bookmark.
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    if (listId) return `https://www.youtube.com/playlist?list=${listId}`;
  }

  if (host === 'github.com') {
    const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      // GitHub treats owner and repo case-insensitively and redirects, so
      // Owner/Repo and owner/repo are one repo and must share one id. Paths
      // below the repo are real filenames and stay case-sensitive.
      const owner = parts[0].toLowerCase();
      const repo = parts[1].toLowerCase();
      const rest = parts.slice(2);
      // A repo root, /tree/<default-ish branch>, and a trailing .git are one thing.
      const isRepoRoot =
        rest.length === 0 ||
        (rest[0] === 'tree' && rest.length === 2) ||
        (rest.length === 1 && rest[0] === '');
      if (isRepoRoot) return `https://github.com/${owner}/${repo}`;
      return `https://github.com/${owner}/${repo}/${rest.join('/')}`;
    }
  }

  if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') {
    // A tweet is named by owner/status/id. Everything else on these URLs is
    // share provenance: ?s=12, ?s=46, ?t=..., which would otherwise mint a new
    // id for every place the same tweet was copied from.
    const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (m) return `https://x.com/${m[1]}/status/${m[2]}`;
  }

  if (host === 'arxiv.org') {
    // abs/, pdf/, and versioned forms all name one paper.
    const m = u.pathname.match(/\/(?:abs|pdf)\/(.+?)(?:v\d+)?(?:\.pdf)?$/);
    if (m) return `https://arxiv.org/abs/${m[1]}`;
  }

  if (host === 'docs.google.com' || host === 'drive.google.com') {
    const m = u.pathname.match(/\/(document|spreadsheets|presentation|file)\/d\/([^/]+)/);
    if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}`;
  }

  // --- generic rules ------------------------------------------------------
  for (const k of [...u.searchParams.keys()]) {
    if (isTracking(k)) u.searchParams.delete(k);
  }
  u.searchParams.sort(); // param order must not create a second id

  // A fragment is decoration unless it carries an SPA route.
  if (!u.hash.startsWith('#/')) u.hash = '';

  u.pathname = u.pathname.replace(/\/index\.html?$/, '/');
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');

  let out = u.toString();
  if (!u.search && !u.hash) out = out.replace(/\/$/, '');
  return out;
}

/** Stable id derived from the canonical URL, so re-imports cannot duplicate. */
export function makeId(url) {
  return 'b_' + createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 8);
}
