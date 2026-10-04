import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { testSite } from './testSite.mjs';

// The build tests set their own blog.json and probe posts. They once wrote
// them into this blog and put the file back afterwards, so a run stopped
// halfway left the test settings behind, and they shipped to every blog made
// from the template (2026-09-27). They now work in a throwaway copy.

const blogJson = new URL('../blog.json', import.meta.url);

test('a test site gets its own settings; this blog’s blog.json stays as it was', () => {
  const before = readFileSync(blogJson, 'utf-8');
  const site = testSite();
  try {
    site.write('blog.json', JSON.stringify({ title: 'Test settings' }));
    assert.equal(readFileSync(blogJson, 'utf-8'), before);
    assert.match(readFileSync(`${site.dir}/blog.json`, 'utf-8'), /Test settings/);
  } finally {
    site.dispose();
  }
});

test('a test site never writes or removes outside its copy', () => {
  const before = readFileSync(blogJson, 'utf-8');
  const site = testSite();
  try {
    const parent = site.dir.split('/').filter(Boolean).map(() => '..').join('/');
    for (const path of ['../blog.json', `${parent}${blogJson.pathname}`, blogJson.pathname]) {
      assert.throws(() => site.write(path, '{"title":"Probe blog"}'), /outside the test site/, path);
      assert.throws(() => site.remove(path), /outside the test site/, path);
    }
    assert.equal(readFileSync(blogJson, 'utf-8'), before);
  } finally {
    site.dispose();
  }
});

test('a test site builds its own posts; none of them land in this blog', () => {
  const site = testSite();
  try {
    site.write('posts/2026/08/zzsite-probe/index.md', [
      '---', 'id: site-probe', 'title: Site probe', 'slug: zzsite-probe',
      'date: 2026-08-24T10:00:00Z', '---', 'Body.', '',
    ].join('\n'));
    site.build({ SITE_URL: '', PATH_PREFIX: '/' });
    assert.match(site.read('zzsite-probe/index.html'), /Site probe/);
    assert.ok(!existsSync(new URL('../posts/2026/08/zzsite-probe', import.meta.url)));
    assert.ok(!existsSync(new URL('../_site/zzsite-probe', import.meta.url)));
  } finally {
    site.dispose();
  }
});

test('a finished test site leaves nothing behind', () => {
  const site = testSite();
  site.dispose();
  assert.ok(!existsSync(site.dir));
});

// Only testSite.mjs writes files or runs the build. A test that did either
// itself could write into this blog again, so each test may only read. The
// check reads the test sources: a tripwire for an honest mistake, not a
// sandbox against a test that hides what it loads.
const READS = new Set(['existsSync', 'readFileSync', 'readdirSync', 'statSync']);
const TOOLS = String.raw`(?:node:)?(fs|fs/promises|child_process|module)`;
const STATIC = new RegExp(String.raw`import\s+([^'";]+?)\s+from\s+['"]${TOOLS}['"]`, 'g');
const DYNAMIC = new RegExp(String.raw`\b(?:import|require|getBuiltinModule)\s*\(\s*['"]${TOOLS}['"]`, 'g');

/** Why this test source may write files or run a build itself; empty when it only reads. */
function writesOrBuilds(source) {
  const why = [];
  const tool = (module) =>
    module === 'child_process'
      ? 'runs the build itself'
      : module === 'module'
        ? 'may load any module (createRequire)'
        : `may write files through ${module}`;
  for (const [, clause, module] of source.matchAll(STATIC)) {
    if (module !== 'fs') {
      why.push(tool(module));
      continue;
    }
    const named = /^\{([^}]*)\}$/.exec(clause.trim());
    if (!named) {
      why.push(`takes all of fs (${clause.trim()})`);
      continue;
    }
    for (const name of named[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
      if (!READS.has(name)) why.push(`takes ${name} from fs`);
    }
  }
  for (const [, module] of source.matchAll(DYNAMIC)) why.push(tool(module));
  return why;
}

test('no test writes into this blog: the only file tools a test takes from Node read', () => {
  const lib = new URL('./', import.meta.url);
  for (const name of readdirSync(lib).filter((n) => n.endsWith('.test.mjs'))) {
    const why = writesOrBuilds(readFileSync(new URL(name, lib), 'utf-8'));
    assert.deepEqual(why, [], `${name}: write and build through testSite() instead`);
  }
});

// The samples name the module through a variable, so this file itself
// passes the check above.
const FS = ['node', 'fs'].join(':');
const writes = (load) => `${load}\nfs.writeFileSync('blog.json', '{"title":"Probe blog"}');\n`;

test('a test that takes all of node:fs to write blog.json is caught, however it imports it', () => {
  for (const load of [
    `import fs from '${FS}';`,
    `import fs from '${FS.slice(5)}';`,
    `import * as fs from "${FS}";`,
    `import fs, { readFileSync } from '${FS}';`,
    `import {\n  readFileSync,\n  writeFileSync,\n} from '${FS}';`,
    `const fs = await import('${FS}');`,
    `const fs = require("${FS.slice(5)}");`,
    `const fs = process.getBuiltinModule('${FS}');`,
    `import { createRequire } from '${['node', 'module'].join(':')}';`,
  ]) {
    assert.notDeepEqual(writesOrBuilds(writes(load)), [], load);
  }
});

test('a test that takes a writing tool by name, or renames one, is caught; reading tools pass', () => {
  assert.deepEqual(writesOrBuilds(`import { writeFileSync as put } from '${FS}';`), ['takes writeFileSync from fs']);
  assert.deepEqual(writesOrBuilds(`import { rmSync } from "${FS}";`), ['takes rmSync from fs']);
  assert.deepEqual(writesOrBuilds(`import { promises } from '${FS}';`), ['takes promises from fs']);
  assert.deepEqual(writesOrBuilds(`import { readFileSync as read, existsSync } from '${FS}';`), []);
});
