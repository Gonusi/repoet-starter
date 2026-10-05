// A throwaway copy of this blog for the tests that build it. They write their
// own blog.json and probe posts into the copy, never into the blog itself, so
// a test run stopped halfway leaves nothing here to commit. Writing the real
// blog.json and putting it back afterwards once left the test settings behind,
// and they shipped to every blog made from the template (2026-09-27).
//
// Every build has a time limit and runs in its own process group, which is
// stopped whole when the build times out, fails, finishes, or the tests stop,
// even when they are killed outright. Builds started through `npm exec` once
// outlived a stopped test run: 54 of them ran for 8 hours, deaf to SIGTERM
// (2026-09-27).
//
// Each copy is named for the test process that made it. Copies are removed
// when that process exits or is stopped by a signal; a copy whose process was
// killed outright is removed the next time a test site is made.
import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOG = fileURLToPath(new URL('..', import.meta.url));
/** Not part of the blog: git's own folder, installed packages and the last build. */
const LEFT_OUT = new Set(['.git', 'node_modules', '_site']);
/** Eleventy's own command, run by this Node: no npm process in between. */
const ELEVENTY = join(BLOG, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs');
/** A build of this blog takes seconds; one still running after this never ends. */
const BUILD_TIME_LIMIT_MS = 60_000;

// The first process of each build's group. It starts Eleventy in the same
// group, with no input, and stops the whole group when its own input closes:
// that happens when the tests are done with it or die for any reason,
// SIGKILL included.
const GUARD = `
const { spawn } = require('node:child_process');
const build = spawn(process.execPath, process.argv.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] });
const stopGroup = () => { try { process.kill(0, 'SIGKILL'); } catch {} };
process.stdin.on('end', stopGroup);
process.stdin.on('close', stopGroup);
process.stdin.resume();
build.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
`;

/** Builds still running, by process group. */
const running = new Set();
/** This process's copies not yet disposed. */
const copies = new Set();
/** A copy's folder name: the prefix, the pid of the test process that made it, a random part. */
const COPY = /^repoet-test-site-(\d+)-/;

function removeCopies() {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
  copies.clear();
}

/** Is that process still running? A process we may not signal is running too. */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/**
 * Remove the copies in the system's temporary folder whose test process is
 * gone: a run killed outright could not remove its own. Copies of a run still
 * going, and folders named any other way, are left alone.
 */
export function sweepStaleCopies({ isAlive = alive } = {}) {
  for (const name of readdirSync(tmpdir())) {
    const owner = COPY.exec(name);
    if (owner && !isAlive(Number(owner[1]))) rmSync(join(tmpdir(), name), { recursive: true, force: true });
  }
}

function stopGroup(pgid) {
  try {
    process.kill(-pgid, 'SIGKILL');
  } catch {
    /* already gone */
  }
}

// The tests stop: nothing they started keeps running. A signal is passed on
// afterwards, so the test process still ends as it would have.
process.on('exit', () => {
  running.forEach(stopGroup);
  removeCopies();
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    running.forEach(stopGroup);
    removeCopies();
    process.kill(process.pid, signal);
  });
}

/**
 * Run Eleventy in `dir`. Resolves when it succeeds; rejects when it fails or
 * outlives `timeoutMs`. Either way, everything it started is stopped first.
 * `onStart` gets the process group and a way to close the build's input, for
 * the tests of this helper and to stop a build started with `--watch`.
 * `args` are passed to Eleventy.
 */
function runBuild(dir, env, { timeoutMs = BUILD_TIME_LIMIT_MS, onStart, args = [] } = {}) {
  return new Promise((resolve, reject) => {
    const guard = spawn(process.execPath, ['-e', GUARD, ELEVENTY, ...args], {
      cwd: dir,
      env: { ...process.env, ...env },
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pgid = guard.pid;
    running.add(pgid);
    onStart?.({ pgid, closeInput: () => guard.stdin.destroy() });
    let output = '';
    guard.stdout.on('data', (d) => (output += d));
    guard.stderr.on('data', (d) => (output += d));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopGroup(pgid);
    }, timeoutMs);
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      stopGroup(pgid);
      running.delete(pgid);
      guard.stdin.destroy();
      if (error) reject(error);
      else resolve();
    };
    guard.on('error', finish);
    guard.on('close', (code, signal) => {
      if (timedOut) {
        finish(new Error(`The build did not finish in ${timeoutMs / 1000} s and was stopped.\n${output}`));
      } else if (code !== 0) {
        finish(new Error(`The build failed (${signal ?? `exit ${code}`}).\n${output}`));
      } else {
        finish();
      }
    });
  });
}

export function testSite() {
  sweepStaleCopies();
  const dir = mkdtempSync(join(tmpdir(), `repoet-test-site-${process.pid}-`));
  copies.add(dir);
  cpSync(BLOG, dir, {
    recursive: true,
    filter: (src) => !LEFT_OUT.has(relative(BLOG, src).split(sep)[0]),
  });
  // The packages are shared, not copied: the build finds them from the copy.
  symlinkSync(join(BLOG, 'node_modules'), join(dir, 'node_modules'), 'dir');
  /** A path inside the copy; anything that leads out of it is refused. */
  const at = (path) => {
    const full = resolve(dir, path);
    const inside = relative(dir, full);
    if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      throw new Error(`${path} is outside the test site; a test writes only into its copy`);
    }
    return full;
  };
  return {
    dir,
    /** Write a file into the copy, making its folders. */
    write(path, content) {
      mkdirSync(dirname(at(path)), { recursive: true });
      writeFileSync(at(path), content);
    },
    /** Make a symbolic link in the copy. The target may point anywhere: it is not written. */
    symlink(path, target) {
      mkdirSync(dirname(at(path)), { recursive: true });
      symlinkSync(target, at(path));
    },
    /** Remove a file or folder from the copy. */
    remove(path) {
      rmSync(at(path), { recursive: true, force: true });
    },
    /** Build the copy, as the deploy workflow builds the blog (runBuild). */
    build(env = {}, options) {
      return runBuild(dir, env, options);
    },
    /** A file of the built site. */
    read(path) {
      return readFileSync(join(dir, '_site', path), 'utf-8');
    },
    /** Whether the built site has this file. */
    has(path) {
      return existsSync(join(dir, '_site', path));
    },
    dispose() {
      rmSync(dir, { recursive: true, force: true });
      copies.delete(dir);
    },
  };
}
