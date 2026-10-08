// The blog's menu: blog.json `menu`, a list of tags shown in the header, in
// order (Repoet's docs/decisions/blog-menu.md). A page needs no new concept:
// it is a tag that holds one post.
//
//   "menu": [
//     { "label": "About", "tag": "about", "home": false },
//     { "label": "TIL",   "tag": "til",   "path": "/til/" }
//   ]
//
// - A tag with one post links straight to that post; with several, to the
//   tag's list (at `path` if set, else /tags/<tag>/); with none, it is left
//   out of the header.
// - `home: false` keeps the tag's posts off the home list and out of the
//   feed. They keep their pages and stay in the sitemap. Its one post, if it
//   has only one, is shown as a page: no date, no tag line.
// - With no menu, nothing about the site changes.
//
// Pure, so it can be tested without a build.

/**
 * A menu address as the build writes it, "/til/", or null when the value
 * cannot be one. "til", "/til" and "til/" all mean "/til/"; "/", "..", "?",
 * "#", spaces and the like are refused (the list then stays at its tag page).
 */
export function menuPath(value) {
  if (typeof value !== 'string') return null;
  let path = value.trim();
  if (!path) return null;
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  const segments = path.slice(1, -1).split('/');
  const fine = (s) => s !== '' && s !== '.' && s !== '..' && /^[\p{L}\p{N}._~-]+$/u.test(s);
  return segments.every(fine) ? path : null;
}

/**
 * blog.json's `menu`, as entries the build can use, in their order, and a
 * warning for each it cannot. `tagSlug` is the tag comparison the tag pages
 * use, so "Go" and "go" are one tag here too.
 *
 * @returns {{ entries: { label: string, tag: string, slug: string, home: boolean, path: string | null }[], warnings: string[] }}
 */
export function readMenu(menu, tagSlug) {
  const entries = [];
  const warnings = [];
  if (menu === undefined || menu === null) return { entries, warnings };
  if (!Array.isArray(menu)) {
    warnings.push('blog.json: "menu" is not a list, so the header has no menu.');
    return { entries, warnings };
  }
  menu.forEach((item, i) => {
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    const raw = item?.tag;
    const tag = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
    const slug = tag ? tagSlug(tag) : '';
    if (!label || !slug) {
      warnings.push(`blog.json: menu entry ${i + 1} needs a "label" and a "tag", so it is left out.`);
      return;
    }
    const given = item.path;
    const asked = typeof given === 'string' ? given.trim() !== '' : given != null;
    const path = asked ? menuPath(given) : null;
    if (asked && !path) {
      warnings.push(
        `blog.json: the menu's "${label}" has the address ${JSON.stringify(given)}, which is not one like "/til/", so its list stays at /tags/${slug}/.`,
      );
    }
    entries.push({ label, tag, slug, home: item.home !== false, path });
  });
  return { entries, warnings };
}

/**
 * What the menu does to the posts. `posts` are the published posts, oldest
 * first, each with its tags as slugs.
 *
 * @param {ReturnType<typeof readMenu>['entries']} entries
 * @param {{ inputPath: string, tags: string[] }[]} posts
 * @returns {{
 *   items: (ReturnType<typeof readMenu>['entries'][number] & { posts: string[] })[],
 *   offHome: Set<string>,
 *   pages: Set<string>,
 * }}
 *   `items`: each entry with the input paths of its posts. `offHome`: the
 *   posts kept off the home list and the feed. `pages`: posts shown as a page.
 */
export function planMenu(entries, posts) {
  const items = entries.map((entry) => ({
    ...entry,
    posts: posts.filter((p) => p.tags.includes(entry.slug)).map((p) => p.inputPath),
  }));
  const offHome = new Set(items.filter((i) => !i.home).flatMap((i) => i.posts));
  const pages = new Set(items.filter((i) => !i.home && i.posts.length === 1).map((i) => i.posts[0]));
  return { items, offHome, pages };
}
