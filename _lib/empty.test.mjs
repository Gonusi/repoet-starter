import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';

// A brand-new blog has zero posts. Pagination must still produce a home page
// — "wrote no index.html" was the actual behavior when pagination arrived
// (caught during Tier 3, 2026-08-30).
test('an empty blog still gets a home page with the honest empty state', () => {
  rmSync('_site', { recursive: true, force: true });
  execSync('npx @11ty/eleventy', { env: { ...process.env, SITE_URL: '', PATH_PREFIX: '/' }, stdio: 'pipe' });
  assert.ok(existsSync('_site/index.html'), 'index.html exists with zero posts');
  assert.match(readFileSync('_site/index.html', 'utf-8'), /No posts yet/);
});
