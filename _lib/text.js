// A post's own words as plain text, for the places that need a line of it:
// an untitled note's title (the tab, a share card, the feed), a post's
// description when it gives none, and the home list's row for a note.
// Before these existed, an untitled note shared as the blog's name and a
// post without a description previewed as the blog's tagline (views
// critique, 2026-10-08).
//
// Pure, so it can be tested without a build.

const BLOCK_END = /<\/(p|div|li|h[1-6]|blockquote|pre|figure|figcaption|table|tr|td|th|ul|ol|dd|dt|section|article)\s*>|<br\s*\/?>|<hr\s*\/?>/gi;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Text from HTML: tags gone, entities read, blocks apart, spaces collapsed. */
export function plainText(html) {
  return String(html ?? '')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(BLOCK_END, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return NAMED[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * At most `max` characters, cut at a space, ending in "…" when cut. A word
 * longer than half the room is cut where the room ends.
 */
export function excerpt(text, max) {
  const s = String(text ?? '').trim();
  if ([...s].length <= max) return s;
  const room = [...s].slice(0, max - 1).join('');
  const space = room.lastIndexOf(' ');
  const cut = space >= room.length / 2 ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:.\-–—(]+$/u, '')}…`;
}

/** Sentences: a sentence ends at . ! ? or … (and a closing quote) before a space. */
function sentences(text) {
  const s = String(text ?? '').trim();
  return s ? s.split(/(?<=[.!?…]["'”’)\]]*)\s+/u) : [];
}

/**
 * The opening sentence, for a description: whole sentences while the first
 * is under 40 characters (so "Hi." is not all of it), at most `max`
 * characters; a first sentence longer than that is cut at a space.
 */
export function firstSentence(text, max = 160) {
  const s = String(text ?? '').trim();
  let out = '';
  for (const part of sentences(s)) {
    const next = out ? `${out} ${part}` : part;
    if (!out || [...next].length <= max) out = next;
    else break;
    if ([...out].length >= 40) break;
  }
  if (!out) return '';
  return [...out].length <= max ? out : excerpt(out, max);
}

/**
 * An untitled note's title: its first sentence when that is short enough to
 * read as a title, else its opening words, cut at a space near 60
 * characters.
 */
export function noteTitle(text, max = 60) {
  const s = String(text ?? '').trim();
  const first = sentences(s)[0]?.trim() ?? '';
  if (first && [...first].length <= max + 10) return first;
  return excerpt(s, max);
}

// What a description skips: code, headings, figures, tables and embeds,
// with whatever they hold.
const NOT_PROSE = /<(pre|h[1-6]|figure|table|iframe|video|audio|object|script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const PARAGRAPH = /<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi;

/**
 * A line of fields, "Arthur L. Guptill · ISBN 978-0-307-83188-0 · Year
 * 2014", as the owner's migration put over each book review: two or more
 * short parts joined by "·".
 */
export function isFieldLine(text) {
  const parts = String(text ?? '').split('·').map((p) => p.trim());
  // A field is a few words ("Arthur L. Guptill", "Year 2021 (Originally
  // 1985)"); a sentence runs longer.
  return parts.length >= 2 && parts.every((p) => p !== '' && [...p].length <= 60 && p.split(/\s+/).length <= 8);
}

/**
 * A post's own description when it gives none: the first sentence of its
 * first paragraph of prose, never running into the next block (views
 * critique 2026-10-08, second pass N1: "Arthur L. Guptill · ISBN … · Year
 * 2014 People that know me…" on a real share card, and a code-first post's
 * code as its summary). Code, headings, figures, tables, embeds, a
 * paragraph of pictures alone and a line of fields are skipped. '' when the
 * post has no prose paragraph.
 */
export function leadSentence(html, max = 160) {
  const prose = String(html ?? '').replace(/<!--[\s\S]*?-->/g, ' ').replace(NOT_PROSE, ' ');
  for (const match of prose.matchAll(PARAGRAPH)) {
    const text = plainText(match[1]);
    if (text === '' || isFieldLine(text)) continue;
    return firstSentence(text, max);
  }
  return '';
}
