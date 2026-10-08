import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_FOOTER, footerHtml } from './footer.js';
import { testSite } from './testSite.mjs';

// The footer (blog.json "footer"): one line of inline Markdown under every
// page. Missing: Repoet's credit. "": no footer. HTML in it is text, never
// run. Built in throwaway copies with their own settings (testSite.mjs).

const SETTINGS = { title: 'Footer blog', description: '', language: 'en', author: '', showDescription: false };
const footerOf = (html) => /<footer>([\s\S]*?)<\/footer>/.exec(html)?.[1];

function blogWith(extra) {
  const site = testSite();
  site.write('blog.json', JSON.stringify({ ...SETTINGS, ...extra }, null, 2));
  site.write('posts/2026/10/ffff0001-a-post/index.md', [
    '---', 'id: footer-post', 'title: A post', 'slug: a-post', 'date: 2026-10-08T10:00:00Z', '---', 'Words.', '',
  ].join('\n'));
  return site;
}

let missing, empty, custom;

before(async () => {
  missing = blogWith({});
  empty = blogWith({ footer: '' });
  custom = blogWith({
    footer: 'Written by *Ada* · [Feed](https://ada.example/feed.xml) <script>alert(1)</script> <b>bold</b>',
  });
  await Promise.all([missing.build(), empty.build(), custom.build()]);
});

after(() => {
  missing?.dispose();
  empty?.dispose();
  custom?.dispose();
});

test('with no footer in blog.json, every page credits Repoet, linking to repoet.dev', () => {
  for (const page of ['index.html', 'a-post/index.html', '404.html']) {
    assert.equal(
      footerOf(missing.read(page)),
      'Built on the shoulders of GitHub by <a href="https://repoet.dev">Repoet</a>',
      page,
    );
  }
});

test('an empty footer means no footer at all', () => {
  for (const page of ['index.html', 'a-post/index.html']) {
    assert.doesNotMatch(empty.read(page), /<footer/, page);
  }
});

test('a footer of their own: its words, emphasis and links, on every page', () => {
  const footer = footerOf(custom.read('a-post/index.html'));
  assert.match(footer, /^Written by <em>Ada<\/em> · <a href="https:\/\/ada\.example\/feed\.xml">Feed<\/a>/);
  assert.equal(footerOf(custom.read('index.html')), footer);
});

test('HTML in the footer is shown as text and never run', () => {
  const html = custom.read('index.html');
  const footer = footerOf(html);
  assert.match(footer, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &lt;b&gt;bold&lt;\/b&gt;$/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(footer, /<b>/);
});

test('the footer is one line: block Markdown stays as written, a line break is a space, images are not shown', () => {
  assert.equal(footerHtml('# Not a heading').html, '# Not a heading');
  assert.equal(footerHtml('- not a list').html, '- not a list');
  assert.equal(footerHtml('one\ntwo\r\n  three').html, 'one two three');
  assert.equal(footerHtml('![me](me.png)').html, '!<a href="me.png">me</a>');
  assert.equal(footerHtml('`code`').html, '<code>code</code>');
});

test('a link that would run script is not a link', () => {
  assert.doesNotMatch(footerHtml('[x](javascript:alert(1))').html, /<a /);
});

test('only spaces is no footer; a value that is not text shows the default and says why', () => {
  assert.equal(footerHtml('   ').html, '');
  assert.equal(footerHtml(null).html, footerHtml(undefined).html);
  assert.equal(footerHtml(undefined).warning, null);
  const odd = footerHtml(42);
  assert.equal(odd.html, footerHtml(DEFAULT_FOOTER).html);
  assert.match(odd.warning, /"footer" is a number, not one line of text, so the default footer is shown/);
});

// WCAG AA: words are at least 4.5:1 on their ground. ink-soft (dates, the
// tagline, quotes, the footer) was 4.47:1 on the paper until 2026-10-08.
test('the grey of dates, the tagline and the footer, and the code colours, are at least 4.5:1 on their ground', () => {
  const layout = readFileSync(new URL('../_includes/layout.njk', import.meta.url), 'utf-8');
  const token = (name) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(layout)[1];
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const paper = token('paper');
  for (const name of ['ink', 'ink-soft', 'green-deep']) {
    assert.ok(ratio(token(name), paper) >= 4.5, `--${name} on the paper is ${ratio(token(name), paper).toFixed(2)}:1`);
  }
  const codeGround = /pre \{ background: (#[0-9a-f]{6})/i.exec(layout)[1];
  for (const name of ['code-comment', 'code-keyword', 'code-string', 'code-number']) {
    assert.ok(ratio(token(name), codeGround) >= 4.5, `--${name} on code is ${ratio(token(name), codeGround).toFixed(2)}:1`);
  }
});
