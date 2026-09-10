/**
 * GitHub renders `:fireworks:` as an emoji; a plain JSON store does not, so an
 * imported blurb like ":fireworks:Interactive platform that..." shows the raw
 * shortcode on the site. Strip them rather than shipping a lookup table of
 * every GitHub emoji name — the words around them carry the meaning, and a
 * missing decoration costs nothing.
 *
 * Literal emoji characters are left alone: those render fine.
 */
const SHORTCODE = /:[a-z0-9][a-z0-9_+-]{1,30}:/g;

export function cleanText(input) {
  return String(input ?? '')
    .replace(SHORTCODE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s–—-]+/, '')
    .trim();
}
