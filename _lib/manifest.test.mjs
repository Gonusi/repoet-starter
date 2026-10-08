// The manifest Repoet reads to update a blog file by file
// (Repoet's docs/decisions/template-updates.md, invariants 7 and 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { buildManifest, GROUPS, POSTS_DATA } from './manifest.mjs';

test('lists every template file by blob sha, and never the person’s settings, posts, favicon or itself', () => {
  const m = buildManifest({
    version: 'v2',
    files: { 'b.njk': 'b', 'a.njk': 'a', 'blog.json': 'x', 'favicon.svg': 'f', 'posts/p/index.md': 'p', '.repoet-template.json': 'm' },
    previous: null,
  });
  assert.deepEqual(m.files, { 'a.njk': 'a', 'b.njk': 'b' });
  assert.equal(m.removed, undefined);
});

test('the posts’ build settings are listed, though they live under posts/; no post ever is', () => {
  const m = buildManifest({
    version: 'v2',
    files: { [POSTS_DATA]: 'd', 'posts/2026/10/a-b/index.md': 'p', 'posts/other.11tydata.js': 'o' },
    previous: null,
  });
  assert.deepEqual(m.files, { 'posts/posts.11tydata.js': 'd' });
});

test('a renamed workflow is a removal and an add', () => {
  const m = buildManifest({
    version: 'v2',
    files: { '.github/workflows/pages.yml': 'p' },
    previous: { version: 'v1', files: { '.github/workflows/deploy.yml': 'd' } },
  });
  assert.deepEqual(Object.keys(m.files), ['.github/workflows/pages.yml']);
  assert.deepEqual(m.removed, ['.github/workflows/deploy.yml']);
});

test('removals keep growing, so a blog several versions behind still learns of them; a path back again is not removed', () => {
  const m = buildManifest({
    version: 'v3',
    files: { 'old.njk': 'o', 'c.njk': 'c' },
    previous: { version: 'v2', files: { 'c.njk': 'c', 'b.njk': 'b' }, removed: ['old.njk', 'gone.njk'] },
  });
  assert.deepEqual(m.removed, ['b.njk', 'gone.njk']);
});

// A case-insensitive filesystem cannot hold Base.njk and base.njk, and a
// blog's update would see both at once: rename in two steps, two versions.
test('a rename that changes only letter case is refused, saying how to do it in two steps', () => {
  assert.throws(
    () =>
      buildManifest({
        version: 'v2',
        files: { '_includes/base.njk': 'b' },
        previous: { version: 'v1', files: { '_includes/Base.njk': 'B' } },
      }),
    /_includes\/Base\.njk → _includes\/base\.njk changes only letter case\. Rename it in two steps, one per template version: first to another name \(say _includes\/base-1\.njk\), then to _includes\/base\.njk\./,
  );
});

test('a path removed long ago, back in other case, is refused the same way', () => {
  assert.throws(
    () =>
      buildManifest({
        version: 'v3',
        files: { 'Old.njk': 'o' },
        previous: { version: 'v2', files: {}, removed: ['old.njk'] },
      }),
    /changes only letter case/,
  );
});

test('names the files that only work together', () => {
  assert.deepEqual(buildManifest({ version: 'v', files: {}, previous: null }).groups, GROUPS);
  assert.deepEqual(GROUPS[0].slice(0, 3), ['package.json', 'package-lock.json', 'eleventy.config.js']);
  // The config's own code and the page that needs its collections go with it:
  // a kept config beside a new menu-lists.njk would fail the build.
  for (const path of ['_lib/addresses.js', '_lib/highlight.js', '_lib/menu.js', '_lib/permalinks.js', 'menu-lists.njk']) {
    assert.ok(GROUPS[0].includes(path), path);
  }
});

// A layout or page that reads a filter the kept config lacks fails the
// build; an old layout names a font file a new version removed. Every file
// the build reads is in the group, and the group names no file the template
// never had.
test('every file the build reads goes with the config: its code, every page and layout, the posts’ settings, the fonts', () => {
  const root = new URL('../', import.meta.url);
  const at = (dir) => (existsSync(new URL(dir, root)) ? readdirSync(new URL(dir, root)) : []);
  const builds = [
    ...at('./').filter((n) => n.endsWith('.njk')),
    ...at('_includes/').filter((n) => n.endsWith('.njk')).map((n) => `_includes/${n}`),
    ...at('_lib/').filter((n) => n.endsWith('.js')).map((n) => `_lib/${n}`),
    ...at('fonts/').filter((n) => n.endsWith('.woff2')).map((n) => `fonts/${n}`),
    POSTS_DATA,
  ];
  for (const path of builds) assert.ok(GROUPS[0].includes(path), `${path} is not in the build group`);
  const manifest = JSON.parse(readFileSync(new URL('.repoet-template.json', root), 'utf-8'));
  for (const path of GROUPS[0]) {
    const known = existsSync(new URL(path, root)) || path in manifest.files || (manifest.removed ?? []).includes(path);
    assert.ok(known, `${path} is in the group but the template has no such file`);
  }
});
