// Repoet starter — deliberately tiny (docs/domain/invisible-layers.md layer 9).
// Everything here belongs to YOU after creation. Publishing from Repoet writes
// only inside posts/** and blog.json; a template update you accept in Repoet
// writes this file and the other template files, and only while you have not
// edited them (see README.md).
import { copyFileSync, globSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { feedPlugin } from '@11ty/eleventy-plugin-rss';

import { resolvePermalinks, shortIdFromPath } from './_lib/permalinks.js';

/** A top-level scalar of a post's frontmatter, unquoted (simple by contract). */
function readScalar(text, key) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const m = fm && new RegExp(`^${key}:[ \\t]*(.+?)[ \\t]*$`, 'm').exec(fm[1]);
  return m ? m[1].replace(/^["']|["']$/g, '') : '';
}

/** Read the `slug:` scalar from a post's frontmatter. */
function readSlug(inputPath, text) {
  const dir = inputPath.split('/').slice(-2, -1)[0] ?? '';
  return readScalar(text, 'slug') || dir.split('-').slice(1).join('-') || dir;
}

/**
 * `draft: true` keeps a post off the site (docs/content-contract/frontmatter.md).
 * Anything that reads as yes counts, so a draft is never published by a
 * spelling: a draft published by mistake cannot be taken back.
 */
function isDraft(value) {
  return value === true || /^(true|yes|on)$/i.test(String(value ?? '').trim());
}

export default function (eleventyConfig) {
  const blog = JSON.parse(readFileSync(new URL('./blog.json', import.meta.url), 'utf-8'));
  eleventyConfig.addGlobalData('blog', blog);

  // The blog's absolute URL. The deploy workflow injects it (configure-pages
  // base_url), so custom domains just work and nothing goes stale. Empty in
  // local builds: absolute-URL features degrade gracefully.
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  eleventyConfig.addGlobalData('site', { url: siteUrl });

  // Atom feed — the distribution channel that matters for a developer blog.
  eleventyConfig.addPlugin(feedPlugin, {
    // The feed plugin registers Eleventy's HtmlBase plugin TWICE (itself and
    // via its inner rssPlugin) — with a real pathPrefix every root-relative
    // link got the prefix twice (/blog/blog/…; found 2026-08-30, the Tier 1
    // tests never built with a prefix). baseHref '/' disables its global
    // transform on both registrations; templates prefix once via `| url`,
    // and the FEED still absolutizes through its explicit per-render base.
    htmlBasePluginOptions: { baseHref: '/' },
    rssPluginOptions: { htmlBasePluginOptions: { baseHref: '/' } },
    type: 'atom',
    outputPath: '/feed.xml',
    collection: { name: 'posts', limit: 20 },
    metadata: {
      language: blog.language || 'en',
      title: blog.title,
      subtitle: blog.description || '',
      base: siteUrl ? `${siteUrl}/` : 'https://localhost/',
      author: { name: blog.author || blog.title },
    },
  });

  // Resolve slug collisions once, up front, so a duplicate slug never
  // hard-fails the build (docs/content-contract/post-identity.md). Posts read
  // their final URL slug from this map via posts.11tydata.js.
  // A draft takes no URL, so it never pushes a published post to a suffix.
  const posts = globSync('posts/**/index.md')
    .map((p) => ({ inputPath: p, text: readFileSync(p, 'utf-8') }))
    .filter(({ text }) => !isDraft(readScalar(text, 'draft')));
  const { urls, warnings } = resolvePermalinks(
    posts.map(({ inputPath, text }) => ({
      inputPath,
      slug: readSlug(inputPath, text),
      shortId: shortIdFromPath(inputPath),
    })),
  );
  for (const w of warnings) console.warn(`[repoet] ${w}`);
  // Key by a normalized suffix so posts.11tydata.js can match Eleventy's inputPath.
  const permalinkMap = {};
  for (const [inputPath, urlSlug] of urls) {
    permalinkMap[inputPath.replace(/^\.\//, '')] = urlSlug;
  }
  eleventyConfig.addGlobalData('permalinkMap', permalinkMap);

  // A draft is not built at all: no page, and it is in no list, feed,
  // sitemap or tag page. Its attachments stay unpublished too (below).
  eleventyConfig.addPreprocessor('drafts', 'md', (data) => (isDraft(data.draft) ? false : undefined));

  // A post folder holds one page, its index.md. Anything else in it is an
  // attachment, even when Eleventy could build it: an attached notes.md or
  // demo.html once became a second page at the post's address and failed the
  // build.
  eleventyConfig.ignores.add('posts/**/!(index).md');
  eleventyConfig.ignores.add('posts/**/*.{html,njk,liquid,11ty.js,11ty.cjs,11ty.mjs}');

  // Post attachments live beside index.md and are published beside the
  // post's page, wherever that page is (its slug, a collision suffix, a
  // changed slug or a hand-set permalink), so the relative links the app
  // writes (`![…](photo.jpg)`) open them. Copying them to their folder's path
  // (posts/2026/10/<id>-<slug>/) broke every photo on every blog (2026-10-05).
  // Attachments are the user's data: ALL of them, whatever the extension — a
  // fixed list silently dropped .fit files (2026-08-31).
  eleventyConfig.on('eleventy.after', ({ results, outputMode }) => {
    if (outputMode && outputMode !== 'fs') return;
    const pages = new Set(results.map((r) => r.outputPath).filter(Boolean).map((p) => normalize(String(p))));
    const written = new Map(); // site file -> the post folder it came from
    for (const { inputPath, outputPath } of results) {
      const source = String(inputPath).replace(/^\.\//, '');
      if (!outputPath || !/^posts\/.+\/index\.md$/.test(source)) continue;
      const from = dirname(source);
      const to = dirname(normalize(String(outputPath)));
      for (const file of attachmentsIn(from)) {
        const target = join(to, file);
        if (pages.has(target)) {
          console.warn(`[repoet] ${from}/${file} was not published: a page of the blog is at that address.`);
          continue;
        }
        if (written.has(target)) {
          console.warn(`[repoet] ${from}/${file} was not published: ${written.get(target)} has a file at that address.`);
          continue;
        }
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(from, file), target);
        written.set(target, from);
      }
    }
  });

  // The README documents the repository on GitHub; it is not a page of the
  // blog — and its code examples contain template syntax that must never be
  // executed by the build (found the hard way, 2026-08-31).
  eleventyConfig.ignores.add('README.md');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('fonts');
  eleventyConfig.addPassthroughCopy('favicon.svg'); // replace with your own — it is yours // self-hosted — the blog makes no third-party requests

  eleventyConfig.addFilter('isoDate', (value) => new Date(value).toISOString());

  // ——— Tier 2 SEO: link unfurls (PROGRESS, 2026-08-30) ———
  // The share image, zero-config: a post's first body image is usually the
  // right one. Frontmatter `image:` overrides; blog.json `socialImage` (a
  // root path like "/assets/social.png") is the site-wide fallback.
  eleventyConfig.addFilter('firstImage', (content) => {
    const m = /<img[^>]+src="([^"]+)"/.exec(content || '');
    return m ? m[1] : '';
  });
  // Crawlers ignore relative og:image/og:url — make repo paths absolute. A
  // root path is the blog's root; anything else is relative to the page, as
  // the browser reads it (the attachment sits beside the page, above).
  eleventyConfig.addFilter('absUrl', (src, pageUrl) => {
    if (!src || !siteUrl) return '';
    if (/^https?:\/\//.test(src)) return src;
    return src.startsWith('/') ? `${siteUrl}${src}` : new URL(src, `${siteUrl}${pageUrl}`).href;
  });
  // `</` must not terminate the script block a JSON-LD object lives in.
  eleventyConfig.addFilter('jsonld', (obj) =>
    JSON.stringify(obj).replaceAll('</', '<\\/'),
  );
  eleventyConfig.addFilter('readableDate', (value) =>
    new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(value),
    ),
  );

  eleventyConfig.addCollection('posts', (api) =>
    api
      .getFilteredByGlob('posts/**/index.md')
      .sort((a, b) => (a.data.date < b.data.date ? 1 : -1)),
  );

  // ——— Tier 3 SEO (PROGRESS, 2026-08-30) ———
  // A tag's address. Tags that differ only in case or punctuation ("Go",
  // "go") share one page: two pages at /tags/go/ failed the whole build
  // (2026-10-05). A tag with no Latin letters or digits ("日本語") keeps its
  // own letters; one with none at all ("🙂") gets no page.
  const slugify = eleventyConfig.getFilter('slugify');
  const tagSlug = (tag) =>
    slugify(String(tag)) ||
    String(tag).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  eleventyConfig.addFilter('tagSlug', tagSlug);

  // One entry per tag page: { name, slug, posts }, newest first — drives
  // /tags/<slug>/. The name is the spelling used most (the oldest post's on a
  // tie).
  eleventyConfig.addCollection('tagList', (api) => {
    const bySlug = new Map();
    const oldestFirst = api
      .getFilteredByGlob('posts/**/index.md')
      .sort((a, b) => (a.data.date < b.data.date ? -1 : 1));
    for (const post of oldestFirst) {
      const tags = [].concat(post.data.tags ?? []);
      const seen = new Set();
      for (const tag of tags) {
        const slug = tagSlug(tag);
        if (!slug) continue;
        if (!bySlug.has(slug)) bySlug.set(slug, { spellings: new Map(), posts: [] });
        const group = bySlug.get(slug);
        group.spellings.set(String(tag), (group.spellings.get(String(tag)) ?? 0) + 1);
        if (!seen.has(slug)) group.posts.push(post); // once, even when tagged Go and go
        seen.add(slug);
      }
    }
    return [...bySlug.entries()]
      .map(([slug, { spellings, posts }]) => ({
        name: [...spellings].reduce((best, s) => (s[1] > best[1] ? s : best))[0],
        slug,
        posts: posts.reverse(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // First image's alt — an og:image nobody can see still gets described.
  eleventyConfig.addFilter('firstImageAlt', (content) => {
    const m = /<img[^>]+alt="([^"]*)"/.exec(content || '');
    return m ? m[1] : '';
  });

  return {
    dir: { input: '.', includes: '_includes', output: '_site' },
    // A post is Markdown and nothing else. Run through Liquid (Eleventy's
    // default), `${{ secrets.TOKEN }}` in a code block published as `$`,
    // `{{ x }}` vanished and `{% if %}` in a sentence failed the build
    // (2026-10-05). Posts are exactly what you wrote.
    markdownTemplateEngine: false,
    // The URL is computed, never stored (docs/decisions/url-computed-not-stored.md):
    // GitHub's configure-pages action provides PATH_PREFIX per deploy.
    pathPrefix: process.env.PATH_PREFIX || '/',
  };
}

/** A post folder's attachments, as paths inside it: everything but its page. */
function attachmentsIn(folder, prefix = '') {
  const out = [];
  for (const entry of readdirSync(join(folder, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .DS_Store and the like
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // A folder that is a post of its own publishes at its own address.
      if (!readdirSync(join(folder, path)).includes('index.md')) out.push(...attachmentsIn(folder, path));
    } else if (path !== 'index.md') {
      out.push(path);
    }
  }
  return out;
}
