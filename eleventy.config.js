// Repoet starter — deliberately tiny (docs/domain/invisible-layers.md layer 9).
// Everything here belongs to YOU after creation; Repoet only writes inside
// posts/** and blog.json (docs/content-contract/repository-layout.md).
import { readFileSync, globSync } from 'node:fs';
import { feedPlugin } from '@11ty/eleventy-plugin-rss';

import { resolvePermalinks, shortIdFromPath } from './_lib/permalinks.js';

/** Read the `slug:` scalar from a post's frontmatter (simple by contract). */
function readSlug(inputPath) {
  const text = readFileSync(inputPath, 'utf-8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const m = fm && /^slug:[ \t]*(.+?)[ \t]*$/m.exec(fm[1]);
  const dir = inputPath.split('/').slice(-2, -1)[0] ?? '';
  return (m && m[1].replace(/^["']|["']$/g, '')) || dir.split('-').slice(1).join('-') || dir;
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
  const postPaths = globSync('posts/**/index.md');
  const { urls, warnings } = resolvePermalinks(
    postPaths.map((p) => ({ inputPath: p, slug: readSlug(p), shortId: shortIdFromPath(p) })),
  );
  for (const w of warnings) console.warn(`[repoet] ${w}`);
  // Key by a normalized suffix so posts.11tydata.js can match Eleventy's inputPath.
  const permalinkMap = {};
  for (const [inputPath, urlSlug] of urls) {
    permalinkMap[inputPath.replace(/^\.\//, '')] = urlSlug;
  }
  eleventyConfig.addGlobalData('permalinkMap', permalinkMap);

  // Post attachments live beside index.md and are copied through untouched.
  // Attachments are the user's data: copy ALL of them, whatever the extension
  // — a fixed list silently dropped .fit files and anything else it hadn't
  // foreseen (2026-08-31). Only the markdown itself is a template.
  eleventyConfig.addPassthroughCopy('posts/**/*.!(md)');
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
  // Crawlers ignore relative og:image/og:url — make repo paths absolute.
  eleventyConfig.addFilter('absUrl', (src, pageUrl) => {
    if (!src || !siteUrl) return '';
    if (/^https?:\/\//.test(src)) return src;
    return src.startsWith('/') ? `${siteUrl}${src}` : `${siteUrl}${pageUrl}${src}`;
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
  // One entry per tag: [name, posts…], newest first — drives /tags/<slug>/.
  eleventyConfig.addCollection('tagList', (api) => {
    const byTag = new Map();
    for (const post of api.getFilteredByGlob('posts/**/index.md')) {
      for (const tag of post.data.tags ?? []) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push(post);
      }
    }
    return [...byTag.entries()]
      .map(([name, posts]) => ({
        name,
        posts: posts.sort((a, b) => (a.data.date < b.data.date ? 1 : -1)),
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
    // The URL is computed, never stored (docs/decisions/url-computed-not-stored.md):
    // GitHub's configure-pages action provides PATH_PREFIX per deploy.
    pathPrefix: process.env.PATH_PREFIX || '/',
  };
}
