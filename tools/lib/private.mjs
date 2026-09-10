/**
 * Refuse URLs that must not land in a public repository.
 *
 * This exists because the Slack source is a personal scratchpad, not a curated
 * feed: alongside links it holds internal hostnames, private documents, and
 * one-off session URLs. The repo is public (PRODUCT.md, Binding constraints),
 * so "I was careful while transcribing" is not a control. This is.
 *
 * The rule is deny-by-pattern, and every rejection is reported with its reason
 * so a false positive is visible and can be overridden deliberately with
 * `make add URL=…` rather than by loosening the filter.
 */

// RFC1918, loopback, link-local, and CGNAT.
const PRIVATE_IP =
  /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

const RULES = [
  {
    why: 'private or loopback address',
    test: (u) => u.hostname === 'localhost' || PRIVATE_IP.test(u.hostname),
  },
  {
    why: 'internal company host',
    // Covers jenkins/ingest-test/dev-* boxes under the corporate domain. The
    // public github.com/percipient-ai/... org is a different host and is not
    // caught here.
    test: (u) => u.hostname === 'percipient.ai' || u.hostname.endsWith('.percipient.ai'),
  },
  {
    why: 'internal cloud hostname',
    test: (u) => /\.(?:compute|elb)\.amazonaws\.com$/.test(u.hostname),
  },
  {
    why: 'private assistant session',
    test: (u) =>
      (u.hostname === 'claude.ai' && u.pathname.startsWith('/code/session')) ||
      (u.hostname === 'chatgpt.com' && u.pathname.startsWith('/share/')),
  },
  {
    why: 'private document',
    test: (u) => u.hostname === 'docs.google.com' || u.hostname === 'drive.google.com',
  },
  {
    why: 'credential in the URL',
    test: (u) => /(?:api[-_]?key|access[-_]?token|secret|password|passwd|auth)=/i.test(u.search),
  },
];

/** Returns null when the URL is publishable, or a reason string when it is not. */
export function rejectReason(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return 'not a URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return `unsupported scheme ${u.protocol}`;
  for (const rule of RULES) {
    if (rule.test(u)) return rule.why;
  }
  return null;
}
