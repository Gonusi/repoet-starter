// How the blog's Markdown reads (_lib/markdown.js; views critique P6, P7, P9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import markdownIt from 'markdown-it';
import { configureMarkdown, quotesFor } from './markdown.js';

// As Eleventy makes it: HTML on.
const render = (src, language = 'en') => configureMarkdown(markdownIt({ html: true }), { language }).render(src);

test('quotes and apostrophes are typographic; dashes, (c) and three full stops stay as written', () => {
  assert.equal(render(`He said "it's fine" -- (c) ...`), '<p>He said “it’s fine” -- (c) ...</p>\n');
});

test('quotes follow the blog’s language where it has its own', () => {
  assert.equal(render('"Labas" ir \'sveiki\'', 'lt'), '<p>„Labas“ ir ‚sveiki‘</p>\n');
  assert.equal(render('"Hallo"', 'de-AT'), '<p>„Hallo“</p>\n');
  assert.equal(render('"Salut"', 'fr'), '<p>« Salut »</p>\n');
  assert.equal(quotesFor('ja'), '“”‘’');
});

test('code is never touched: no smart quotes, no links', () => {
  assert.match(render('Use `"q" it\'s https://x.example` here.'), /<code>&quot;q&quot; it's https:\/\/x.example<\/code>/);
  const fenced = render('```\nconst s = "it\'s"; // https://x.example\n```');
  assert.match(fenced, /const s = &quot;it's&quot;; \/\/ https:\/\/x.example/);
  assert.doesNotMatch(fenced, /<a /);
  const coloured = render('```js\nconst s = "it\'s";\n```');
  assert.match(coloured, /<span class="token string">"it's"<\/span>/);
});

test('a bare https:// address is a link; words that only look like domains stay words', () => {
  const html = render('See https://example.com/a_(b) and README.md, main.py, www.example.org, ada@example.org.');
  assert.match(html, /<a href="https:\/\/example.com\/a_\(b\)">https:\/\/example.com\/a_\(b\)<\/a>/);
  assert.equal(html.match(/<a /g).length, 1);
});

test('an image on its own line is a figure, its title the caption; one in a sentence stays as it was', () => {
  assert.equal(
    render('![A fern](fern.jpg "On the window")'),
    '<figure><img src="fern.jpg" alt="A fern"><figcaption>On the window</figcaption></figure>\n',
  );
  assert.equal(render('![A fern](fern.jpg)'), '<figure><img src="fern.jpg" alt="A fern"></figure>\n');
  assert.equal(
    render('![One](a.jpg "First")\n![Two](b.jpg)'),
    '<div class="figures"><figure><img src="a.jpg" alt="One"><figcaption>First</figcaption></figure><figure><img src="b.jpg" alt="Two"></figure></div>\n',
  );
  // Its own words beside it: a caption written by hand stays the only one.
  assert.equal(
    render('![Broccoli](c.jpg "Broccoli")\n↑ Broccoli'),
    '<p><img src="c.jpg" alt="Broccoli" title="Broccoli">\n↑ Broccoli</p>\n',
  );
  assert.match(render('[![badge](e.svg)](https://x.example)'), /^<p><a /, 'an image in a link is a link');
  assert.match(render('A <b>caption</b> "q" ![x](y.jpg "<i>t</i>")'), /^<p>/);
  assert.match(render('![x](y.jpg "<b>t</b>")'), /<figcaption>&lt;b&gt;t&lt;\/b&gt;<\/figcaption>/, 'a caption is text');
});

test('a table sits in a box that scrolls when the table is wider than the column', () => {
  assert.match(render('| a | b |\n|---|--:|\n| 1 | 2 |'), /^<div class="table"><table>[\s\S]*<\/table><\/div>\n$/);
});
