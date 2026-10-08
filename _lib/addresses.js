// Every address the build writes, decided before it starts, so that two
// things claiming one address never fail the whole build. Like a duplicate
// slug (docs/content-contract/post-identity.md), a clash keeps building, logs
// a warning, and the later claimant gets an adjusted address.
//
// Who comes first:
//   1. the site's own pages and files (home, tag pages, feed, sitemap, 404,
//      fonts, favicon, pages of your own outside posts/);
//   2. posts with a hand-set `permalink:`, earliest folder first;
//   3. posts at their slug, with duplicate slugs settled as before
//      (resolvePermalinks: the earliest folder keeps the clean address);
//   4. menu lists at their `path`, in menu order. A list whose path is
//      taken stays at its tag page, /tags/<tag>/.
// A post that loses gets `-<short id>` before its address's end
// (/about/ → /about-1a2b3c4d/, /notes.html → /notes-1a2b3c4d.html).
//
// Two hand-set permalinks at one address once failed the whole build, and so
// did a slug at a page's address. A blog that builds today keeps every
// address it has: only claims that used to fail are adjusted.
//
// Pure, so it can be tested without a build.

import { resolvePermalinks } from './permalinks.js';

/** The file an address writes: "/a/" → "a/index.html", "/feed.xml" → "feed.xml". */
export function outputOf(url) {
  let path = String(url).replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) path += 'index.html';
  return path;
}

/** An address with `-<suffix>` before its end: /a/ → /a-x/, /a.html → /a-x.html, /a → /a-x. */
export function withSuffix(url, suffix) {
  if (url === '/') return `/${suffix}/`;
  if (url.endsWith('/')) return `${url.slice(0, -1)}-${suffix}/`;
  const ext = /(\.[^./]+)$/.exec(url);
  return ext ? `${url.slice(0, -ext[1].length)}-${suffix}${ext[1]}` : `${url}-${suffix}`;
}

/**
 * The addresses taken so far. A claim fails on the same file, and also where
 * one address needs a folder another writes as a file (/feed.xml/ against
 * /feed.xml): the disk cannot hold both.
 */
export function addressBook() {
  const files = new Map(); // output file -> who holds it
  const folders = new Map(); // folder an output file sits in -> who made it
  return {
    /** Who already holds this address, or null, and then it is taken. */
    claim(url, who) {
      const out = outputOf(url);
      const there = files.get(out) ?? folders.get(out);
      if (there) return there;
      const parts = out.split('/');
      for (let i = 1; i < parts.length; i++) {
        const above = files.get(parts.slice(0, i).join('/'));
        if (above) return above;
      }
      files.set(out, who);
      for (let i = 1; i < parts.length; i++) {
        const folder = parts.slice(0, i).join('/');
        if (!folders.has(folder)) folders.set(folder, who);
      }
      return null;
    },
  };
}

const byPath = (a, b) => (a.inputPath < b.inputPath ? -1 : a.inputPath > b.inputPath ? 1 : 0);

/**
 * @param {{
 *   site: { url: string, what: string }[],
 *   posts: { inputPath: string, slug: string, shortId: string, permalink?: string | null }[],
 *   lists?: { url: string, what: string }[],
 * }} input
 *   `site`: the site's own pages and files. `posts`: the published posts;
 *   `permalink` is a hand-set address, or null for a hand-set one the build
 *   cannot know in advance (written with template code) or `false`: those
 *   are left as they are. `lists`: the menu lists' addresses.
 * @returns {{ slugs: Map<string, string>, permalinks: Map<string, string>, lists: (string | null)[], warnings: string[] }}
 *   `slugs`: each slug post's address as a slug (no slashes around it), as
 *   the posts' data file reads it. `permalinks`: hand-set addresses that had
 *   to change. `lists`: each list's address, or null where it was taken.
 */
export function resolveAddresses({ site, posts, lists = [] }) {
  const book = addressBook();
  const warnings = [];
  for (const page of site) book.claim(page.url, page.what);

  /** The first free address from `url` on: url, then url-2, url-3… */
  const firstFree = (url, who) => {
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? url : withSuffix(url, String(n));
      if (!book.claim(candidate, who)) return candidate;
    }
  };

  const permalinks = new Map();
  for (const post of posts.filter((p) => typeof p.permalink === 'string').sort(byPath)) {
    const wanted = post.permalink.startsWith('/') ? post.permalink : `/${post.permalink}`;
    const there = book.claim(wanted, post.inputPath);
    if (!there) continue;
    const url = firstFree(withSuffix(wanted, post.shortId), post.inputPath);
    permalinks.set(post.inputPath, url);
    warnings.push(`${post.inputPath} asks for ${wanted}, which is ${there}'s address, so it is built at ${url}.`);
  }

  // Duplicate slugs are settled among all published posts, as they always
  // were, hand-set permalinks included: no post that has an address today
  // moves.
  const settled = resolvePermalinks(posts);
  warnings.push(...settled.warnings);
  const slugs = new Map();
  for (const post of posts.filter((p) => p.permalink === undefined).sort(byPath)) {
    const slug = settled.urls.get(post.inputPath);
    const there = book.claim(`/${slug}/`, post.inputPath);
    if (!there) {
      slugs.set(post.inputPath, slug);
      continue;
    }
    const url = firstFree(withSuffix(`/${slug}/`, post.shortId), post.inputPath);
    slugs.set(post.inputPath, url.slice(1, -1));
    warnings.push(`${post.inputPath} has the slug "${slug}", but /${slug}/ is ${there}'s address, so it is built at ${url}.`);
  }

  const listUrls = lists.map((list) => {
    const there = book.claim(list.url, list.what);
    if (!there) return list.url;
    warnings.push(`${list.what} asks for ${list.url}, which is ${there}'s address, so the list stays at its tag page.`);
    return null;
  });

  return { slugs, permalinks, lists: listUrls, warnings };
}
