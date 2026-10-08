import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeLabel, menuPath, planMenu, readMenu, sectionOf, sectionsOf, tagLine } from './menu.js';
import { addressBook, outputOf, resolveAddresses, withSuffix } from './addresses.js';
import { resolvePermalinks } from './permalinks.js';

// The menu and the addresses, without a build. The build itself is tested in
// menu-site.test.mjs.

const slug = (tag) => String(tag).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

test('a menu address is a path between slashes; one that cannot be is refused', () => {
  assert.equal(menuPath('/til/'), '/til/');
  assert.equal(menuPath('til'), '/til/');
  assert.equal(menuPath(' /notes/til '), '/notes/til/');
  assert.equal(menuPath('/日記/'), '/日記/');
  for (const bad of ['/', '', '   ', '/../x/', '/a b/', '/til?x', '/til#x', '//x/', 'https://x.org/', 3, null]) {
    assert.equal(menuPath(bad), null, JSON.stringify(bad));
  }
});

test('the menu keeps its order; home is true unless it says false; tags compare as tag pages do', () => {
  const { entries, warnings } = readMenu(
    [
      { label: 'About', tag: 'about', home: false },
      { label: 'TIL', tag: 'TIL', path: 'til' },
      { label: 'Books', tag: 'books', home: 'no', note: 'kept by the person' },
    ],
    slug,
  );
  assert.deepEqual(
    entries.map((e) => [e.label, e.slug, e.home, e.path]),
    [
      ['About', 'about', false, null],
      ['TIL', 'til', true, '/til/'],
      ['Books', 'books', true, null],
    ],
  );
  assert.deepEqual(warnings, []);
});

test('no menu, or an empty one, is no menu and no warning', () => {
  assert.deepEqual(readMenu(undefined, slug), { entries: [], warnings: [] });
  assert.deepEqual(readMenu([], slug), { entries: [], warnings: [] });
});

