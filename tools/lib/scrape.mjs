/**
 * Fetch what a page says about itself (SPEC.md 4, step 1).
 *
 * This is the difference between a description and a guess. Without it the
 * model receives only a URL and must either invent a summary or return
 * nothing; with it, the summary is a rewrite of the page's own words.
 *
 * Deliberately shallow: one GET, a short timeout, regex over the head. No
 * dependency, no headless browser, no JS execution. Pages that need a browser
 * to say what they are will come back thin, and that is reported rather than
 * papered over.
 */

const TIMEOUT_MS = 10000;
const MAX_BYTES = 96 * 1024; // meta tags live in the head; do not read a whole page
const UA =
  'Mozilla/5.0 (compatible; BookmarkNotes/1.0; +https://github.com/arunkk/bookmarknotes)';

const decodeEntities = (s) =>
  String(s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const v = decodeEntities(m[1]);
      if (v) return v;
    }
  }
  return '';
}

const attr = (name, key = 'property') => [
  new RegExp(`<meta[^>]+${key}=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
  new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${key}=["']${name}["']`, 'i'),
];

async function fetchText(url, { headers = {} } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const reader = res.body?.getReader();
    if (!reader) return { text: await res.text() };
    // Stop once the head is certainly past, so a huge page costs little.
    let received = 0;
    const chunks = [];
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    reader.cancel().catch(() => {});
    return { text: new TextDecoder('utf-8', { fatal: false }).decode(concat(chunks)) };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** YouTube publishes title and author without an API key. */
async function scrapeYouTube(url) {
  const { text, error } = await fetchText(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  );
  if (error) return { error };
  try {
    const j = JSON.parse(text);
    return { title: j.title || '', author: j.author_name || '', siteName: 'YouTube' };
  } catch {
    return { error: 'bad oembed response' };
  }
}

/** arXiv's abstract page carries the real title and summary in meta tags. */
async function scrapeGeneric(url) {
  const { text, error } = await fetchText(url, { Accept: 'text/html,*/*' });
  if (error) return { error };
  const html = text || '';
  return {
    title:
      metaContent(html, [...attr('og:title'), ...attr('twitter:title', 'name')]) ||
      decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''),
    description: metaContent(html, [
      ...attr('og:description'),
      ...attr('description', 'name'),
      ...attr('twitter:description', 'name'),
      ...attr('citation_abstract', 'name'),
    ]),
    siteName: metaContent(html, attr('og:site_name')),
    author: metaContent(html, [...attr('author', 'name'), ...attr('citation_author', 'name')]),
    published: metaContent(html, [
      ...attr('article:published_time'),
      ...attr('citation_date', 'name'),
    ]),
  };
}

/**
 * Returns { title, description, siteName, author, published } — any of which
 * may be empty — or { error } when the page could not be read. An error is a
 * result, not an exception: 275 URLs will include dead links, and one 404 must
 * not stop an enrichment run.
 */
export async function scrape(url, kind) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
      const r = await scrapeYouTube(url);
      if (!r.error) return r;
    }
    if (kind === 'pdf' && host !== 'arxiv.org') {
      // A PDF has no meta tags; its filename is all the address offers.
      return { title: '', description: '', siteName: host };
    }
    return await scrapeGeneric(url);
  } catch (e) {
    return { error: e.message };
  }
}

/** Scrape many URLs with a small concurrency cap, in input order. */
export async function scrapeAll(items, { concurrency = 8, onProgress } = {}) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await scrape(items[i].url, items[i].kind);
      done++;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
