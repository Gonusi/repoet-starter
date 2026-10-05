// The template's manifest, .repoet-template.json: which bytes a blog made
// from this template received, so Repoet can update it file by file without
// writing over anything the person changed (Repoet's
// docs/decisions/template-updates.md). Run after every commit that changes a
// template file, then commit the manifest on its own:
//
//   node _lib/manifest.mjs
//
// `files`: every tracked file except blog.json, favicon.svg, posts/** and the
// manifest, by git blob sha. `removed`: every path an earlier version listed
// and this one does not, kept growing, so a blog several versions behind
// still learns of it; a rename is a removal and an add. `groups`: files that
// only work together, updated together or not at all.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export const MANIFEST = '.repoet-template.json';

/** Files that only work together: a config that needs a new dependency needs the package files that bring it. */
export const GROUPS = [['package.json', 'package-lock.json', 'eleventy.config.js']];

/** A path the manifest never lists: the person's settings, posts and favicon, and the manifest itself. */
export function isTemplateFile(path) {
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
