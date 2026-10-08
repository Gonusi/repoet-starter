// Repoet starter — deliberately tiny (docs/domain/invisible-layers.md layer 9).
// Everything here belongs to YOU after creation. Publishing from Repoet writes
// only inside posts/** and blog.json; a template update you accept in Repoet
// writes this file and the other template files, and only while you have not
// edited them (see README.md).
import { copyFileSync, existsSync, globSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { rssPlugin } from '@11ty/eleventy-plugin-rss';
import matter from 'gray-matter';
import { imageSize } from 'image-size';

import { resolveAddresses } from './_lib/addresses.js';
import { dateFormat } from './_lib/dates.js';
import { footerHtml } from './_lib/footer.js';
import { configureMarkdown } from './_lib/markdown.js';
import { fitMedia } from './_lib/media.js';
import { homeLabel, planMenu, readMenu, sectionOf, sectionsOf, tagLine } from './_lib/menu.js';
import { shortIdFromPath } from './_lib/permalinks.js';
import { excerpt, firstSentence, noteTitle, plainText } from './_lib/text.js';

/**
 * A post's slug: the `slug:` line of its frontmatter as written, else the
 * folder name after the short id. Read as text, never through YAML's types:
 * `slug: 2026-10-05` is /2026-10-05/, not a date, and `007`, `1.50`, `1e3`,
 * `~` and `'it''s'` keep the addresses they always had. Only a trailing
 * ` # comment` is dropped, as YAML drops it.
 */
export function slugOf(inputPath, text) {
  const dir = inputPath.split('/').slice(-2, -1)[0] ?? '';
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const line = fm && /^slug:[ \t]*(.+?)[ \t]*$/m.exec(fm[1]);
  let slug = '';
  if (line) {
    const quoted = /^(["'])(.*)\1(?:[ \t]+#.*)?$/.exec(line[1]);
    slug = quoted ? quoted[2] : line[1].replace(/[ \t]+#.*$/, '').replace(/^["']|["']$/g, '');
  }
  return slug || dir.split('-').slice(1).join('-') || dir;
}

/** Files Eleventy would build as pages. Inside a post folder they are attachments. */
const PAGE_FILE = /\.(md|html|njk|liquid|11ty\.[cm]?js)$/i;
/** Eleventy's own data files (posts/posts.11tydata.js): never published. */
const DATA_FILE = /\.11tydata\.([cm]?js|json)$/i;

/**
 * `draft: true` keeps a post off the site (docs/content-contract/frontmatter.md).
 * Anything that reads as yes counts, so a draft is never published by a
 * spelling: a draft published by mistake cannot be taken back.
 */
function isDraft(value) {
  return value === true || /^(true|yes|on)$/i.test(String(value ?? '').trim());
}

export default function (eleventyConfig) {
  const blog = JSON.parse(readFileSync(new URL('./blog.json', import.meta.url), 'utf-8'));
  eleventyConfig.addGlobalData('blog', blog);

  // The footer under every page (blog.json "footer", _lib/footer.js): one
  // line of inline Markdown, HTML off. Missing: Repoet's credit; "": none.
  const footer = footerHtml(blog.footer, { language: blog.language });
  if (footer.warning) console.warn(`[repoet] ${footer.warning}`);
  eleventyConfig.addGlobalData('footerHtml', footer.html);

  // The blog's absolute URL. The deploy workflow injects it (configure-pages
  // base_url), so custom domains just work and nothing goes stale. Empty in
  // local builds: absolute-URL features degrade gracefully.
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  eleventyConfig.addGlobalData('site', { url: siteUrl });

  // Atom feed — the distribution channel that matters for a developer blog.
  // Written by feed.njk: the newest 20 posts of the home list, an untitled
  // note titled with its own opening words. The feed plugin's own template
  // took the oldest 20 (it expects its collection oldest first), so from the
  // 21st post on a new post never reached subscribers, and an untitled note
  // was an empty <title> (views critique, 2026-10-08). Its ids are the ones
  // the plugin wrote, so no reader sees an old post as new.
  // The plugin's filters stay: Eleventy's HtmlBase plugin with baseHref '/',
  // so templates prefix links once via `| url` (a real pathPrefix once got
  // it twice, /blog/blog/…, 2026-08-30), and the feed makes its links
  // absolute through its explicit per-render base.
  eleventyConfig.addPlugin(rssPlugin, { htmlBasePluginOptions: { baseHref: '/' } });
  eleventyConfig.addGlobalData('feed', {
    base: siteUrl ? `${siteUrl}/` : 'https://localhost/',
    author: blog.author || blog.title,
  });
  eleventyConfig.addFilter('head', (items, n) => [].concat(items ?? []).slice(0, n));

  // A tag's address. Tags that differ only in case or punctuation ("Go",
  // "go") share one page: two pages at /tags/go/ failed the whole build
  // (2026-10-05). A tag with no Latin letters or digits ("日本語") keeps its
  // own letters; one with none at all ("🙂") gets no page. The menu compares
  // its tags the same way.
  const slugify = eleventyConfig.getFilter('slugify');
  const tagSlug = (tag) =>
    slugify(String(tag)) ||
    String(tag).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  eleventyConfig.addFilter('tagSlug', tagSlug);
  const tagSlugsOf = (tags) => [...new Set([].concat(tags ?? []).map(tagSlug).filter(Boolean))];

  // Every post's address, decided once, up front, so a clash never
  // hard-fails the build (_lib/addresses.js; docs/content-contract/post-identity.md):
  // duplicate slugs, two hand-set permalinks, a slug at a page's address, a
  // menu list at a post's. Posts read their final URL slug from
  // permalinkMap via posts.11tydata.js; a hand-set permalink that had to move
  // is changed below (the 'addresses' preprocessor).
  // `draft` is read by the same parser, with the same options, as the build:
  // `draft: true # not yet` is a draft here as on the page. A draft takes no
  // URL, so it never pushes a published post to a suffix. The slug is read as
  // text (slugOf).
  const frontmatter = (text) => {
    try {
      const { data } = matter(text, eleventyConfig.frontMatterParsingOptions);
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {}; // the build reports a broken frontmatter itself
    }
  };
  const posts = globSync('posts/**/index.md')
    .sort()
    .map((p) => {
      const text = readFileSync(p, 'utf-8');
      return { inputPath: p, text, data: frontmatter(text) };
    })
    .filter(({ data }) => !isDraft(data.draft));

  // The menu (blog.json `menu`, _lib/menu.js): which posts it keeps off the
  // home list and the feed, and which it shows as a page.
  const menu = readMenu(blog.menu, tagSlug);
  for (const w of menu.warnings) console.warn(`[repoet] ${w}`);
  const plan = planMenu(
    menu.entries,
    posts.map(({ inputPath, data }) => ({ inputPath, tags: tagSlugsOf(data.tags) })),
  );
  const lists = plan.items.filter((i) => i.path && i.posts.length > 0 && i.path !== `/tags/${i.slug}/`);

  const homeCount = posts.filter((p) => !plan.offHome.has(p.inputPath)).length;
  const addresses = resolveAddresses({
    site: [
      { url: '/', what: 'the home page' },
      { url: '/feed.xml', what: 'the feed' }, // made by the feed plugin, not a page here
      ...Array.from({ length: Math.max(0, Math.ceil(homeCount / 50) - 1) }, (_, i) => ({
        url: `/page/${i + 2}/`,
        what: `page ${i + 2} of the home list`,
      })),
      ...[...new Set(posts.flatMap(({ data }) => tagSlugsOf(data.tags)))].map((slug) => ({
        url: `/tags/${slug}/`,
        what: `the tag page /tags/${slug}/`,
      })),
      ...ownPages(frontmatter),
      ...['favicon.svg', ...filesIn('fonts'), ...filesIn('assets')]
        .filter((f) => existsSync(f))
        .map((f) => ({ url: `/${f}`, what: f })),
    ],
    posts: posts.map(({ inputPath, text, data }) => ({
      inputPath,
      slug: slugOf(inputPath, text),
      shortId: shortIdFromPath(inputPath),
      ...('permalink' in data ? { permalink: knownPermalink(data.permalink) } : {}),
    })),
    lists: lists.map((i) => ({ url: i.path, what: `the menu's "${i.label}" list` })),
    extras: [{ url: '/tags/', what: 'the list of tags' }],
  });
  for (const w of addresses.warnings) console.warn(`[repoet] ${w}`);
  // Key by a normalized suffix so posts.11tydata.js can match Eleventy's inputPath.
  const permalinkMap = {};
  for (const [inputPath, urlSlug] of addresses.slugs) {
    permalinkMap[inputPath.replace(/^\.\//, '')] = urlSlug;
  }
  eleventyConfig.addGlobalData('permalinkMap', permalinkMap);
  eleventyConfig.addPreprocessor('addresses', 'md', (data) => {
    const moved = addresses.permalinks.get(String(data.page?.inputPath ?? '').replace(/^\.\//, ''));
    if (moved) data.permalink = moved;
  });
  const listUrl = new Map(lists.map((item, i) => [item, addresses.lists[i]]));
  // The list of every tag, at /tags/ only while nothing else is there
  // (tags-index.njk): a post at /tags/ keeps it.
  eleventyConfig.addGlobalData('tagsIndex', addresses.extras[0] ? [{ url: addresses.extras[0] }] : []);

  // The menu's sections: entries that list several posts (_lib/menu.js). A
  // post in one is marked as being there: its menu item, its tag line, its
  // row on the home list.
  const sections = sectionsOf(plan.items, (i) => listUrl.get(i) ?? `/tags/${i.slug}/`);
  eleventyConfig.addFilter('sectionOf', (tags) => sectionOf(sections, tagSlugsOf(tags)));

  // The header's menu, in order: a tag with one post links to it, one with
  // several to its list, one with none is left out. While the menu has a
  // list, "All" comes first and links home: a reader in /til/ otherwise had
  // only the blog's name to get back to every post (owner, 2026-10-08). Pages
  // alone (About) leave the header as it was.
  const key = (inputPath) => String(inputPath).replace(/^\.\//, '');
  eleventyConfig.addCollection('menu', (api) => {
    const byPath = new Map(api.getFilteredByGlob('posts/**/index.md').map((p) => [key(p.inputPath), p]));
    const links = plan.items
      .filter((i) => i.posts.length > 0)
      .map((i) => ({
        label: i.label,
        url: i.posts.length === 1 ? byPath.get(i.posts[0])?.url : (listUrl.get(i) ?? `/tags/${i.slug}/`),
        list: i.posts.length > 1,
      }))
      .filter((link) => typeof link.url === 'string');
    return links.some((link) => link.list) ? [{ label: homeLabel(sections), url: '/', list: true }, ...links] : links;
  });
  // A menu list at its own address (menu-lists.njk), newest first.
  eleventyConfig.addCollection('menuLists', (api) => {
    const newestFirst = api
      .getFilteredByGlob('posts/**/index.md')
      .sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
    return lists
      .filter((i) => listUrl.get(i))
      .map((i) => ({
        label: i.label,
        url: listUrl.get(i),
        posts: newestFirst.filter((p) => i.posts.includes(key(p.inputPath))),
      }));
  });
  // The only post of a menu tag kept off the home page is shown as a page:
  // no date, no tag line (post.njk, layout.njk).
  eleventyConfig.addGlobalData('menuPages', Object.fromEntries([...plan.pages].map((p) => [`./${p}`, true])));
  // Where a post's tag links: the menu list's own address when it has one.
  const tagHomes = Object.fromEntries(lists.filter((i) => listUrl.get(i)).map((i) => [i.slug, listUrl.get(i)]));
  eleventyConfig.addGlobalData('tagHomes', tagHomes);
  // A post's tag line: each tag once, a section's tag in the menu's words.
  eleventyConfig.addFilter('tagLine', (tags) => tagLine(tags, { tagSlug, sections, homes: tagHomes }));

  // A draft is not built at all: no page, and it is in no list, feed,
  // sitemap or tag page. Its attachments stay unpublished too (below).
  eleventyConfig.addPreprocessor('drafts', 'md', (data) => (isDraft(data.draft) ? false : undefined));

  // A post folder (a folder with an index.md) holds one page, its index.md.
  // Anything else in it is an attachment, even when Eleventy could build it:
  // an attached notes.md or demo.html once became a second page at the post's
  // address and failed the build. Outside post folders nothing changes: a
  // single-file post such as posts/hello.md is still a page.
  for (const folder of globSync('posts/**/index.md').map(dirname)) {
    for (const file of attachmentsIn(folder, '', { quiet: true })) {
      if (PAGE_FILE.test(file)) eleventyConfig.ignores.add(escapeGlob(`${folder}/${file}`));
    }
  }

  // Post attachments live beside index.md and are published beside the
  // post's page, wherever that page is (its slug, a collision suffix, a
  // changed slug or a hand-set permalink), so the relative links the app
  // writes (`![…](photo.jpg)`) open them. Copying them to their folder's path
  // (posts/2026/10/<id>-<slug>/) broke every photo on every blog (2026-10-05).
  // Attachments are the user's data: ALL of them, whatever the extension — a
  // fixed list silently dropped .fit files (2026-08-31). Any other file under
  // posts/, outside a post folder, is published at its own path, as before.
  //
  // An attachment never replaces a file of the blog: a page, a file copied by
  // a passthrough (the favicon, fonts…) or another attachment (siteFiles).
  let copied = [];
  eleventyConfig.on('eleventy.before', () => (copied = []));
  eleventyConfig.on('eleventy.passthrough', ({ map }) => copied.push(...Object.keys(map ?? {})));
  eleventyConfig.on('eleventy.after', ({ dir, results, outputMode }) => {
    if (outputMode && outputMode !== 'fs') return;
    const output = normalize(dir?.output ?? '_site');
    const site = siteFiles();
    for (const { outputPath } of results) if (outputPath) site.own(String(outputPath), 'a page of the blog');
    for (const url of copied) site.own(join(output, decodeURI(url)), 'a file of the blog');
    const publish = (from, file, to) => {
      const target = join(to, file);
      const there = site.claim(target, `${from}/${file}`);
      if (there) {
        console.warn(`[repoet] ${from}/${file} was not published: ${there} is at that address.`);
        return;
      }
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(from, file), target);
    };
    for (const { inputPath, outputPath } of results) {
      const source = String(inputPath).replace(/^\.\//, '');
      if (!outputPath || !/^posts\/.+\/index\.md$/.test(source)) continue;
      const from = dirname(source);
      const to = dirname(normalize(String(outputPath)));
      for (const file of attachmentsIn(from)) publish(from, file, to);
    }
    for (const file of looseFilesIn('posts')) publish('posts', file, join(output, 'posts'));
  });
  // `npm run dev` rebuilds when a watched file changes; a photo is not a page,
  // so without this a changed or added attachment never reached the preview.
  eleventyConfig.addWatchTarget('posts/');

  // The README documents the repository on GitHub; it is not a page of the
  // blog — and its code examples contain template syntax that must never be
  // executed by the build (found the hard way, 2026-08-31).
  eleventyConfig.ignores.add('README.md');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('fonts');
  eleventyConfig.addPassthroughCopy('favicon.svg'); // replace with your own — it is yours // self-hosted — the blog makes no third-party requests

  eleventyConfig.addFilter('isoDate', (value) => new Date(value).toISOString());

  // The Markdown (_lib/markdown.js): code coloured when the site is built
  // (_lib/highlight.js), so readers get coloured HTML and no script, and a
  // block in an unknown language, or none, stays plain, escaped as Markdown
  // always escaped it; typographic quotes in the blog's language; bare
  // https:// addresses as links; an image on a line of its own as a figure,
  // its title the caption.
  eleventyConfig.amendLibrary('md', (md) => configureMarkdown(md, { language: blog.language }));

  // Images and frames in a post fit the column and load lazily (_lib/media.js).
  // An image's size is read from its file in the post's folder.
  const sizes = new Map();
  const sizeOf = (folder) => (src) => {
    if (!src || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return null;
    let path;
    try {
      const clean = decodeURI(src.split(/[?#]/)[0]);
      path = clean.startsWith('/') ? normalize(join('.', clean)) : normalize(join(folder, clean));
    } catch {
      return null;
    }
    if (!sizes.has(path)) {
      let size = null;
      try {
        const found = existsSync(path) ? imageSize(readFileSync(path)) : null;
        if (found?.width && found?.height) {
          // A photo turned by its EXIF orientation shows turned.
          const turned = found.orientation >= 5 && found.orientation <= 8;
          size = turned ? { width: found.height, height: found.width } : { width: found.width, height: found.height };
        }
      } catch {
        /* not an image this can read: left as it is */
      }
      sizes.set(path, size);
    }
    return sizes.get(path);
  };
  eleventyConfig.addTransform('media', function (html) {
    const inputPath = String(this.page?.inputPath ?? '').replace(/^\.\//, '');
    if (!/^posts\/.+\.md$/.test(inputPath) || !String(this.page?.outputPath ?? '').endsWith('.html')) return html;
    return fitMedia(html, { sizeOf: sizeOf(dirname(inputPath)) });
  });

  // A post's own words as text: an untitled note's title, a description the
  // post does not give (_lib/text.js).
  eleventyConfig.addFilter('plainText', plainText);
  eleventyConfig.addFilter('excerpt', excerpt);
  eleventyConfig.addFilter('firstSentence', firstSentence);
  eleventyConfig.addFilter('noteTitle', noteTitle);
  // The post at this input path in a collection: its body, without the layout.
  eleventyConfig.addFilter('itemAt', (items, inputPath) =>
    [].concat(items ?? []).find((item) => item.inputPath === inputPath) ?? null,
  );

  // ——— Tier 2 SEO: link unfurls (PROGRESS, 2026-08-30) ———
  // The share image, zero-config: a post's first body image is usually the
  // right one. Frontmatter `image:` overrides; blog.json `socialImage` (a
  // root path like "/assets/social.png") is the site-wide fallback.
  eleventyConfig.addFilter('firstImage', (content) => {
    const m = /<img[^>]+src="([^"]+)"/.exec(content || '');
    return m ? m[1] : '';
  });
  // Crawlers ignore relative og:image/og:url — make repo paths absolute. A
  // root path is the blog's root; anything else is relative to the page, as
  // the browser reads it (the attachment sits beside the page, above).
  eleventyConfig.addFilter('absUrl', (src, pageUrl) => {
    if (!src || !siteUrl) return '';
    if (/^https?:\/\//.test(src)) return src;
    return src.startsWith('/') ? `${siteUrl}${src}` : new URL(src, `${siteUrl}${pageUrl}`).href;
  });
  // No `<` reaches the script block a JSON-LD object lives in: `</script>`
  // in a description would end it. JSON reads \u003c as the same "<".
  eleventyConfig.addFilter('jsonld', (obj) => JSON.stringify(obj).replaceAll('<', '\\u003c'));
  // Dates in the blog's language (_lib/dates.js): "Jan 29, 2026" in English.
  eleventyConfig.addFilter('readableDate', dateFormat(blog.language));

  // Every published post, newest first: the sitemap's list.
  eleventyConfig.addCollection('everyPost', (api) =>
    api
      .getFilteredByGlob('posts/**/index.md')
      .sort((a, b) => (a.data.date < b.data.date ? 1 : -1)),
  );
  // The home list and the feed: every post but those of a menu tag with
  // `home: false`. With no menu, every post.
  eleventyConfig.addCollection('posts', (api) =>
    api
      .getFilteredByGlob('posts/**/index.md')
      .filter((p) => !plan.offHome.has(key(p.inputPath)))
      .sort((a, b) => (a.data.date < b.data.date ? 1 : -1)),
  );

  // ——— Tier 3 SEO (PROGRESS, 2026-08-30) ———
  // One entry per tag page: { name, slug, posts }, newest first — drives
  // /tags/<slug>/. The name is the spelling used most (the oldest post's on a
  // tie).
  eleventyConfig.addCollection('tagList', (api) => {
    const bySlug = new Map();
    const oldestFirst = api
      .getFilteredByGlob('posts/**/index.md')
      .sort((a, b) => (a.data.date < b.data.date ? -1 : 1));
    for (const post of oldestFirst) {
      const tags = [].concat(post.data.tags ?? []);
      const seen = new Set();
      for (const tag of tags) {
        const slug = tagSlug(tag);
        if (!slug) continue;
        if (!bySlug.has(slug)) bySlug.set(slug, { spellings: new Map(), posts: [] });
        const group = bySlug.get(slug);
        group.spellings.set(String(tag), (group.spellings.get(String(tag)) ?? 0) + 1);
        if (!seen.has(slug)) group.posts.push(post); // once, even when tagged Go and go
        seen.add(slug);
      }
    }
    return [...bySlug.entries()]
      .map(([slug, { spellings, posts }]) => ({
        name: [...spellings].reduce((best, s) => (s[1] > best[1] ? s : best))[0],
        slug,
        posts: posts.reverse(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // First image's alt — an og:image nobody can see still gets described.
  eleventyConfig.addFilter('firstImageAlt', (content) => {
    const m = /<img[^>]+alt="([^"]*)"/.exec(content || '');
    return m ? m[1] : '';
  });

  return {
    dir: { input: '.', includes: '_includes', output: '_site' },
    // A post is Markdown and nothing else. Run through Liquid (Eleventy's
    // default), `${{ secrets.TOKEN }}` in a code block published as `$`,
    // `{{ x }}` vanished and `{% if %}` in a sentence failed the build
    // (2026-10-05). Posts are exactly what you wrote.
    markdownTemplateEngine: false,
    // The URL is computed, never stored (docs/decisions/url-computed-not-stored.md):
    // GitHub's configure-pages action provides PATH_PREFIX per deploy.
    pathPrefix: process.env.PATH_PREFIX || '/',
  };
}

/**
 * A post folder's attachments, as paths inside it: everything but its page.
 * A symbolic link is never followed: one to a folder stopped the whole build,
 * and one may point out of the post, even out of the repository.
 */
function attachmentsIn(folder, prefix = '', { quiet = false } = {}) {
  const out = [];
  for (const entry of readdirSync(join(folder, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .DS_Store and the like
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      if (quiet) out.push(path); // listed only so a linked page file is ignored
      else console.warn(`[repoet] ${folder}/${path} was not published: it is a symbolic link.`);
    } else if (entry.isDirectory()) {
      // A folder that is a post of its own publishes at its own address.
      if (!existsSync(join(folder, path, 'index.md'))) out.push(...attachmentsIn(folder, path, { quiet }));
    } else if (path !== 'index.md') {
      out.push(path);
    }
  }
  return out;
}

/**
 * Files under posts/ outside every post folder, as paths inside posts/: what
 * the blog published at their own path before posts had folders. Pages and
 * Eleventy's data files are built, not copied; symbolic links are skipped.
 */
function looseFilesIn(root, prefix = '') {
  const out = [];
  const here = join(root, prefix);
  if (!existsSync(here) || existsSync(join(here, 'index.md'))) return out; // a post folder
  for (const entry of readdirSync(here, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...looseFilesIn(root, path));
    else if (!PAGE_FILE.test(entry.name) && !DATA_FILE.test(entry.name)) out.push(path);
  }
  return out;
}

/** A path as a glob that matches only itself. */
function escapeGlob(path) {
  return path.replace(/[\\*?[\]{}()!+@]/g, '\\$&');
}

/**
 * The site's files, as attachments are published into it. The blog's own
 * files (pages, passthrough copies) are matched ignoring case: on a
 * case-insensitive disk (macOS) an attachment named INDEX.HTML once
 * overwrote index.html. Attachments are matched exactly: Photo.jpg and
 * photo.jpg are two files on the Linux machine that builds the blog.
 * `claim` returns what is already at the address, or nothing and takes it.
 */
export function siteFiles() {
  const own = new Map(); // lower-cased path -> what is there
  const attached = new Map(); // exact path -> the file published there
  return {
    own(path, what) {
      own.set(normalize(path).toLowerCase(), what);
    },
    claim(path, from) {
      const exact = normalize(path);
      const there = own.get(exact.toLowerCase()) ?? attached.get(exact);
      if (there) return there;
      attached.set(exact, from);
      return null;
    },
  };
}

/**
 * A hand-set `permalink:` as an address the build can know in advance, or
 * null: `false` (no page) and one written with template code are left as
 * they are.
 */
function knownPermalink(value) {
  if (typeof value !== 'string' || !value.trim() || /\{\{|\{%/.test(value)) return null;
  return value.trim();
}

/** Every file in a folder and the folders in it, as paths from the blog's root. */
function filesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

/** Folders that hold no pages of the site. */
const NOT_PAGES = new Set(['node_modules', '_site', '_includes', '_lib', 'posts']);
const PAGE_TEMPLATE = /\.(md|html|njk|liquid)$/i;

/**
 * The addresses of the site's pages outside posts/: the template's own
 * (sitemap, robots, 404) and any page of your own (about.njk → /about/). A
 * page that paginates (the home list, the tag pages, the menu lists) is
 * counted by the build itself, and one whose address is written with
 * template code cannot be known in advance.
 */
function ownPages(frontmatter, dir = '.') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!NOT_PAGES.has(path)) out.push(...ownPages(frontmatter, path));
      continue;
    }
    if (!PAGE_TEMPLATE.test(entry.name) || path === 'README.md') continue;
    const data = frontmatter(readFileSync(path, 'utf-8'));
    if (data.pagination || (/\.md$/i.test(path) && isDraft(data.draft))) continue;
    if ('permalink' in data) {
      const url = knownPermalink(data.permalink);
      if (url) out.push({ url: url.startsWith('/') ? url : `/${url}`, what: path });
      continue;
    }
    const stem = path.replace(PAGE_TEMPLATE, '');
    const url = stem === 'index' ? '/' : stem.endsWith('/index') ? `/${stem.slice(0, -'index'.length)}` : `/${stem}/`;
    out.push({ url, what: path });
  }
  return out;
}
