import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testSite } from './testSite.mjs';

// A post's attachments are the USER'S data — the build publishes all of them,
// whatever their extension (a fixed list once dropped .fit files, 2026-08-31).
// And they must be where the post's own links point. The app writes
// `![…](photo.jpg)`, relative to the post page, and the page lives at
// /<slug>/, not at its folder posts/YYYY/MM/<id>-<slug>/. Copying files to
// their folder's path left every photo on every blog a 404 while a test that
// only checked "the file was copied" passed (2026-10-05). So these tests read
// each built post page, take its own address, resolve every link on it the
// way a browser does, under a project-page prefix, and open the file there.
// Built in a throwaway copy, so no probe post lands in this blog (testSite.mjs).

const SITE = 'https://example-owner.github.io/blog';
const PREFIX = '/blog/';
let site;

function post(dir, fm, body) {
  site.write(`${dir}/index.md`, ['---', ...fm, '---', body, ''].join('\n'));
}

before(async () => {
  site = testSite();
  // An ordinary post: a photo, an activity file, a PDF and an unknown type.
  post('posts/2026/08/aaaa0001-lake', [
    'id: a1', 'title: Lake', 'slug: lake', 'date: 2026-08-20T10:00:00Z',
  ], [
    '![Sunrise over a calm lake](img-0412.jpg)',
    '',
    '[My ride](ride.fit), [the map](route.pdf) and [notes](notes.unknownext).',
    '',
    '<img src="gallery/second.jpg" alt="Second">',
  ].join('\n'));
  site.write('posts/2026/08/aaaa0001-lake/img-0412.jpg', 'lake photo');
  site.write('posts/2026/08/aaaa0001-lake/ride.fit', 'FITBYTES');
  site.write('posts/2026/08/aaaa0001-lake/route.pdf', '%PDF lake route');
  site.write('posts/2026/08/aaaa0001-lake/notes.unknownext', 'whatever the user attached');
  site.write('posts/2026/08/aaaa0001-lake/gallery/second.jpg', 'second photo');
  // Files Eleventy could build as pages are attachments here too.
  site.write('posts/2026/08/aaaa0001-lake/notes.md', '# Raw notes {{ not.a.template }}');
  site.write('posts/2026/08/aaaa0001-lake/demo.html', '<p>{% raw %}demo</p>');
  site.write('posts/2026/08/aaaa0001-lake/notes (old) [v2].md', 'Older notes {{ x }}');
  // Named like the page, in other case: on a case-insensitive disk (macOS)
  // a copy once overwrote the page.
  site.write('posts/2026/08/aaaa0001-lake/INDEX.HTML', 'an attachment named like the page');
  // Symbolic links are never followed: one to a folder once stopped the whole
  // build (ENOTSUP on macOS), and one may point out of the post, even out of
  // the repository, into a public site.
  site.symlink('posts/2026/08/aaaa0001-lake/linked-gallery', 'gallery');
  site.symlink('posts/2026/08/aaaa0001-lake/settings.json', '../../../../blog.json');

  // Two posts with the same slug: the second gets /same-bbbb0002/
  // (post-identity.md). Each has its own photo.jpg, and each page must show
  // its own, never the other's.
  post('posts/2026/08/aaaa0002-same', [
    'id: a2', 'title: Same one', 'slug: same', 'date: 2026-08-21T10:00:00Z',
  ], '![First](photo.jpg)');
  site.write('posts/2026/08/aaaa0002-same/photo.jpg', 'photo of the first same');
  post('posts/2026/09/bbbb0002-same', [
    'id: b2', 'title: Same two', 'slug: same', 'date: 2026-09-21T10:00:00Z',
  ], '![Second](photo.jpg)');
  site.write('posts/2026/09/bbbb0002-same/photo.jpg', 'photo of the second same');

  // The slug was changed after the folder was named: the folder never moves.
  post('posts/2026/08/cccc0003-old-name', [
    'id: c3', 'title: Renamed', 'slug: new-name', 'date: 2026-08-22T10:00:00Z',
  ], '![Renamed](photo.jpg)');
  site.write('posts/2026/08/cccc0003-old-name/photo.jpg', 'photo of the renamed post');

  // A developer set the address by hand.
  post('posts/2026/08/dddd0004-custom', [
    'id: d4', 'title: Custom', 'slug: custom', 'permalink: /notes/custom-place/',
    'date: 2026-08-23T10:00:00Z',
  ], '![Custom](photo.jpg)');
  site.write('posts/2026/08/dddd0004-custom/photo.jpg', 'photo of the custom post');

  // A hand-set permalink that is a file, not a folder: its files would land at
  // the blog's root, where they must never replace the blog's own files.
  post('posts/2026/08/eeee0005-about', [
    'id: e5', 'title: About', 'slug: about', 'permalink: /about.html',
    'date: 2026-08-24T10:00:00Z',
  ], '![Me](me.jpg)');
  site.write('posts/2026/08/eeee0005-about/me.jpg', 'photo of me');
  site.write('posts/2026/08/eeee0005-about/favicon.svg', 'not the blog favicon');

  // Hand-made content outside post folders keeps working as it always did:
  // a single-file post, and a loose file published at its own path.
  site.write('posts/flat.md', ['---', 'title: Flat', 'date: 2026-08-25T10:00:00Z', '---',
    'A single-file post.', ''].join('\n'));
  site.write('posts/img/logo.png', 'a shared logo');

  await site.build({ SITE_URL: SITE, PATH_PREFIX: PREFIX });
});

