import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';

// A post's attachments are the USER'S data — the build copies all of them,
// whatever their extension. The old fixed extension list silently dropped
// anything it hadn't foreseen: a .fit activity file committed fine and then
// didn't exist on the site (found designing custom fields, 2026-08-31).

const DIR = 'posts/2026/08/zzattach-probe';

before(() => {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(`${DIR}/index.md`, ['---', 'id: attach-probe', 'title: Attach probe',
    'slug: zzattach-probe', 'date: 2026-08-27T10:00:00Z', '---', 'Body.', ''].join('\n'));
  writeFileSync(`${DIR}/ride.fit`, 'FITBYTES');
  writeFileSync(`${DIR}/notes.unknownext`, 'whatever the user attached');
  writeFileSync(`${DIR}/photo.jpg`, 'jpegbytes');
  execSync('npx @11ty/eleventy', { env: { ...process.env, SITE_URL: '', PATH_PREFIX: '/' }, stdio: 'pipe' });
});

after(() => rmSync(DIR, { recursive: true, force: true }));

test('every attachment beside a post is copied to the site, whatever its extension', () => {
  assert.ok(existsSync(`_site/${DIR}/ride.fit`), '.fit copied');
  assert.ok(existsSync(`_site/${DIR}/notes.unknownext`), 'unknown extension copied');
  assert.ok(existsSync(`_site/${DIR}/photo.jpg`), 'images still copied');
});

test('the markdown source itself is not doubled into the output as a raw file', () => {
  assert.ok(!existsSync(`_site/${DIR}/index.md`), 'index.md is a template, not an attachment');
});