test('a menu the build cannot use is left out with a warning, never a failed build', () => {
  assert.equal(readMenu({ about: 'about' }, slug).warnings.length, 1);
  const { entries, warnings } = readMenu(
    [{ label: 'No tag' }, { tag: 'nolabel' }, 'about', { label: 'Bad address', tag: 'x', path: '/a b/' }],
    slug,
  );
  assert.deepEqual(entries.map((e) => [e.label, e.path]), [['Bad address', null]]);
  assert.equal(warnings.length, 4);
  assert.match(warnings[3], /stays at \/tags\/x\//);
});

test('a home: false tag keeps its posts off the home page; its only post is a page', () => {
  const { entries } = readMenu(
    [
      { label: 'About', tag: 'about', home: false },
      { label: 'Books', tag: 'books', home: false },
      { label: 'TIL', tag: 'til' },
    ],
    slug,
  );
  const plan = planMenu(entries, [
    { inputPath: 'posts/a/index.md', tags: ['about'] },
    { inputPath: 'posts/b1/index.md', tags: ['books'] },
    { inputPath: 'posts/b2/index.md', tags: ['books', 'til'] },
    { inputPath: 'posts/t/index.md', tags: ['til'] },
  ]);
  assert.deepEqual(plan.items.map((i) => i.posts.length), [1, 2, 2]);
  assert.deepEqual([...plan.offHome].sort(), ['posts/a/index.md', 'posts/b1/index.md', 'posts/b2/index.md']);
  assert.deepEqual([...plan.pages], ['posts/a/index.md'], 'two books are a list, not a page; TIL stays on home');
});

test('an address writes a file; a folder address writes its index.html', () => {
  assert.equal(outputOf('/'), 'index.html');
  assert.equal(outputOf('/a/b/'), 'a/b/index.html');
  assert.equal(outputOf('/feed.xml'), 'feed.xml');
  assert.equal(withSuffix('/about/', '1a2b'), '/about-1a2b/');
  assert.equal(withSuffix('/notes.html', '1a2b'), '/notes-1a2b.html');
  assert.equal(withSuffix('/a/b', '1a2b'), '/a/b-1a2b');
  assert.equal(withSuffix('/', '1a2b'), '/1a2b/');
});

test('one address holds one thing, and a file and a folder cannot share a name', () => {
  const book = addressBook();
  assert.equal(book.claim('/x/', 'first'), null);
  assert.equal(book.claim('/x/', 'second'), 'first');
  assert.equal(book.claim('/feed.xml', 'the feed'), null);
  assert.equal(book.claim('/feed.xml/', 'a post'), 'the feed', 'feed.xml would have to be a folder');
  assert.equal(book.claim('/x', 'a file named x'), 'first', 'x is a folder already');
  assert.equal(book.claim('/x/y/', 'a page under x'), null, 'a page inside a folder page is fine');
});

const post = (inputPath, slugText, extra = {}) => ({
  inputPath,
  slug: slugText,
  shortId: inputPath.split('/').slice(-2, -1)[0].split('-')[0],
  ...extra,
});

test('a blog without clashes keeps exactly the addresses it had', () => {
  const posts = [
    post('posts/2026/08/aaaa0001-hello/index.md', 'hello'),
    post('posts/2026/09/bbbb0002-hello/index.md', 'hello'),
    post('posts/2026/09/cccc0003-x/index.md', 'x', { permalink: '/about/' }),
  ];
  const before = resolvePermalinks(posts).urls;
  const { slugs, permalinks, warnings } = resolveAddresses({ site: [{ url: '/', what: 'the home page' }], posts });
  assert.equal(slugs.get(posts[0].inputPath), before.get(posts[0].inputPath));
  assert.equal(slugs.get(posts[1].inputPath), 'hello-bbbb0002');
  assert.equal(slugs.has(posts[2].inputPath), false, 'a hand-set permalink is not a slug address');
  assert.equal(permalinks.size, 0);
  assert.equal(warnings.length, 1, 'only the duplicate slug, as before');
});

test('two hand-set permalinks at one address: the earlier folder keeps it, the later is adjusted', () => {
  const a = post('posts/2026/08/aaaa0001-a/index.md', 'a', { permalink: '/same/' });
  const b = post('posts/2026/09/bbbb0002-b/index.md', 'b', { permalink: 'same/' });
  const { permalinks, warnings } = resolveAddresses({ site: [], posts: [b, a] });
  assert.equal(permalinks.has(a.inputPath), false);
  assert.equal(permalinks.get(b.inputPath), '/same-bbbb0002/');
  assert.match(warnings.join('\n'), /bbbb0002-b\/index.md asks for \/same\/, which is posts\/2026\/08\/aaaa0001-a\/index.md's address/);
});

test('the site\'s own pages come first: a post at a page\'s address is adjusted', () => {
  const p = post('posts/2026/08/aaaa0001-about/index.md', 'about');
  const f = post('posts/2026/08/bbbb0002-feed/index.md', 'feed.xml');
  const h = post('posts/2026/08/cccc0003-x/index.md', 'x', { permalink: '/tags/go/' });
  const { slugs, permalinks } = resolveAddresses({
    site: [
      { url: '/about/', what: 'about.njk' },
      { url: '/feed.xml', what: 'the feed' },
      { url: '/tags/go/', what: 'the tag page /tags/go/' },
    ],
    posts: [p, f, h],
  });
  assert.equal(slugs.get(p.inputPath), 'about-aaaa0001');
  assert.equal(slugs.get(f.inputPath), 'feed.xml-bbbb0002');
  assert.equal(permalinks.get(h.inputPath), '/tags/go-cccc0003/');
});

test('a hand-set permalink comes before a slug; an unknown one is left alone', () => {
  const s = post('posts/2026/08/aaaa0001-about/index.md', 'about');
  const h = post('posts/2026/09/bbbb0002-me/index.md', 'me', { permalink: '/about/' });
  const d = post('posts/2026/09/cccc0003-d/index.md', 'd', { permalink: null });
  const { slugs, permalinks } = resolveAddresses({ site: [], posts: [s, h, d] });
  assert.equal(permalinks.has(h.inputPath), false);
  assert.equal(slugs.get(s.inputPath), 'about-aaaa0001');
  assert.equal(slugs.has(d.inputPath), false);
  assert.equal(permalinks.has(d.inputPath), false);
});

test('a menu list whose address is taken stays at its tag page', () => {
  const p = post('posts/2026/08/aaaa0001-til/index.md', 'til');
  const { lists, warnings } = resolveAddresses({
    site: [],
    posts: [p],
    lists: [
      { url: '/til/', what: 'the menu\'s "TIL" list' },
      { url: '/books/', what: 'the menu\'s "Books" list' },
    ],
  });
  assert.deepEqual(lists, [null, '/books/']);
  assert.match(warnings.join('\n'), /the menu's "TIL" list asks for \/til\/, which is posts\/2026\/08\/aaaa0001-til\/index.md's address/);
});

// The section a post belongs to (views critique 2026-10-08: H1, L3, T2).
const items = planMenu(
  readMenu(
    [
      { label: 'About', tag: 'about', home: false },
      { label: 'Book Reviews', tag: 'books', path: '/books/' },
      { label: 'TIL', tag: 'til' },
    ],
    slug,
  ).entries,
  [
    { inputPath: 'a', tags: ['about'] },
    { inputPath: 'b1', tags: ['books', 'til'] },
    { inputPath: 'b2', tags: ['books'] },
    { inputPath: 't1', tags: ['til'] },
  ],
).items;
const sections = sectionsOf(items, (i) => i.path ?? `/tags/${i.slug}/`);

test('a section is a menu entry that lists several posts, at its list’s address; a page is not one', () => {
  assert.deepEqual(sections, [
    { slug: 'books', label: 'Book Reviews', url: '/books/', home: true },
    { slug: 'til', label: 'TIL', url: '/tags/til/', home: true },
  ]);
});

test('a post belongs to the first section, in menu order, whose tag it carries', () => {
  assert.equal(sectionOf(sections, ['til', 'books']).label, 'Book Reviews');
  assert.equal(sectionOf(sections, ['til']).label, 'TIL');
  assert.equal(sectionOf(sections, ['about', 'go']), null);
});

test('the way home reads "All" while every list is on the home page, "Home" once one is kept off it', () => {
  assert.equal(homeLabel(sections), 'All');
  assert.equal(homeLabel([...sections, { slug: 'notes', label: 'Notes', url: '/tags/notes/', home: false }]), 'Home');
});

test('a tag line names a section’s tag as the menu does, links each tag once, and keeps the post’s order', () => {
  const line = tagLine(['British', 'books', 'Books', 'go', '🙂'], { tagSlug: slug, sections, homes: { go: '/golang/' } });
  assert.deepEqual(line, [
    { label: 'British', url: '/tags/british/' },
    { label: 'Book Reviews', url: '/books/' },
    { label: 'go', url: '/golang/' },
    { label: '🙂', url: null },
  ]);
  assert.deepEqual(tagLine(undefined, { tagSlug: slug }), []);
  assert.deepEqual(tagLine('solo', { tagSlug: slug }), [{ label: 'solo', url: '/tags/solo/' }]);
});

test('a page the site adds only where nothing is (the list of tags) never moves a post or a list', () => {
  const free = resolveAddresses({ site: [], posts: [], extras: [{ url: '/tags/', what: 'the list of tags' }] });
  assert.deepEqual(free.extras, ['/tags/']);
  const post = { inputPath: 'posts/2026/10/aaaa1111-tags/index.md', slug: 'tags', shortId: 'aaaa1111' };
  const taken = resolveAddresses({ site: [], posts: [post], extras: [{ url: '/tags/', what: 'the list of tags' }] });
  assert.deepEqual(taken.extras, [null]);
  assert.equal(taken.slugs.get(post.inputPath), 'tags', 'the post keeps /tags/');
  assert.deepEqual(taken.warnings, []);
  const list = resolveAddresses({ site: [], posts: [], lists: [{ url: '/tags/', what: 'a list' }], extras: [{ url: '/tags/', what: 'x' }] });
  assert.deepEqual([list.lists, list.extras], [['/tags/'], [null]]);
});
