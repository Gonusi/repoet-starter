import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testSite } from './testSite.mjs';

// Tier 3 SEO (PROGRESS, 2026-08-30): earned, not required — tag pages,
// archive pagination, honest image alt, theme color, a 404 in the blog's own
// voice, and per-post noindex. Build-asserting, like the Tier 1/2 suite, in a
// throwaway copy with its own settings (testSite.mjs).

const SITE = 'https://example-owner.github.io/blog';
let site;
/** A hand-written `slug:` value, and the address its post is built at. */
const SLUGS = [
  ['2026-10-05', '2026-10-05'],
  ['007', '007'],
  ['1.50', '1.50'],
  ['1e3', '1e3'],
  ['~', '~'],
  ["'it''s'", "it''s"],
  ['zzx # note', 'zzx'], // a YAML comment is not part of the slug
];

function post(dir, fm, body = 'Body.') {
  site.write(`${dir}/index.md`, ['---', ...fm, '---', body, ''].join('\n'));
}

before(async () => {
  site = testSite();
  site.write('blog.json', JSON.stringify({
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
  site.write('posts/2026/08/zzt3-img/photo.jpg', 'notajpeg');
  // "Go" and "go" are one tag (two pages at /tags/go/ failed the build,
  // 2026-10-05), across posts and inside one post; "go" is the commoner spelling.
  post('posts/2026/08/zzt3-go-1', [
    'id: t3-go-1', 'title: Go one', 'slug: zzt3-go-1', 'date: 2026-08-10T10:00:00Z',
    'tags: [Go, go]',
  ]);
  post('posts/2026/08/zzt3-go-2', [
    'id: t3-go-2', 'title: Go two', 'slug: zzt3-go-2', 'date: 2026-08-11T10:00:00Z',
    'tags: [go]',
  ]);
  post('posts/2026/08/zzt3-go-3', [
    'id: t3-go-3', 'title: Go three', 'slug: zzt3-go-3', 'date: 2026-08-12T10:00:00Z',
    'tags: [GO, 日本語, 🙂]',
  ]);
  // A post is Markdown, never a template: Liquid once ate `{{ x }}` and a
  // `{% if %}` in a sentence failed the whole build (2026-10-05).
  post('posts/2026/08/zzt3-liquid', [
    'id: t3-liquid', 'title: Template syntax', 'slug: zzt3-liquid', 'date: 2026-08-13T10:00:00Z',
  ], [
    'In prose: {{ page.title }} and {% if user %}hello{% endif %}.',
    '',
    'Inline: `{{ x }}` and `{% y %}`.',
    '',
    '```yaml',
    'env:',
    '  TOKEN: ${{ secrets.TOKEN }}',
    '```',
  ].join('\n'));
  // `draft: true` keeps a post off the site (content-contract/frontmatter.md),
  // and it takes no URL: the published post with the same slug keeps its own.
  post('posts/2026/08/aaaa-zzt3-draft', [
    'id: t3-draft', 'title: Secret draft', 'slug: zzt3-public', 'draft: true',
    'date: 2026-08-14T10:00:00Z', 'tags: [secretdrafttag]',
  ], '![Draft photo](draft-photo.jpg)');
  site.write('posts/2026/08/aaaa-zzt3-draft/draft-photo.jpg', 'unpublished');
  post('posts/2026/08/zzzz-zzt3-public', [
    'id: t3-public', 'title: Public twin', 'slug: zzt3-public', 'date: 2026-08-15T10:00:00Z',
  ]);
  // A comment after draft: true is still a draft, and still takes no URL.
  post('posts/2026/08/aaab-zzt3-draft2', [
    'id: t3-draft2', 'title: Commented draft', 'slug: zzt3-pub2', 'draft: true # not yet',
    'date: 2026-08-17T10:00:00Z',
  ]);
  post('posts/2026/08/zzzz-zzt3-pub2', [
    'id: t3-pub2', 'title: Public two', 'slug: zzt3-pub2', 'date: 2026-08-18T10:00:00Z',
  ]);
  post('posts/2026/08/zzt3-draft-yes', [
    'id: t3-draft-yes', 'title: Secret yes draft', 'slug: zzt3-draft-yes', 'draft: "yes"',
    'date: 2026-08-16T10:00:00Z',
  ]);
  // Hand-written slugs keep the exact address they always had: the slug is
  // read as the text written, never as a YAML date, number or null (T1
  // re-review: reading it through the YAML parser moved these posts).
  SLUGS.forEach(([written], i) => {
    post(`posts/2026/06/sl${String(i).padStart(6, '0')}-folder-name-${i}`, [
      `id: t3-slug-${i}`, `title: Slug case ${i}`, `slug: ${written}`, 'date: 2026-06-01T10:00:00Z',
    ]);
  });
  // Enough posts to force a second archive page (page size 50).
  for (let i = 0; i < 52; i++) {
    post(`posts/2026/07/zzt3-filler-${String(i).padStart(2, '0')}`, [
      `id: t3-fill-${i}`, `title: Filler ${i}`, `slug: zzt3-filler-${String(i).padStart(2, '0')}`,
      `date: 2026-07-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
    ]);
  }
  // PATH_PREFIX matters here: tag/home links must survive project-page prefixes.
  await site.build({ SITE_URL: SITE, PATH_PREFIX: '/blog/' });
});

after(() => site?.dispose());

const read = (p) => site.read(p);

test('a tag gets its own page listing every post that carries it', () => {
  const page = read('tags/running/index.html');
  assert.match(page, /Tagged post/);
  assert.doesNotMatch(page, /Hidden post/);
});

test('tag URLs are slugs even when the tag has spaces and capitals', () => {
  assert.ok(site.has('tags/trail-shoes/index.html'));
});

test('a post links to its tag pages', () => {
  assert.match(read('zzt3-tagged/index.html'), /href="\/blog\/tags\/running\/"/);
});

test('the home page paginates instead of growing forever', () => {
  assert.ok(site.has('page/2/index.html'), 'second archive page exists');
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
  assert.ok(site.has('zzt3-hidden/index.html'));
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

test('tags that differ only in case share one page, named by the commoner spelling', () => {
  const page = read('tags/go/index.html');
  assert.match(page, /<h1>go<\/h1>/);
  for (const title of ['Go one', 'Go two', 'Go three']) assert.match(page, new RegExp(title));
  assert.equal(page.match(/Go one/g).length, 1, 'a post tagged Go and go is listed once');
  assert.match(read('zzt3-go-3/index.html'), /href="\/blog\/tags\/go\/">GO<\/a>/);
});

test('a tag in another script keeps its letters; one with none gets no page or link', () => {
  assert.ok(site.has('tags/日本語/index.html'));
  const html = read('zzt3-go-3/index.html');
  assert.match(html, /href="\/blog\/tags\/日本語\/">日本語<\/a>/);
  assert.match(html, /, 🙂<\/p>|, 🙂 ·/);
  assert.ok(!site.has('tags/index.html'), 'no page at /tags/ for an empty slug');
});

test('template syntax in a post is shown exactly as written, in prose and in code', () => {
  const html = read('zzt3-liquid/index.html');
  assert.match(html, /In prose: \{\{ page.title \}\} and \{% if user %\}hello\{% endif %\}\./);
  assert.match(html, /<code>\{\{ x \}\}<\/code> and <code>\{% y %\}<\/code>/);
  // The code block is coloured at build time: its words are split into
  // spans, and read without them.
  assert.match(html.replace(/<[^>]+>/g, ''), /TOKEN: \$\{\{ secrets.TOKEN \}\}/);
});

test('a draft is nowhere on the site: no page, list, feed, sitemap, tag or photo', () => {
  const everywhere = ['index.html', 'page/2/index.html', 'feed.xml', 'sitemap.xml']
    .map(read)
    .join('\n');
  assert.doesNotMatch(everywhere, /Secret draft|Secret yes draft/);
  assert.ok(!site.has('zzt3-draft-yes/index.html'));
  assert.ok(!site.has('tags/secretdrafttag/index.html'));
  assert.ok(!site.has('zzt3-public/draft-photo.jpg'));
  assert.ok(!site.has('posts/2026/08/aaaa-zzt3-draft/draft-photo.jpg'));
});

test('a draft takes no address: the published post with the same slug keeps the clean one', () => {
  assert.match(read('zzt3-public/index.html'), /Public twin/);
  assert.ok(!site.has('zzt3-public-zzzz/index.html'));
  assert.match(read('zzt3-pub2/index.html'), /Public two/, 'draft: true with a comment after it');
  assert.doesNotMatch(read('index.html'), /Commented draft/);
});

test('a hand-written slug keeps its address: dates, numbers, ~ and quotes stay the text written', () => {
  SLUGS.forEach(([written, address], i) => {
    assert.ok(site.has(`${address}/index.html`), `slug: ${written} → /${address}/`);
    assert.match(read(`${address}/index.html`), new RegExp(`Slug case ${i}<`), `slug: ${written}`);
  });
});
