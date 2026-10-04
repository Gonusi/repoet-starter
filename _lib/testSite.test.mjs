import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { sweepStaleCopies, testSite } from './testSite.mjs';

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

test('a test site builds its own posts; none of them land in this blog', async () => {
  const site = testSite();
  try {
    site.write('posts/2026/08/zzsite-probe/index.md', [
      '---', 'id: site-probe', 'title: Site probe', 'slug: zzsite-probe',
      'date: 2026-08-24T10:00:00Z', '---', 'Body.', '',
    ].join('\n'));
    await site.build({ SITE_URL: '', PATH_PREFIX: '/' });
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

// A test run killed outright (SIGKILL, a closed terminal) cannot remove its
// copy, and copies piled up in the system's temporary folder (2026-10-04).
test('a copy is named for the test process that made it', () => {
  const site = testSite();
  try {
    assert.match(site.dir.split('/').pop(), new RegExp(`^repoet-test-site-${process.pid}-`));
  } finally {
    site.dispose();
  }
});

test('a copy whose test process is gone is removed when a test site is made', () => {
  const orphan = testSite(); // stands for the copy of a run killed outright
  sweepStaleCopies({ isAlive: (pid) => pid !== process.pid });
  assert.ok(!existsSync(orphan.dir));
});

test('a copy whose test process is still running is left alone', () => {
  const site = testSite();
  try {
    sweepStaleCopies();
    assert.ok(existsSync(site.dir));
  } finally {
    site.dispose();
  }
});

// Builds that never ended once outlived a stopped test run: 54 of them ran
// for 8 hours, deaf to SIGTERM (2026-09-27). This Eleventy config starts a
// second process, writes both process ids to `pids`, ignores SIGTERM and
// never finishes; with `fail` it throws instead, leaving the second process
// running. Module names are built so the check below does not read the
// config's own imports as this file's.
const CHILD_PROCESS = ['node', 'child_process'].join(':');
function neverEndingConfig({ fail = false } = {}) {
  return `import { spawn } from '${CHILD_PROCESS}';
import { writeFileSync } from '${['node', 'fs'].join(':')}';
export default async function () {
  process.on('SIGTERM', () => {});
  const helper = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: 'ignore' });
  writeFileSync('pids', JSON.stringify([process.pid, helper.pid]));
  ${fail ? "helper.unref();\n  throw new Error('this config fails on purpose');" : 'setInterval(() => {}, 1000);\n  await new Promise(() => {});'}
}
`;
}

function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** The processes of `pids` still running after up to 5 s. */
async function stillRunning(pids) {
  for (let i = 0; i < 50 && pids.some(running); i++) await new Promise((r) => setTimeout(r, 100));
  return pids.filter(running);
}

/** The build's two processes, once its config has written them. */
async function buildPids(site) {
  const file = `${site.dir}/pids`;
  for (let i = 0; i < 150 && !existsSync(file); i++) await new Promise((r) => setTimeout(r, 100));
  return JSON.parse(readFileSync(file, 'utf-8'));
}

test('a build that never ends is stopped with everything it started, and the test fails fast', { timeout: 30_000 }, async () => {
  const site = testSite();
  try {
    site.write('eleventy.config.js', neverEndingConfig());
    const started = Date.now();
    await assert.rejects(site.build({}, { timeoutMs: 5000 }), /did not finish in 5 s and was stopped/);
    assert.ok(Date.now() - started < 15_000, 'the build is stopped at its time limit');
    assert.deepEqual(await stillRunning(await buildPids(site)), []);
  } finally {
    site.dispose();
  }
});

test('a failed build stops everything it started', { timeout: 30_000 }, async () => {
  const site = testSite();
  try {
    site.write('eleventy.config.js', neverEndingConfig({ fail: true }));
    await assert.rejects(site.build({}, { timeoutMs: 20_000 }), /The build failed/);
    assert.deepEqual(await stillRunning(await buildPids(site)), []);
  } finally {
    site.dispose();
  }
});

// When the tests die, even by SIGKILL, the system closes the build's input;
// closing it here is the same event.
test('a build whose tests are gone stops with everything it started', { timeout: 30_000 }, async () => {
  const site = testSite();
  try {
    site.write('eleventy.config.js', neverEndingConfig());
    let closeInput;
    const build = site.build({}, { timeoutMs: 20_000, onStart: (b) => (closeInput = b.closeInput) });
    const pids = await buildPids(site);
    const closed = Date.now();
    closeInput();
    await assert.rejects(build, /The build failed/);
    assert.ok(Date.now() - closed < 10_000, 'stopped on closing, not at the time limit');
    assert.deepEqual(await stillRunning(pids), []);
  } finally {
    site.dispose();
  }
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
