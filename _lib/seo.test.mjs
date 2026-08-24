import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';

// SEO baseline (PROGRESS: Tier 1, 2026-08-24). These tests BUILD the site and
// assert what a crawler actually receives — the head used to contain only
// charset/viewport/title, which is a broken blog as far as search, feed
// readers and link previews are concerned.

const SITE = 'https://example-owner.github.io/blog';
const POST_DIR = 'posts/2026/08/zzseo-probe';
let indexHtml, postHtml, feedXml, sitemapXml, robotsTxt, blogJsonBackup;

before(() => {
  blogJsonBackup = readFileSync('blog.json', 'utf-8');
  writeFileSync('blog.json', JSON.stringify({
    title: 'Probe blog',
    description: 'Small notes about running',
    language: 'lt',
    author: 'Kasparas',
    showDescription: true,
  }, null, 2));
  mkdirSync(POST_DIR, { recursive: true });
  writeFileSync(`${POST_DIR}/index.md`, [
    '---', 'id: seo-probe', 'title: Probe post', 'slug: zzseo-probe',
    'date: 2026-08-24T10:00:00+03:00', "description: 'One specific post summary'",
    '---', 'Body text.', '',
  ].join('\n'));
  execSync('npx @11ty/eleventy', { env: { ...process.env, SITE_URL: SITE }, stdio: 'pipe' });
  indexHtml = readFileSync('_site/index.html', 'utf-8');
  postHtml = readFileSync('_site/zzseo-probe/index.html', 'utf-8');
  feedXml = existsSync('_site/feed.xml') ? readFileSync('_site/feed.xml', 'utf-8') : '';
  sitemapXml = existsSync('_site/sitemap.xml') ? readFileSync('_site/sitemap.xml', 'utf-8') : '';
  robotsTxt = existsSync('_site/robots.txt') ? readFileSync('_site/robots.txt', 'utf-8') : '';
});

after(() => {
  writeFileSync('blog.json', blogJsonBackup);
  rmSync(POST_DIR, { recursive: true, force: true });
});

test('the page language comes from settings, never hardcoded English', () => {
  assert.match(indexHtml, /<html lang="lt">/);
});

test('a post uses its own description; the home page uses the blog description', () => {
  assert.match(postHtml, /<meta name="description" content="One specific post summary">/);
  assert.match(indexHtml, /<meta name="description" content="Small notes about running">/);
});

test('a post without its own description falls back to the blog description', () => {
  // the probe post HAS one — assert the fallback wiring exists in the layout
  const layout = readFileSync('_includes/layout.njk', 'utf-8');
  assert.match(layout, /description or blog\.description/);
});

test('every page declares its canonical URL', () => {
  assert.match(indexHtml, new RegExp(`<link rel="canonical" href="${SITE}/">`));
  assert.match(postHtml, new RegExp(`<link rel="canonical" href="${SITE}/zzseo-probe/">`));
});

test('the feed exists, is valid-looking Atom, and is autodiscoverable', () => {
  assert.match(feedXml, /<feed/);
  assert.match(feedXml, /Probe post/);
  assert.match(indexHtml, /<link rel="alternate" type="application\/atom\+xml"/);
});

test('sitemap lists the post with an absolute URL; robots points at the sitemap', () => {
  assert.match(sitemapXml, new RegExp(`${SITE}/zzseo-probe/`));
  assert.match(robotsTxt, new RegExp(`Sitemap: ${SITE}/sitemap.xml`));
});

test('a favicon ships and is referenced', () => {
  assert.ok(existsSync('_site/favicon.svg'), 'favicon.svg copied into the site');
  assert.match(indexHtml, /<link rel="icon"/);
});

test('post dates are machine-readable', () => {
  assert.match(postHtml, /<time datetime="2026-08-24/);
});

test('the description appears beside the blog title when the setting is on', () => {
  assert.match(indexHtml, /class="tagline"[^>]*>Small notes about running/);
});

test('author is declared', () => {
  assert.match(postHtml, /<meta name="author" content="Kasparas">/);
});
