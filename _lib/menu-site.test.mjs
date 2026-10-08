import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testSite } from './testSite.mjs';

// The blog's menu (blog.json "menu"), its addresses and code colouring, as a
// built site shows them. Built in throwaway copies with their own settings
// (testSite.mjs), under a project-page prefix so every link proves it is
// prefixed once.

const SITE = 'https://example-owner.github.io/blog';
let site;
let plain;

function post(s, dir, fm, body = 'Body.') {
  s.write(`${dir}/index.md`, ['---', ...fm, '---', body, ''].join('\n'));
}

before(async () => {
  site = testSite();
  site.write('blog.json', JSON.stringify({
    title: 'Menu blog', description: '', language: 'en', author: 'Ada', showDescription: false,
    menu: [
      { label: 'About', tag: 'about', home: false },
      { label: 'TIL', tag: 'TIL', path: '/til/' },
      { label: 'Books', tag: 'books', path: 'books' },
      { label: 'Nothing yet', tag: 'empty' },
      { label: 'Notes', tag: 'notes', home: false },
      { label: 'Taken', tag: 'taken', path: '/clash/' },
    ],
  }, null, 2));
  post(site, 'posts/2026/08/aaaa0001-about-me', [
    'id: m-about', 'title: About me', 'slug: about', 'date: 2026-08-01T10:00:00Z', 'tags: [about]',
  ], 'I write about **code**.');
  post(site, 'posts/2026/08/bbbb0001-til-one', [
    'id: m-til-1', 'title: TIL one', 'slug: til-one', 'date: 2026-08-02T10:00:00Z', 'tags: [til, js]',
  ], [
    'A coloured block:',
    '',
    '```js',
    'const answer = 42; // the answer',
    'console.log("hello");',
    '```',
    '',
    'A block in a language nobody knows:',
    '',
    '```madeuplang',
    'zz <b>not bold</b>',
    '```',
    '',
    '```text',
    '<script>alert(1)</script>',
    '```',
    '',
    '```',
    'plain block',
    '```',
  ].join('\n'));
  post(site, 'posts/2026/08/bbbb0002-til-two', [
    'id: m-til-2', 'title: TIL two', 'slug: til-two', 'date: 2026-08-03T10:00:00Z', 'tags: [Til]',
  ]);
  post(site, 'posts/2026/08/cccc0001-a-book', [
    'id: m-book', 'title: A book', 'slug: a-book', 'date: 2026-08-04T10:00:00Z', 'tags: [books]',
  ]);
  post(site, 'posts/2026/08/dddd0001-note-one', [
    'id: m-note-1', 'title: Note one', 'slug: note-one', 'date: 2026-08-05T10:00:00Z', 'tags: [notes]',
  ]);
  post(site, 'posts/2026/08/dddd0002-note-two', [
    'id: m-note-2', 'title: Note two', 'slug: note-two', 'date: 2026-08-06T10:00:00Z', 'tags: [notes]',
  ]);
  post(site, 'posts/2026/08/eeee0001-taken', [
    'id: m-taken', 'title: Taken post', 'slug: taken-post', 'date: 2026-08-07T10:00:00Z', 'tags: [taken]',
  ]);
  post(site, 'posts/2026/08/eeee0002-taken-two', [
    'id: m-taken-2', 'title: Taken two', 'slug: taken-two', 'date: 2026-08-07T11:00:00Z', 'tags: [taken]',
  ]);
  // Clashes that used to fail the whole build.
  post(site, 'posts/2026/08/ffff0001-clash', [
    'id: m-clash', 'title: Clash post', 'slug: clash', 'date: 2026-08-08T10:00:00Z',
  ]);
  post(site, 'posts/2026/08/ffff0002-same-a', [
    'id: m-same-a', 'title: Same A', 'permalink: /same/', 'date: 2026-08-09T10:00:00Z',
  ]);
  post(site, 'posts/2026/08/ffff0003-same-b', [
    'id: m-same-b', 'title: Same B', 'permalink: /same/', 'date: 2026-08-10T10:00:00Z',
  ]);
  site.write('colophon.njk', '---\nlayout: layout.njk\n---\n<p>Colophon page</p>\n');
  post(site, 'posts/2026/08/ffff0004-colophon', [
    'id: m-colophon', 'title: Colophon post', 'slug: colophon', 'date: 2026-08-11T10:00:00Z',
  ]);
  post(site, 'posts/2026/08/ffff0005-feed', [
    'id: m-feed', 'title: Feed post', 'slug: feed.xml', 'date: 2026-08-12T10:00:00Z',
  ]);
  await site.build({ SITE_URL: SITE, PATH_PREFIX: '/blog/' });

  plain = testSite();
  post(plain, 'posts/2026/08/aaaa0001-about-me', [
    'id: p-about', 'title: About me', 'slug: about', 'date: 2026-08-01T10:00:00Z', 'tags: [about]',
  ]);
  await plain.build({ SITE_URL: SITE, PATH_PREFIX: '/' });
});

after(() => {
  site?.dispose();
  plain?.dispose();
});

const header = (html) => /<header>[\s\S]*?<\/header>/.exec(html)[0];
const links = (html) => [...header(html).matchAll(/<nav[\s\S]*?<\/nav>/g)].join('').match(/<a [^>]*>[^<]*<\/a>/g) ?? [];

test('the header shows the menu in its order; a tag with no posts is left out', () => {
  const nav = links(site.read('index.html'));
  assert.deepEqual(
    nav.map((a) => />([^<]*)</.exec(a)[1]),
    ['About', 'TIL', 'Books', 'Notes', 'Taken'],
  );
});

