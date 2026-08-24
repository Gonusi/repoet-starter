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
  eleventyConfig.addPassthroughCopy('posts/**/*.{jpg,jpeg,png,gif,svg,webp,pdf,zip,gpx,tcx,csv,json}');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('fonts');
  eleventyConfig.addPassthroughCopy('favicon.svg'); // replace with your own — it is yours // self-hosted — the blog makes no third-party requests

  eleventyConfig.addFilter('isoDate', (value) => new Date(value).toISOString());
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

  return {
    dir: { input: '.', includes: '_includes', output: '_site' },
    // The URL is computed, never stored (docs/decisions/url-computed-not-stored.md):
    // GitHub's configure-pages action provides PATH_PREFIX per deploy.
    pathPrefix: process.env.PATH_PREFIX || '/',
  };
}
