import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testSite } from './testSite.mjs';

// A post's attachments are the USER'S data — the build copies all of them,
// whatever their extension. The old fixed extension list silently dropped
// anything it hadn't foreseen: a .fit activity file committed fine and then
// didn't exist on the site (found designing custom fields, 2026-08-31). Built
// in a throwaway copy, so no probe post lands in this blog (testSite.mjs).

const DIR = 'posts/2026/08/zzattach-probe';
let site;

before(async () => {
  site = testSite();
  site.write(`${DIR}/index.md`, ['---', 'id: attach-probe', 'title: Attach probe',
    'slug: zzattach-probe', 'date: 2026-08-27T10:00:00Z', '---', 'Body.', ''].join('\n'));
  site.write(`${DIR}/ride.fit`, 'FITBYTES');
  site.write(`${DIR}/notes.unknownext`, 'whatever the user attached');
  site.write(`${DIR}/photo.jpg`, 'jpegbytes');
  await site.build({ SITE_URL: '', PATH_PREFIX: '/' });
});

after(() => site?.dispose());

test('every attachment beside a post is copied to the site, whatever its extension', () => {
  assert.ok(site.has(`${DIR}/ride.fit`), '.fit copied');
  assert.ok(site.has(`${DIR}/notes.unknownext`), 'unknown extension copied');
  assert.ok(site.has(`${DIR}/photo.jpg`), 'images still copied');
});

test('the markdown source itself is not doubled into the output as a raw file', () => {
  assert.ok(!site.has(`${DIR}/index.md`), 'index.md is a template, not an attachment');
});
