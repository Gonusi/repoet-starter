import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';

// Tier 3 SEO (PROGRESS, 2026-08-30): earned, not required — tag pages,
// archive pagination, honest image alt, theme color, a 404 in the blog's own
// voice, and per-post noindex. Build-asserting, like the Tier 1/2 suite.

const SITE = 'https://example-owner.github.io/blog';
const DIRS = [];
let blogJsonBackup;

function post(dir, fm, body = 'Body.') {
  mkdirSync(dir, { recursive: true });
  DIRS.push(dir);
  writeFileSync(`${dir}/index.md`, ['---', ...fm, '---', body, ''].join('\n'));
}

before(() => {
  blogJsonBackup = readFileSync('blog.json', 'utf-8');
  writeFileSync('blog.json', JSON.stringify({
    title: 'Probe blog', description: 'Notes', language: 'en', author: 'Kasparas',
  }, null, 2));
  post('posts/2026/08/zzt3-tagged', [
    'id: t3-tagged', 'title: Tagged post', 'slug: zzt3-tagged',
    'date: 2026-08-20T10:00:00Z', 'tags:', '  - running', '  - Trail Shoes',
  ]);
  post('posts/2026/08/zzt3-hidden', [
    'id: t3-hidden', 'title: Hidden post', 'slug: zzt3-hidden',
    'date: 2026-08-21T10:00:00Z', 'noindex: true',
  ]);
  post('posts/2026/08/zzt3-img', [
    'id: t3-img', 'title: Image post', 'slug: zzt3-img',
    'date: 2026-08-22T10:00:00Z',
  ], '![A muddy trail after rain](photo.jpg)');
  writeFileSync('posts/2026/08/zzt3-img/photo.jpg', 'notajpeg');
  // Enough posts to force a second archive page (page size 50).
  for (let i = 0; i < 52; i++) {
    post(`posts/2026/07/zzt3-filler-${String(i).padStart(2, '0')}`, [
      `id: t3-fill-${i}`, `title: Filler ${i}`, `slug: zzt3-filler-${String(i).padStart(2, '0')}`,
      `date: 2026-07-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
    ]);
  }
  // PATH_PREFIX matters here: tag/home links must survive project-page prefixes.
  execSync('npx @11ty/eleventy', { env: { ...process.env, SITE_URL: SITE, PATH_PREFIX: '/blog/' }, stdio: 'pipe' });
});

after(() => {
  writeFileSync('blog.json', blogJsonBackup);
  for (const d of DIRS) rmSync(d, { recursive: true, force: true });
});

const read = (p) => readFileSync(`_site/${p}`, 'utf-8');

test('a tag gets its own page listing every post that carries it', () => {
  const page = read('tags/running/index.html');
  assert.match(page, /Tagged post/);
  assert.doesNotMatch(page, /Hidden post/);
});

test('tag URLs are slugs even when the tag has spaces and capitals', () => {
  assert.ok(existsSync('_site/tags/trail-shoes/index.html'));
});

test('a post links to its tag pages', () => {
  assert.match(read('zzt3-tagged/index.html'), /href="\/blog\/tags\/running\/"/);
});

test('the home page paginates instead of growing forever', () => {
  assert.ok(existsSync('_site/page/2/index.html'), 'second archive page exists');
  assert.match(read('index.html'), /href="[^"]*\/page\/2\/"/);
});

test('the share image carries its alt text — an image nobody can see still gets described', () => {
  assert.match(read('zzt3-img/index.html'), /<meta property="og:image:alt" content="A muddy trail after rain">/);
});

test('browser chrome matches the paper', () => {
  assert.match(read('index.html'), /<meta name="theme-color" content="#f5f4f0">/);
});

test('a missing URL lands on a calm 404 with a way home, not a GitHub default', () => {
  const page = read('404.html');
  assert.match(page, /no page here/i);
  assert.match(page, /href="\/blog\/"/);
});

test('noindex keeps a post out of search and out of the sitemap, but it stays on the site', () => {
  assert.match(read('zzt3-hidden/index.html'), /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(read('sitemap.xml'), /zzt3-hidden/);
  assert.ok(existsSync('_site/zzt3-hidden/index.html'));
});

test('a project-page blog gets exactly ONE path prefix on every link', () => {
  // Found 2026-08-30: `| url` in templates AND the RSS plugin's HtmlBase
  // transform both prefixed, so live project-page blogs served
  // /blog/blog/… links. The transform owns prefixing; templates stay plain.
  const home = read('index.html');
  assert.doesNotMatch(home, /\/blog\/blog\//);
  assert.match(home, /href="\/blog\/favicon.svg"/);
  assert.match(home, /href="\/blog\/feed.xml"/);
  assert.doesNotMatch(read('zzt3-tagged/index.html'), /\/blog\/blog\//);
});
