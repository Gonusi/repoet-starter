import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testSite } from './testSite.mjs';

// A brand-new blog has zero posts. Pagination must still produce a home page
// — "wrote no index.html" was the actual behavior when pagination arrived
// (caught during Tier 3, 2026-08-30). The test makes its own emptiness in a
// throwaway copy (testSite.mjs): the app repo's contract harness runs this
// suite in a clone that HAS posts, and this blog's own posts are never moved.
test('an empty blog still gets a home page with the honest empty state', async () => {
  const site = testSite();
  try {
    site.remove('posts');
    await site.build({ SITE_URL: '', PATH_PREFIX: '/' });
    assert.ok(site.has('index.html'), 'index.html exists with zero posts');
    assert.match(site.read('index.html'), /No posts yet/);
  } finally {
    site.dispose();
  }
});
