// What readers get, page by page (Repoet's views critique of the blog,
// 2026-10-08): the feed's newest posts, a post's own title and description
// on its share card and tab, the section a post belongs to, captions, sizes
// and lazy loading, tables, pages, dates in the blog's language, and the
// styles that keep the column on a phone, in dark mode and on paper. These
// build throwaway copies with their own settings (testSite.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testSite } from './testSite.mjs';

const SITE = 'https://ada.example';
let site, plain;

const post = (s, dir, front, body) =>
  s.write(`posts/${dir}/index.md`, ['---', ...front, '---', body, ''].join('\n'));

/** The header of a PNG this size: enough for its dimensions to be read. */
function png(width, height) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  b.writeUInt8(8, 24);
  b.writeUInt8(2, 25);
  return b;
}

before(async () => {
  site = testSite();
  site.write('blog.json', JSON.stringify({
    title: 'View blog',
    description: 'Notes from a workshop',
    language: 'en',
    author: 'Ada',
    showDescription: false,
    menu: [
      { label: 'Book Reviews', tag: 'books', path: '/books/' },
      { label: 'TIL', tag: 'til' },
      { label: 'About', tag: 'about', home: false },
    ],
  }, null, 2));
  // 55 plain posts, one a day from 1 Jan: more than a feed's 20 and a home
  // page's 50.
  for (let i = 1; i <= 55; i++) {
    const n = String(i).padStart(2, '0');
    const day = new Date(Date.UTC(2026, 0, i)).toISOString().slice(0, 10);
    post(site, `2026/01/aa0000${n}-p${n}`, [`id: p${n}`, `title: Post ${n}`, `slug: p${n}`, `date: ${day}T10:00:00Z`], `Body ${n}.`);
  }
  post(site, '2026/09/bb000001-newest', ['id: newest', 'title: Newest post', 'slug: newest', 'date: 2026-09-30T10:00:00Z'], 'The newest.');
  post(site, '2026/09/bb000002-note', ['id: note', 'slug: note', 'date: 2026-09-20T10:00:00Z'],
    'Shipped the new feed today. It took three tries & a *bit* of luck.');
  post(site, '2026/09/bb000003-long-note', ['id: long-note', 'slug: long-note', 'date: 2026-09-19T10:00:00Z'],
    'A note that runs on and on without any end mark at all because it is a stream of thought about nothing much');
  post(site, '2026/09/bb000004-nodesc', ['id: nodesc', 'title: Pen and Ink', 'slug: nodesc', 'date: 2026-09-18T10:00:00Z'],
    'Rendering in pen and ink is a classic book by Arthur Guptill. I read it slowly.\n\nMore words.');
  post(site, '2026/09/bb000005-words', ['id: words', 'title: Words', 'slug: words', 'date: 2026-09-17T10:00:00Z', 'description: "Mind the <script>alert(1)</script> here"'], [
    'He said "it\'s fine" -- see https://example.com/page and README.md.',
    '',
    'Inline `"q" it\'s` code.',
    '',
    '```js',
    'const s = "it\'s"; // a comment',
    '```',
    '',
    'Averyveryveryveryveryveryveryveryveryveryveryveryveryverylongwordthatneverbreaks here.',
  ].join('\n'));
  site.write('posts/2026/09/bb000006-photos/tall.png', png(1400, 2400));
  site.write('posts/2026/09/bb000006-photos/wide.png', png(800, 600));
  post(site, '2026/09/bb000006-photos', ['id: photos', 'title: Photos', 'slug: photos', 'date: 2026-09-16T10:00:00Z'], [
    '![A tall fern](tall.png "On the window")',
    '',
    '![Wide](wide.png)',
    '![Missing](missing.png)',
    '',
    '| Day | km |',
    '|---|--:|',
    '| Mon | 12.0 |',
    '',
    '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/x" frameborder="0"></iframe>',
  ].join('\n'));
  post(site, '2026/09/bb000007-book-one', ['id: book-1', 'title: A Book', 'slug: book-one', 'date: 2026-09-15T10:00:00Z', 'tags: [British, books, Books]'], 'A review.');
  post(site, '2026/09/bb000008-book-two', ['id: book-2', 'title: Another Book', 'slug: book-two', 'date: 2026-09-14T10:00:00Z', 'tags: [books]'], 'Another review.');
  post(site, '2026/09/bb000009-til-one', ['id: til-1', 'title: TIL one', 'slug: til-one', 'date: 2026-09-13T10:00:00Z', 'tags: [til, go]'], 'Learned.');
  post(site, '2026/09/bb000010-til-two', ['id: til-2', 'title: TIL two', 'slug: til-two', 'date: 2026-09-12T10:00:00Z', 'tags: [til]'], 'Learned more.');
  post(site, '2026/09/bb000011-about', ['id: about', 'title: About me', 'slug: about', 'date: 2026-09-01T10:00:00Z', 'tags: [about]'], 'Hello.');
  await site.build({ SITE_URL: SITE });

  // A blog with nothing set: no menu, no footer, no description, German,
  // written by the blog's own name.
  plain = testSite();
  plain.write('blog.json', JSON.stringify({ title: 'Anna', description: '', language: 'de', author: 'Anna', footer: '' }, null, 2));
  post(plain, '2026/01/cc000001-hallo', ['id: hallo', 'title: Hallo', 'slug: hallo', 'date: 2026-01-29T10:00:00Z', 'tags: [go]'],
    'Sie sagte "ja" und \'nein\'.');
  await plain.build({ SITE_URL: SITE });
});

