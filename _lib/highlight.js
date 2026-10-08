// Code colouring at build time: a fenced block in a language Prism knows
// (```js, ```python, ```sh…) becomes coloured HTML, and readers get no
// script. A block in a language Prism does not know, or with none, is left
// to Markdown, which escapes it: it shows exactly as written.
//
// Prism directly, not @11ty/eleventy-plugin-syntaxhighlight: that plugin
// (5.0.2) puts the block's text into the page unescaped when the language is
// unknown or `text`, so ```text holding <script> ran it (found 2026-10-08).

import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

loadLanguages.silent = true; // an unknown language is not worth a console line

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Prism's grammar for a language name or alias, or null. */
function grammarOf(name) {
  if (!Object.hasOwn(Prism.languages, name)) {
    try {
      loadLanguages([name]);
    } catch {
      return null;
    }
  }
  const grammar = Object.hasOwn(Prism.languages, name) ? Prism.languages[name] : null;
  return grammar && typeof grammar === 'object' ? grammar : null;
}

/**
 * markdown-it's `highlight`: a whole <pre> for a known language, or '' to
 * let markdown-it escape the block itself.
 */
export function highlight(code, lang) {
  const name = String(lang ?? '').trim().split(/\s+/)[0].toLowerCase();
  if (!name) return '';
  const grammar = grammarOf(name);
  if (!grammar) return '';
  const cls = `language-${escapeHtml(name)}`;
  return `<pre class="${cls}"><code class="${cls}">${Prism.highlight(code, grammar, name)}</code></pre>`;
}
