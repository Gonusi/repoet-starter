// The blog's footer (blog.json "footer"; Repoet's docs/decisions/blog-footer.md):
// one line of inline Markdown at the bottom of every page.
//
// - Missing: Repoet's credit, DEFAULT_FOOTER.
// - "" (or only spaces): no footer at all.
// - Any other text: that line. Links, emphasis and code work; HTML is shown
//   as the text it is, never run, and block Markdown (a heading, a list)
//   stays the characters it is written with. A line break reads as a space.
//   Images are not shown: `![a](b)` is a "!" and a link.
import markdownIt from 'markdown-it';

export const DEFAULT_FOOTER = 'Built on the shoulders of GitHub by [Repoet](https://repoet.dev)';

// The template's Markdown (markdown-it, as Eleventy uses it), with HTML off.
const md = markdownIt({ html: false }).disable('image');

/**
 * The footer's HTML from blog.json's value: '' means no footer. `warning` is
 * set when the value is not text, which the build logs and shows the default.
 */
export function footerHtml(value) {
  let text = value;
  let warning = null;
  if (value === undefined || value === null) text = DEFAULT_FOOTER;
  else if (typeof value !== 'string') {
    text = DEFAULT_FOOTER;
    warning = `blog.json "footer" is ${Array.isArray(value) ? 'a list' : `a ${typeof value}`}, not one line of text, so the default footer is shown.`;
  }
  const line = text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return { html: line ? md.renderInline(line) : '', warning };
}
