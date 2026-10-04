// A throwaway copy of this blog for the tests that build it. They write their
// own blog.json and probe posts into the copy, never into the blog itself, so
// a test run stopped halfway leaves nothing here to commit. Writing the real
// blog.json and putting it back afterwards once left the test settings behind,
// and they shipped to every blog made from the template (2026-09-27).
import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
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

export function testSite() {
  const dir = mkdtempSync(join(tmpdir(), 'repoet-test-site-'));
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
    /** Remove a file or folder from the copy. */
    remove(path) {
      rmSync(at(path), { recursive: true, force: true });
    },
    /** Build the copy, as the deploy workflow builds the blog. */
    build(env) {
      execSync('npx @11ty/eleventy', { cwd: dir, env: { ...process.env, ...env }, stdio: 'pipe' });
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
    },
  };
}