after(() => {
  site?.dispose();
  plain?.dispose();
});

const read = (path) => site.read(path);
const meta = (html, attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`).exec(html)?.[1];
const titleOf = (html) => /<title>([^<]*)<\/title>/.exec(html)[1];
const jsonLd = (html) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
const entries = (feed) => [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);

// ——— The feed ———

test('the feed holds the newest 20 posts, newest first: a new post reaches subscribers', () => {
  const feed = read('feed.xml');
  const list = entries(feed);
  assert.equal(list.length, 20);
  assert.match(list[0], /<title>Newest post<\/title>/);
  assert.match(list[0], new RegExp(`<id>${SITE}/newest/</id>`), 'an entry’s id is its address, as before');
  assert.doesNotMatch(feed, /<title>Post 01<\/title>/, 'the oldest posts are not in it');
  assert.match(feed, /<title>Post 55<\/title>/);
  assert.match(feed, new RegExp(`<id>${SITE}/</id>`), 'the feed’s id is the blog’s address, as before');
  assert.match(feed, /<updated>2026-09-30T10:00:00Z<\/updated>/);
  assert.doesNotMatch(feed, /About me/, 'home: false keeps it out');
});

test('an untitled note is titled in the feed with its opening words; a post is summarised by its description or first sentence', () => {
  const list = entries(read('feed.xml'));
  const note = list.find((e) => e.includes(`${SITE}/note/`));
  assert.match(note, /<title>Shipped the new feed today.<\/title>/);
  const nodesc = list.find((e) => e.includes(`${SITE}/nodesc/`));
  assert.match(nodesc, /<summary>Rendering in pen and ink is a classic book by Arthur Guptill.<\/summary>/);
  const book = list.find((e) => e.includes(`${SITE}/book-one/`));
  assert.match(book, /<category term="British" \/>\s*<category term="Book Reviews" \/>/);
});

// ——— Titles and descriptions: the tab, search and a share card ———

test('an untitled note’s tab, share card and search title are its own first sentence, never the blog’s name', () => {
  const html = read('note/index.html');
  assert.equal(titleOf(html), 'Shipped the new feed today.');
  assert.equal(meta(html, 'property', 'og:title'), 'Shipped the new feed today.');
  assert.equal(jsonLd(html).headline, 'Shipped the new feed today.');
  assert.equal(meta(html, 'name', 'description'), 'Shipped the new feed today. It took three tries &amp; a bit of luck.');
  assert.doesNotMatch(html, /<h1>/, 'the page itself still reads as a note');
});

test('a note without a sentence end is titled with its opening words, cut at a space', () => {
  assert.equal(titleOf(read('long-note/index.html')), 'A note that runs on and on without any end mark at all…');
});

test('a post without a description is described by its first sentence, not the blog’s tagline', () => {
  const html = read('nodesc/index.html');
  const first = 'Rendering in pen and ink is a classic book by Arthur Guptill.';
  assert.equal(meta(html, 'name', 'description'), first);
  assert.equal(meta(html, 'property', 'og:description'), first);
  assert.equal(jsonLd(html).description, first);
  assert.equal(titleOf(html), 'Pen and Ink');
});

test('no "<" reaches a JSON-LD block, so a description with </script> cannot end it', () => {
  const html = read('words/index.html');
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.doesNotMatch(block, /</);
  assert.equal(JSON.parse(block).description, 'Mind the <script>alert(1)</script> here');
});

test('a tag page, page 2, the list of tags and the 404 each have their own title', () => {
  assert.equal(titleOf(read('tags/go/index.html')), 'Tagged go · View blog');
  assert.equal(titleOf(read('tags/til/index.html')), 'TIL · View blog', 'a menu list’s tag page is named as the menu names it');
  assert.equal(titleOf(read('books/index.html')), 'Book Reviews · View blog');
  assert.equal(titleOf(read('page/2/index.html')), 'Page 2 · View blog');
  assert.equal(titleOf(read('tags/index.html')), 'Tags · View blog');
  assert.equal(titleOf(read('404.html')), 'Not found · View blog');
  assert.equal(titleOf(read('index.html')), 'View blog');
  assert.equal(meta(read('page/2/index.html'), 'property', 'og:title'), 'Page 2 · View blog');
});

test('a tag page says it is a tag; the list of tags links every tag once', () => {
  assert.match(read('tags/go/index.html'), /<h1>Tagged go<\/h1>/);
  const tags = read('tags/index.html');
  assert.match(tags, /<h1>Tags<\/h1>/);
  for (const slug of ['about', 'books', 'british', 'go', 'til']) assert.match(tags, new RegExp(`href="/tags/${slug}/"`), slug);
  assert.equal(tags.match(/href="\/tags\/books\/"/g).length, 1, 'books and Books are one tag');
});

// ——— The section a post belongs to ———

test('a post in a menu list: its menu item is marked, and its tag line uses the menu’s words and address', () => {
  const html = read('book-one/index.html');
  assert.match(html, /<a href="\/books\/" aria-current="true">Book Reviews<\/a>/);
  assert.match(html, /<a href="\/tags\/british\/">British<\/a>, <a href="\/books\/">Book Reviews<\/a> · /, 'books and Books once, as the menu says');
  assert.match(read('til-one/index.html'), /<a href="\/tags\/til\/" aria-current="true">TIL<\/a>/);
  assert.match(read('til-one/index.html'), /<a href="\/tags\/til\/">TIL<\/a>, <a href="\/tags\/go\/">go<\/a>/);
  assert.doesNotMatch(read('newest/index.html'), /aria-current="/, 'a post in no list marks nothing');
  assert.match(read('tags/til/index.html'), /<a href="\/tags\/til\/" aria-current="page">TIL<\/a>/);
});

test('the home list names a post’s section under its date; a section’s own list does not repeat it', () => {
  const home = read('index.html');
  assert.match(home, /<strong>A Book<\/strong>\s*<\/a>\s*<div class="meta">Sep 15, 2026 · Book Reviews<\/div>/);
  assert.match(home, /<strong>Newest post<\/strong>\s*<\/a>\s*<div class="meta">Sep 30, 2026<\/div>/);
  assert.match(read('books/index.html'), /<div class="meta">Sep 15, 2026<\/div>/);
});

test('the way home is "All" while every list is on the home page, and the blog’s name is the home page’s heading', () => {
  const home = read('index.html');
  assert.match(home, /<nav aria-label="Menu">\s*<a href="\/" aria-current="page">All<\/a>/);
  assert.match(home, /<h1 class="wordmark"><a href="\/">View blog<\/a><\/h1>/);
  assert.match(read('newest/index.html'), /<a class="wordmark" href="\/">View blog<\/a>/, 'elsewhere it is a link, the post has the h1');
});

test('"‹ All posts" is one style, and only where the header has no way home', () => {
  assert.match(read('404.html'), /<p class="back"><a href="\/">‹ All posts<\/a><\/p>/);
  assert.doesNotMatch(read('tags/go/index.html'), /class="back"/, 'the menu starts with All');
  assert.doesNotMatch(read('books/index.html'), /class="back"/);
  assert.match(plain.read('tags/go/index.html'), /<p class="back"><a href="\/">‹ All posts<\/a><\/p>/, 'no menu: the way back stays');
});

// ——— Words ———

test('quotes are typographic and a bare address is a link; code keeps its straight quotes', () => {
  const html = read('words/index.html');
  assert.match(html, /He said “it’s fine” -- see <a href="https:\/\/example.com\/page">https:\/\/example.com\/page<\/a> and README.md./);
  assert.match(html, /<code>&quot;q&quot; it's<\/code>/);
  assert.match(html, /<span class="token string">"it's"<\/span>/);
});

test('an untitled note’s row ends with one ellipsis character, and its words read as written', () => {
  const home = read('index.html');
  assert.match(home, /Shipped the new feed today. It took three tries &amp; a bit of luck./);
  assert.doesNotMatch(home, /&amp;amp;|\.\.\./);
});

test('pages of the home list say where they are, apart: "‹ Newer posts", "Page 2 of 2", "Older posts ›"', () => {
  assert.match(read('index.html'), /<span>Page 1 of 2<\/span>\s*<a class="older" href="\/page\/2\/" rel="next">Older posts ›<\/a>/);
  assert.match(read('page/2/index.html'), /<a href="\/" rel="prev">‹ Newer posts<\/a>\s*<span>Page 2 of 2<\/span>/);
});

// ——— Photos, frames, tables ———

test('a photo has its size, its caption, and stays within the column and the screen; later photos load lazily', () => {
  const html = read('photos/index.html');
  assert.match(html, /<figure><img src="tall.png" alt="A tall fern" decoding="async" width="1400" height="2400" style="width: min\(1400px, 100%, calc\(80vh \* 1400 \/ 2400\)\);"><figcaption>On the window<\/figcaption><\/figure>/);
  assert.match(html, /<div class="figures"><figure><img src="wide.png" alt="Wide" loading="lazy" decoding="async" width="800" height="600"/);
  assert.match(html, /<img src="missing.png" alt="Missing" loading="lazy" decoding="async">/);
});

test('a frame keeps its proportions in a narrow column and loads lazily; a table scrolls inside its box', () => {
  const html = read('photos/index.html');
  assert.match(html, /<iframe width="560" height="315" [^>]*loading="lazy" style="aspect-ratio: 560 \/ 315; height: auto;"><\/iframe>/);
  assert.match(html, /<div class="table"><table>/);
});

// ——— The page's own styles ———

const css = () => /<style>([\s\S]*?)<\/style>/.exec(read('index.html'))[1];

test('nothing pushes the page sideways: words break, frames, videos and tables stay in the column', () => {
  const style = css();
  assert.match(style, /main \{ overflow-wrap: anywhere; \}/);
  assert.match(style, /img, video \{ max-width: 100%; height: auto; \}/);
  assert.match(style, /iframe, embed, object \{ max-width: 100%; \}/);
  assert.match(style, /\.table \{ overflow-x: auto;/);
  assert.match(style, /pre \{[^}]*overflow-x: auto;/);
});

test('every font is a real face: weights and styles declared as the files have them, nothing synthesized, every file there', () => {
  const style = css();
  assert.match(style, /font-synthesis: none/);
  assert.doesNotMatch(style, /Literata-600/, 'the duplicate file is gone: Literata is variable');
  assert.match(style, /Literata-400-italic\.woff2'\) format\('woff2'\); font-weight: 400 900; font-style: italic;/, 'the wordmark’s italic 600 is real');
  assert.match(style, /IBMPlexMono-400-italic\.woff2'\) format\('woff2'\); font-weight: 400; font-style: italic;/, 'comments in code');
  for (const [, file] of style.matchAll(/url\('\/(fonts\/[^']+)'\)/g)) assert.ok(site.has(file), `${file} is published`);
  assert.match(read('index.html'), /<link rel="preload" href="\/fonts\/Literata-400-italic.woff2" as="font" type="font\/woff2" crossorigin>/, 'the blog’s name does not swap fonts as the page opens');
});

test('small links in the system voice are at least 24px to tap; tags and dates do not break inside', () => {
  const style = css();
  assert.match(style, /\.meta a, \.back a, body > footer a, nav\.pages a, ul\.tags a \{ display: inline-block; min-height: 24px; min-width: 24px; line-height: 24px; \}/);
  assert.match(style, /\.meta time, \.meta \.by \{ white-space: nowrap; \}/);
});

test('the page follows the system into dark, with its own tokens', () => {
  const style = css();
  assert.match(style, /@media screen and \(prefers-color-scheme: dark\) \{\s*:root \{[^}]*--paper: #22251f;/);
  assert.match(read('index.html'), /<meta name="color-scheme" content="light dark">/);
});

test('on paper: no menu, footer or ways back, and code wraps instead of being cut off', () => {
  const print = /@media print \{([\s\S]*?)\n    \}/.exec(css())[1];
  assert.match(print, /header nav, body > footer, nav\.pages, \.back \{ display: none; \}/);
  assert.match(print, /pre \{ white-space: pre-wrap;/);
});

test('code lines sit 1.5 apart at the code’s own size', () => {
  assert.match(css(), /pre \{ font-family: var\(--mono\); font-size: 0\.85em; line-height: 1\.5;/);
  assert.match(css(), /pre code \{ font-size: inherit;/);
});

// ——— A blog with nothing set, in another language ———

test('dates and quotes follow the blog’s language', () => {
  const html = plain.read('hallo/index.html');
  assert.match(html, /<html lang="de">/);
  assert.match(html, /<time datetime="2026-01-29T10:00:00.000Z">29. Jan. 2026<\/time>/);
  assert.match(html, /Sie sagte „ja“ und ‚nein‘./);
  assert.match(read('newest/index.html'), />Sep 30, 2026<\/time>/, 'English as before');
});

test('a blog with no menu, footer or description: no menu, no footer, no empty description; the author named once', () => {
  const home = plain.read('index.html');
  assert.doesNotMatch(home, /<nav aria-label="Menu"/);
  assert.doesNotMatch(home, /<footer/);
  assert.doesNotMatch(home, /<meta name="description"/);
  assert.doesNotMatch(home, /og:description/);
  const html = plain.read('hallo/index.html');
  assert.doesNotMatch(html, /class="by"/, 'the blog’s name already says who writes it');
  assert.match(read('newest/index.html'), / · <span class="by">Ada<\/span><\/p>/, 'a name the blog’s does not say is shown');
});
