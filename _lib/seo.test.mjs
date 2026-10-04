import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testSite } from './testSite.mjs';

// SEO baseline (PROGRESS: Tier 1, 2026-08-24). These tests BUILD the site and
// assert what a crawler actually receives — the head used to contain only
// charset/viewport/title, which is a broken blog as far as search, feed
// readers and link previews are concerned. They build a throwaway copy with
// their own settings, so this blog's blog.json is never touched (testSite.mjs).

const SITE = 'https://example-owner.github.io/blog';
const POST_DIR = 'posts/2026/08/zzseo-probe';
const IMG_POST_DIR = 'posts/2026/08/zzseo-image';
const FMIMG_POST_DIR = 'posts/2026/08/zzseo-fmimg';
let site, indexHtml, postHtml, imagePostHtml, fmImagePostHtml, feedXml, sitemapXml, robotsTxt;

before(() => {
  site = testSite();
  site.write('blog.json', JSON.stringify({
    title: 'Probe blog',
    description: 'Small notes about running',
    language: 'lt',
    author: 'Kasparas',
    showDescription: true,
  }, null, 2));
  site.write(`${POST_DIR}/index.md`, [
    '---', 'id: seo-probe', 'title: Probe post', 'slug: zzseo-probe',
    'date: 2026-08-24T10:00:00+03:00', "description: 'One specific post summary'",
    '---', 'Body text.', '',
  ].join('\n'));
  // Image probes: one picks up the first body image, one overrides via frontmatter.
  site.write(`${IMG_POST_DIR}/photo.jpg`, 'notreallyajpeg');
  site.write(`${IMG_POST_DIR}/index.md`, [
    '---', 'id: seo-image', 'title: Image post', 'slug: zzseo-image',
    'date: 2026-08-25T10:00:00+03:00', '---', '![A photo](photo.jpg)', 'Body.', '',
  ].join('\n'));
  site.write(`${FMIMG_POST_DIR}/cover.png`, 'notreallyapng');
  site.write(`${FMIMG_POST_DIR}/index.md`, [
    '---', 'id: seo-fmimg', 'title: Cover post', 'slug: zzseo-fmimg',
    'date: 2026-08-26T10:00:00+03:00', 'image: cover.png', '---', '![Other](photo.jpg)', '',
  ].join('\n'));
  site.build({ SITE_URL: SITE });
  indexHtml = site.read('index.html');
  postHtml = site.read('zzseo-probe/index.html');
  imagePostHtml = site.read('zzseo-image/index.html');
  fmImagePostHtml = site.read('zzseo-fmimg/index.html');
  feedXml = site.has('feed.xml') ? site.read('feed.xml') : '';
  sitemapXml = site.has('sitemap.xml') ? site.read('sitemap.xml') : '';
  robotsTxt = site.has('robots.txt') ? site.read('robots.txt') : '';
});

after(() => site?.dispose());

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
  assert.ok(site.has('favicon.svg'), 'favicon.svg copied into the site');
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

// ——— Tier 2: how the blog looks when SHARED (PROGRESS, 2026-08-30) ———
// Link previews (Slack, iMessage, X, LinkedIn) read Open Graph; search reads
// JSON-LD. A developer blog lives or dies by how its links unfurl.

test('a post unfurls as an article: og:type, title, description, absolute url', () => {
  assert.match(postHtml, /<meta property="og:type" content="article">/);
  assert.match(postHtml, /<meta property="og:title" content="Probe post">/);
  assert.match(postHtml, /<meta property="og:description" content="One specific post summary">/);
  assert.match(postHtml, new RegExp(`<meta property="og:url" content="${SITE}/zzseo-probe/">`));
  assert.match(postHtml, /<meta property="og:site_name" content="Probe blog">/);
});

test('the home page unfurls as a website, not an article', () => {
  assert.match(indexHtml, /<meta property="og:type" content="website">/);
  assert.match(indexHtml, /<meta property="og:title" content="Probe blog">/);
});

test('published time is the post date; modified time only exists when the post says so', () => {
  // UTC, same convention as the visible <time datetime> (isoDate filter).
  assert.match(postHtml, /<meta property="article:published_time" content="2026-08-24T07:00:00.000Z">/);
  assert.doesNotMatch(postHtml, /article:modified_time/);
});

test('a post with no image says so honestly — no og:image pointing at nothing', () => {
  assert.doesNotMatch(postHtml, /og:image/);
  assert.match(postHtml, /<meta name="twitter:card" content="summary">/);
});

test('the first image in a post becomes its social image, absolute, and upgrades the card', () => {
  assert.match(imagePostHtml, new RegExp(`<meta property="og:image" content="${SITE}/zzseo-image/photo.jpg">`));
  assert.match(imagePostHtml, /<meta name="twitter:card" content="summary_large_image">/);
});

test('frontmatter image wins over the first image in the body', () => {
  assert.match(fmImagePostHtml, new RegExp(`<meta property="og:image" content="${SITE}/zzseo-fmimg/cover.png">`));
});

test('a post carries BlogPosting JSON-LD with headline, date and author', () => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(postHtml);
  assert.ok(m, 'post has a JSON-LD block');
  const ld = JSON.parse(m[1]);
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.headline, 'Probe post');
  assert.equal(ld.datePublished, '2026-08-24T07:00:00.000Z');
  assert.equal(ld.author['@type'], 'Person');
  assert.equal(ld.author.name, 'Kasparas');
});

test('the home page carries WebSite JSON-LD naming the author as a Person', () => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(indexHtml);
  assert.ok(m, 'home has a JSON-LD block');
  const ld = JSON.parse(m[1]);
  assert.equal(ld['@type'], 'WebSite');
  assert.equal(ld.author.name, 'Kasparas');
});

test('the author is on the page for readers, not only in machine metadata', () => {
  assert.match(postHtml, /<p class="meta">[\s\S]*Kasparas[\s\S]*<\/p>/);
});
