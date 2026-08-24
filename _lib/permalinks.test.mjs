// Run: node --test  (from starter/). The starter's first test — pins the
// contract rule that a duplicate slug must never hard-fail the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePermalinks, shortIdFromPath } from './permalinks.js';

test('a unique slug keeps its clean URL', () => {
  const { urls, warnings } = resolvePermalinks([
    { inputPath: './posts/2026/08/aaaa1111-hello/index.md', slug: 'hello', shortId: 'aaaa1111' },
  ]);
  assert.equal(urls.get('./posts/2026/08/aaaa1111-hello/index.md'), 'hello');
  assert.equal(warnings.length, 0);
});

test('duplicate slugs never collide: earliest path keeps clean URL, others suffixed', () => {
  const { urls, warnings } = resolvePermalinks([
    { inputPath: './posts/2026/09/bbbb2222-hello/index.md', slug: 'hello', shortId: 'bbbb2222' },
    { inputPath: './posts/2026/08/aaaa1111-hello/index.md', slug: 'hello', shortId: 'aaaa1111' },
  ]);
  assert.equal(urls.get('./posts/2026/08/aaaa1111-hello/index.md'), 'hello');
  assert.equal(urls.get('./posts/2026/09/bbbb2222-hello/index.md'), 'hello-bbbb2222');
  assert.equal(warnings.length, 1); // warned, not fatal
});

test('the clean-URL owner is stable regardless of input order (immutable path)', () => {
  const a = { inputPath: './posts/2026/08/aaaa1111-x/index.md', slug: 'x', shortId: 'aaaa1111' };
  const b = { inputPath: './posts/2026/09/bbbb2222-x/index.md', slug: 'x', shortId: 'bbbb2222' };
  const first = resolvePermalinks([a, b]).urls.get(a.inputPath);
  const second = resolvePermalinks([b, a]).urls.get(a.inputPath);
  assert.equal(first, 'x');
  assert.equal(second, 'x');
});

test('shortIdFromPath reads the directory prefix', () => {
  assert.equal(shortIdFromPath('./posts/2026/08/aaaa1111-hello/index.md'), 'aaaa1111');
});