after(() => site?.dispose());

/** The page's own address, as the browser has it (from its canonical link). */
function pageAddress(html) {
  const m = /<link rel="canonical" href="([^"]+)">/.exec(html);
  assert.ok(m, 'the post page names its own address');
  return m[1];
}

/** The built file a link on the page at `address` opens. */
function fileBehind(address, ref) {
  const url = new URL(ref, address);
  const root = new URL(SITE + '/');
  assert.equal(url.origin, root.origin, `${ref} stays on the blog`);
  assert.ok(url.pathname.startsWith(root.pathname), `${ref} stays under ${root.pathname}`);
  return decodeURIComponent(url.pathname.slice(root.pathname.length));
}

/** Every relative image and link in a built post, with the file each opens. */
function linksOn(pagePath) {
  const html = site.read(pagePath);
  const address = pageAddress(html);
  const article = /<article>([\s\S]*?)<\/article>/.exec(html)[1];
  return [...article.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => !ref.startsWith('/') && !/^[a-z]+:/.test(ref))
    .map((ref) => ({ ref, file: fileBehind(address, ref) }));
}

function opens(file, expected) {
  assert.ok(site.has(file), `${file} exists on the built site`);
  assert.equal(site.read(file), expected);
}

test('a photo in a post opens from the post page, under a project-page prefix', () => {
  const photo = linksOn('lake/index.html').find((l) => l.ref === 'img-0412.jpg');
  assert.ok(photo, 'the page links the photo relatively, as the app wrote it');
  assert.equal(photo.file, 'lake/img-0412.jpg');
  opens(photo.file, 'lake photo');
});

test('every attachment a post links, whatever its type, opens from the post page', () => {
  const files = Object.fromEntries(linksOn('lake/index.html').map((l) => [l.ref, l.file]));
  opens(files['ride.fit'], 'FITBYTES');
  opens(files['route.pdf'], '%PDF lake route');
  opens(files['notes.unknownext'], 'whatever the user attached');
  opens(files['gallery/second.jpg'], 'second photo');
});

test('two posts with the same slug each show their own photo at their own address', () => {
  const [first] = linksOn('same/index.html');
  const [second] = linksOn('same-bbbb0002/index.html');
  opens(first.file, 'photo of the first same');
  opens(second.file, 'photo of the second same');
});

test('a post whose slug changed shows its photo at the new address', () => {
  const [photo] = linksOn('new-name/index.html');
  assert.equal(photo.file, 'new-name/photo.jpg');
  opens(photo.file, 'photo of the renamed post');
});

test('a post with a hand-set permalink shows its photo at that address', () => {
  const [photo] = linksOn('notes/custom-place/index.html');
  opens(photo.file, 'photo of the custom post');
});

test('the share image (og:image) is an address where the photo really is', () => {
  const html = site.read('lake/index.html');
  const m = /<meta property="og:image" content="([^"]+)">/.exec(html);
  assert.ok(m, 'the post has a share image');
  opens(fileBehind(pageAddress(html), m[1]), 'lake photo');
});

test('a feed reader opens the photo too: the feed gives its full address', () => {
  const feed = site.read('feed.xml');
  const m = /&lt;img src=&quot;([^&]+)&quot; alt=&quot;Sunrise over a calm lake/.exec(feed);
  assert.ok(m, 'the feed carries the photo');
  opens(fileBehind(SITE + '/', m[1]), 'lake photo');
});

test('an attached .md or .html file is published as it is, not built as a second page', () => {
  opens('lake/notes.md', '# Raw notes {{ not.a.template }}');
  opens('lake/demo.html', '<p>{% raw %}demo</p>');
  opens('lake/notes (old) [v2].md', 'Older notes {{ x }}');
});

