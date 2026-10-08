// The template's manifest, .repoet-template.json: which bytes a blog made
// from this template received, so Repoet can update it file by file without
// writing over anything the person changed (Repoet's
// docs/decisions/template-updates.md). Run after every commit that changes a
// template file, then commit the manifest on its own:
//
//   node _lib/manifest.mjs
//
// `files`: every tracked file except blog.json, favicon.svg, posts/** and the
// manifest, by git blob sha; posts/posts.11tydata.js, the posts' build
// settings, is listed although it lives under posts/. `removed`: every path an earlier version listed
// and this one does not, kept growing, so a blog several versions behind
// still learns of it; a rename is a removal and an add. `groups`: files that
// only work together, updated together or not at all.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export const MANIFEST = '.repoet-template.json';

/**
 * Files that only work together: a config that needs a new dependency needs
 * the package files that bring it; the code it imports (_lib/*.js) and every
 * page and layout that reads its filters and collections need that config;
 * the layout names the font files. So a blog whose owner changed one of them
 * keeps all of them as they are, and never builds a new layout with an old
 * config (a filter it lacks fails the build) or an old layout without the
 * font file it names.
 */
export const GROUPS = [
  [
    'package.json',
    'package-lock.json',
    'eleventy.config.js',
    '_lib/addresses.js',
    '_lib/dates.js',
    '_lib/footer.js',
    '_lib/highlight.js',
    '_lib/markdown.js',
    '_lib/media.js',
    '_lib/menu.js',
    '_lib/permalinks.js',
    '_lib/text.js',
    '_includes/layout.njk',
    '_includes/post.njk',
    '_includes/post-row.njk',
    '404.njk',
    'feed.njk',
    'index.njk',
    'menu-lists.njk',
    'robots.njk',
    'sitemap.njk',
    'tags-index.njk',
    'tags.njk',
    'posts/posts.11tydata.js',
    'fonts/IBMPlexMono-400-italic-latin-ext.woff2',
    'fonts/IBMPlexMono-400-italic.woff2',
    'fonts/IBMPlexMono-400-normal-latin-ext.woff2',
    'fonts/IBMPlexMono-400-normal.woff2',
    'fonts/IBMPlexMono-600-normal-latin-ext.woff2',
    'fonts/IBMPlexMono-600-normal.woff2',
    'fonts/Literata-400-italic-latin-ext.woff2',
    'fonts/Literata-400-italic.woff2',
    'fonts/Literata-400-normal-latin-ext.woff2',
    'fonts/Literata-400-normal.woff2',
    'fonts/Literata-600-normal.woff2',
  ],
];

/** The posts' build settings: under posts/, but the template's, not a post. */
export const POSTS_DATA = 'posts/posts.11tydata.js';

/**
 * A path the manifest never lists: the person's settings, posts and favicon,
 * and the manifest itself. posts/posts.11tydata.js is listed, so a blog gets
 * its changes (Repoet writes it only once it knows the path; see README).
 */
export function isTemplateFile(path) {
  if (path === POSTS_DATA) return true;
  return path !== 'blog.json' && path !== 'favicon.svg' && path !== MANIFEST && !path.startsWith('posts/');
}

/**
 * The next manifest from the files a version ships (path → blob sha) and the
 * manifest before it (or null).
 */
export function buildManifest({ version, files, previous }) {
  const listed = Object.fromEntries(
    Object.entries(files)
      .filter(([path]) => isTemplateFile(path))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  const earlier = new Set([...(previous?.removed ?? []), ...Object.keys(previous?.files ?? {})]);
  const removed = [...earlier].filter((path) => !(path in listed)).sort();
  // A rename that changes only letter case is refused: a case-insensitive
  // filesystem cannot hold both names, and a blog's update would delete one
  // and see the other as the person's own file at once.
  for (const gone of removed) {
    const back = Object.keys(listed).find((path) => path.toLowerCase() === gone.toLowerCase());
    if (back) {
      const step = back.replace(/(\.[^./]+)?$/, (ext) => `-1${ext}`);
      throw new Error(
        `${gone} → ${back} changes only letter case. Rename it in two steps, one per template version: first to another name (say ${step}), then to ${back}.`,
      );
    }
  }
  return { version, files: listed, ...(removed.length > 0 ? { removed } : {}), groups: GROUPS };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const paths = git('ls-files').split('\n').filter(Boolean);
  const files = Object.fromEntries(paths.filter(isTemplateFile).map((p) => [p, git('rev-parse', `HEAD:${p}`)]));
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    /* the first manifest */
  }
  const date = new Date().toISOString().slice(0, 10);
  const manifest = buildManifest({ version: `${date}.${git('rev-parse', '--short', 'HEAD')}`, files, previous });
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${MANIFEST}: ${manifest.version}, ${Object.keys(manifest.files).length} files, ${manifest.removed?.length ?? 0} removed`);
}