test('a tag with one post links straight to it; with several, to its list', () => {
  const nav = links(site.read('index.html')).join('\n');
  assert.match(nav, /href="\/blog\/about\/">About/);
  assert.match(nav, /href="\/blog\/til\/">TIL/, 'at its path');
  assert.match(nav, /href="\/blog\/a-book\/">Books/, 'one book: the post, path or not');
  assert.match(nav, /href="\/blog\/tags\/notes\/">Notes/, 'no path: the tag page');
});

test('the page a menu link opens says so', () => {
  assert.match(header(site.read('about/index.html')), /<a href="\/blog\/about\/" aria-current="page">About<\/a>/);
  assert.doesNotMatch(header(site.read('index.html')), /aria-current/);
});

test('a menu tag\'s only post, kept off the home page, reads as a page: no date, no tags', () => {
  const html = site.read('about/index.html');
  assert.match(html, /<h1>About me<\/h1>/);
  assert.doesNotMatch(html, /<p class="meta">/);
  assert.doesNotMatch(html, /<time/);
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.doesNotMatch(html, /article:published_time/);
  assert.match(html, /"@type":"WebPage"/);
  assert.doesNotMatch(html, /datePublished/);
});

test('a post on the home page keeps its date and tags, even when its tag is in the menu', () => {
  const html = site.read('a-book/index.html');
  assert.match(html, /<p class="meta"><time/);
  assert.match(html, /"@type":"BlogPosting"/);
  const note = site.read('note-one/index.html');
  assert.match(note, /<p class="meta"><time/, 'two notes are a list, not a page');
});

test('home: false keeps a tag\'s posts off the home list and the feed, not the sitemap', () => {
  const home = site.read('index.html');
  const feed = site.read('feed.xml');
  const sitemap = site.read('sitemap.xml');
  for (const hidden of ['About me', 'Note one', 'Note two']) {
    assert.doesNotMatch(home, new RegExp(`<strong>${hidden}<`), hidden);
    assert.doesNotMatch(feed, new RegExp(`<title>${hidden}<`), hidden);
  }
  for (const address of ['about', 'note-one', 'note-two']) {
    assert.match(sitemap, new RegExp(`/blog/${address}/</loc>`), address);
  }
  assert.match(home, /<strong>TIL one</);
  assert.match(feed, /<title>TIL one</);
  assert.ok(site.has('tags/notes/index.html'));
  assert.match(site.read('tags/notes/index.html'), /Note one[\s\S]*Note two|Note two[\s\S]*Note one/);
});

test('a path builds the tag\'s list there, and the tag page stays', () => {
  const list = site.read('til/index.html');
  assert.match(list, /<h1>TIL<\/h1>/);
  assert.match(list, /<title>TIL<\/title>/);
  assert.match(list, /TIL two[\s\S]*TIL one/, 'newest first');
  assert.ok(site.has('tags/til/index.html'), 'old links to the tag page keep working');
  assert.ok(site.has('books/index.html'), '"books" is the address /books/');
  assert.match(site.read('til-one/index.html'), /href="\/blog\/til\/">til<\/a>/, 'a post\'s tag links to the list\'s address');
});

test('a clash never fails the build: the later claimant gets another address', () => {
  // The menu's /clash/ is a post's slug: the post keeps it, the list stays at its tag page.
  assert.match(site.read('clash/index.html'), /Clash post/);
  assert.match(links(site.read('index.html')).join('\n'), /href="\/blog\/tags\/taken\/">Taken/);
  // Two hand-set permalinks: the earlier folder keeps /same/.
  assert.match(site.read('same/index.html'), /Same A/);
  assert.match(site.read('same-ffff0003/index.html'), /Same B/);
  // A page of the blog's own (colophon.njk) keeps its address; the post moves.
  assert.match(site.read('colophon/index.html'), /Colophon page/);
  assert.match(site.read('colophon-ffff0004/index.html'), /Colophon post/);
  // A slug that would make the feed a folder.
  assert.match(site.read('feed.xml'), /<feed/);
  assert.match(site.read('feed.xml-ffff0005/index.html'), /Feed post/);
});

test('code is coloured when the site is built, with no script for readers', () => {
  const html = site.read('til-one/index.html');
  assert.match(html, /<pre class="language-js"><code class="language-js"><span class="token keyword">const<\/span>/);
  assert.match(html, /<span class="token comment">\/\/ the answer<\/span>/);
  assert.match(html, /<span class="token string">"hello"<\/span>/);
  assert.match(html, /<pre><code class="language-madeuplang">zz &lt;b&gt;not bold&lt;\/b&gt;/, 'an unknown language stays plain text');
  assert.match(html, /<code class="language-text">&lt;script>alert\(1\)&lt;\/script>/, 'escaped, never run');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /<pre><code>plain block/);
  const scripts = html.match(/<script[^>]*>/g) ?? [];
  assert.deepEqual(scripts, ['<script type="application/ld+json">']);
  assert.match(html, /\.token\.keyword/, 'the colours are in the page\'s own style');
});

test('with no menu, the header has no menu and every post is on the home page and in the feed', () => {
  const home = plain.read('index.html');
  assert.doesNotMatch(home, /<nav/);
  assert.match(header(home), /^<header>\s*<a href="\/">My blog<\/a>\s*<\/header>$/);
  assert.match(home, /<strong>About me</);
  assert.match(plain.read('feed.xml'), /<title>About me</);
  assert.match(plain.read('about/index.html'), /<p class="meta"><time/);
  assert.ok(!plain.has('til/index.html'));
});