test('an attachment never replaces the post page it sits beside, whatever the case', () => {
  assert.match(site.read('lake/index.html'), /Sunrise over a calm lake/);
  assert.ok(!site.has('lake/INDEX.HTML') || /Sunrise/.test(site.read('lake/INDEX.HTML')));
});

test("an attachment never replaces the blog's own files, such as its favicon", () => {
  assert.equal(site.read('favicon.svg'), readFileSync(new URL('../favicon.svg', import.meta.url), 'utf-8'));
  opens(fileBehind(pageAddress(site.read('about.html')), 'me.jpg'), 'photo of me');
});

test('a symbolic link in a post folder is not followed, and the build still succeeds', () => {
  assert.ok(!site.has('lake/linked-gallery/second.jpg'), 'a linked folder is not published');
  assert.ok(!site.has('lake/linked-gallery'));
  assert.ok(!site.has('lake/settings.json'), 'a link out of the post is not published');
});

test('a single-file post under posts/ is still built at its own address', () => {
  assert.match(site.read('flat/index.html'), /A single-file post\./);
});

test('a file under posts/ outside any post folder is still published at its path', () => {
  opens('posts/img/logo.png', 'a shared logo');
});

test('the markdown source itself is not published as a raw file', () => {
  assert.ok(!site.has('lake/index.md'));
  assert.ok(!site.has('posts/2026/08/aaaa0001-lake/index.md'));
});

test('a photo is published once, at its post, not a second time at its folder path', () => {
  // A second copy at posts/… doubled every blog's size against GitHub Pages'
  // limit and was never an address the post linked.
  assert.ok(!site.has('posts/2026/08/aaaa0001-lake/img-0412.jpg'));
  assert.ok(!site.has('posts/posts.11tydata.js'), 'the build data file is not published');
});

// `npm run dev` rebuilds when a file changes. A photo is not a page, so
// Eleventy did not watch it, and a changed or added photo never reached the
// preview until something else changed.
test('while the blog is previewed with npm run dev, a changed or added attachment is published', { timeout: 60_000 }, async () => {
  const dev = testSite();
  const dir = 'posts/2026/08/ffff0006-dev';
  dev.write(`${dir}/index.md`, ['---', 'title: Dev', 'slug: dev', 'date: 2026-08-26T10:00:00Z', '---',
    '![Photo](photo.jpg)', ''].join('\n'));
  dev.write(`${dir}/photo.jpg`, 'first version');
  let stop = () => {};
  const watching = dev
    .build({ SITE_URL: '', PATH_PREFIX: '/' }, { args: ['--watch'], onStart: (b) => (stop = b.closeInput) })
    .catch(() => {}); // stopped on purpose below
  const until = async (ok, what) => {
    for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(ok(), what);
  };
  try {
    await until(() => dev.has('dev/photo.jpg') && dev.read('dev/photo.jpg') === 'first version', 'first build');
    await new Promise((r) => setTimeout(r, 1000)); // the watcher is ready
    dev.write(`${dir}/photo.jpg`, 'second version');
    dev.write(`${dir}/route.gpx`, 'a new file');
    await until(() => dev.read('dev/photo.jpg') === 'second version', 'the changed photo is published');
    await until(() => dev.has('dev/route.gpx'), 'the added file is published');
  } finally {
    stop();
    await watching;
    dev.dispose();
  }
});

// Which address an attachment may take, without a build: on macOS the disk
// cannot hold Photo.jpg and photo.jpg in one folder, so the rule is tested
// directly. The blog builds on Linux, where they are two files.
test('two attachments that differ only in case are both published; a page or blog file in any case is never replaced', async () => {
  const { siteFiles } = await import('../eleventy.config.js');
  const files = siteFiles();
  files.own('_site/lake/index.html', 'a page of the blog');
  files.own('_site/favicon.svg', 'a file of the blog');
  assert.equal(files.claim('_site/lake/Photo.jpg', 'posts/a/Photo.jpg'), null);
  assert.equal(files.claim('_site/lake/photo.jpg', 'posts/a/photo.jpg'), null);
  assert.equal(files.claim('_site/lake/photo.jpg', 'posts/b/photo.jpg'), 'posts/a/photo.jpg');
  assert.equal(files.claim('_site/lake/INDEX.HTML', 'posts/a/INDEX.HTML'), 'a page of the blog');
  assert.equal(files.claim('_site/Favicon.SVG', 'posts/about/Favicon.SVG'), 'a file of the blog');
});
