import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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
  site.write('posts/2026/08/aaaa0001-lake/index.html', 'an attachment named like the page');

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
});

test('an attachment never replaces the post page it sits beside', () => {
  assert.match(site.read('lake/index.html'), /Sunrise over a calm lake/);
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
