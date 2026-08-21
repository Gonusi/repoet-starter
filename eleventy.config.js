// Repoet starter — deliberately tiny (docs/domain/invisible-layers.md layer 9).
// Everything here belongs to YOU after creation; Repoet only writes inside
// posts/** and blog.json (docs/content-contract/repository-layout.md).
import { readFileSync } from 'node:fs';

export default function (eleventyConfig) {
  const blog = JSON.parse(readFileSync(new URL('./blog.json', import.meta.url), 'utf-8'));
  eleventyConfig.addGlobalData('blog', blog);

  // Post attachments live beside index.md and are copied through untouched.
  eleventyConfig.addPassthroughCopy('posts/**/*.{jpg,jpeg,png,gif,svg,webp,pdf,zip,gpx,tcx,csv,json}');
  eleventyConfig.addPassthroughCopy('assets');

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
