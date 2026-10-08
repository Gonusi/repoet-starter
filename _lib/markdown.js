// How the blog's Markdown reads, on top of what markdown-it does by itself.
//
// - Quotes and apostrophes are typographic ("it's" → “it’s”), in the blog's
//   language where it has its own (German and Lithuanian „…“, French « … »).
//   Only quotes: `--`, `(c)` and `...` stay as written. Code is never touched.
// - A bare address with its scheme (https://…) is a link. A word that only
//   looks like a domain is not: README.md, main.py, www.example.org and
//   ada@example.org stay words, as written.
// - An image on a line of its own is a figure, its title (the "…" after the
//   address) its caption: `![A fern](fern.jpg "On the window")`. Before, the
//   title showed only under a mouse pointer, never on a phone.
// - A table sits in a box that scrolls sideways when the table is wider than
//   the column, so the page never does. The table itself stays a table, for
//   screen readers.
//
// Pure, so it can be tested without a build.

import { highlight } from './highlight.js';

/** Primary language → markdown-it's quotes: double open, double close, single open, single close. */
const QUOTES = {
  cs: '„“‚‘',
  de: '„“‚‘',
  lt: '„“‚‘',
  sk: '„“‚‘',
  ru: '«»„“',
  uk: '«»„“',
  fr: ['« ', ' »', '‹ ', ' ›'],
};

/** The quotes for blog.json's `language`; English ones for any other. */
export function quotesFor(language) {
  const primary = String(language ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(QUOTES, primary) ? QUOTES[primary] : '“”‘’';
}

/** Smart quotes and safe bare links, for the posts and the footer alike. */
export function typography(md, language) {
  md.set({ linkify: true, typographer: true, quotes: quotesFor(language) });
  md.disable('replacements');
  md.linkify.set({ fuzzyLink: false, fuzzyEmail: false });
  return md;
}

/**
 * A paragraph of nothing but images (and the line breaks between them)
 * becomes figures: one image, a <figure>; several, a <div class="figures">
 * of them. A title becomes the caption, and leaves the image. An image in a
 * sentence, or next to its own words, stays as it was.
 */
function figures(state) {
  const tokens = state.tokens;
  for (let i = 0; i + 2 < tokens.length; i++) {
    const [open, inline, close] = [tokens[i], tokens[i + 1], tokens[i + 2]];
    if (open.type !== 'paragraph_open' || open.hidden || inline.type !== 'inline' || close.type !== 'paragraph_close') continue;
    const kids = inline.children ?? [];
    const images = kids.filter((t) => t.type === 'image');
    const onlyImages = kids.every(
      (t) => t.type === 'image' || t.type === 'softbreak' || (t.type === 'text' && t.content.trim() === ''),
    );
    if (images.length === 0 || !onlyImages) continue;
    const html = (content) => Object.assign(new state.Token('html_inline', '', 0), { content });
    const children = [];
    for (const image of images) {
      const title = image.attrGet('title');
      if (title) image.attrs = image.attrs.filter(([name]) => name !== 'title');
      if (images.length > 1) children.push(html('<figure>'));
      children.push(image);
      if (title) children.push(html(`<figcaption>${state.md.utils.escapeHtml(title)}</figcaption>`));
      if (images.length > 1) children.push(html('</figure>'));
    }
    inline.children = children;
    open.tag = close.tag = images.length > 1 ? 'div' : 'figure';
    if (images.length > 1) open.attrSet('class', 'figures');
  }
}

/** Everything above, on Eleventy's markdown-it, with code coloured at build time (_lib/highlight.js). */
export function configureMarkdown(md, { language } = {}) {
  md.set({ highlight });
  typography(md, language);
  md.core.ruler.push('figures', figures);
  const rules = md.renderer.rules;
  rules.table_open = (tokens, i, options, env, self) => `<div class="table">${self.renderToken(tokens, i, options)}`;
  rules.table_close = (tokens, i, options, env, self) => `${self.renderToken(tokens, i, options).trimEnd()}</div>\n`;
  return md;
}
