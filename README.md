# Your Repoet blog

Made with Repoet. Just created this repository? Go back to the Repoet tab to
finish; you can close this page.

This repository **is** your blog. Posts live under `posts/**` as markdown with
frontmatter; [Eleventy](https://www.11ty.dev/) builds the site; GitHub Pages
serves it. Everything here is yours to edit, and the blog keeps working if you
stop using the app entirely.

## What the Repoet app writes

- **Publishing** writes only inside `posts/**` and `blog.json`.
- **A template update** writes the template's own files (`eleventy.config.js`,
  `_includes/`, `.github/workflows/deploy.yml`, `fonts/` and the rest), and
  only when you accept it in Repoet's settings. It is one ordinary commit, so
  `git revert` undoes it.
- **`.repoet-template.json`** records which template files this blog received,
  byte for byte. It is how Repoet knows you have not edited a file before it
  updates it. Delete it and Repoet can no longer offer updates.
- Once you edit or delete any template file (this README and `package.json`
  included, say by adding a dependency), Repoet offers no template update at
  all: it names the edited files and leaves updating to you, by hand. It does
  not update the files you left alone either. Your posts, `blog.json` and
  `favicon.svg` are never part of a template update and never block one.

## Posts

- A post is Markdown and nothing else: `{{ }}` and `{% %}` appear exactly as
  you wrote them.
- `draft: true` in a post's frontmatter keeps it off the site: no page, and it
  is in no list, feed, sitemap or tag page. Its files are not published either.
- Files beside a post's `index.md` (photos, PDFs, anything, including `.md` or
  `.html` files, which are published as they are) are published beside the
  post's page, so `![](photo.jpg)` works on the site as it reads. A file never
  replaces a page or another file of the site, and symbolic links are not
  published. Other files under `posts/`, outside a post's folder, are
  published at their own path, and a single-file post such as
  `posts/hello.md` is still a page.
- Tags that differ only in case ("Go", "go") share one tag page.

## Custom post fields

Declare recurring fields in `blog.json` and the Repoet editor renders them at
publish time — the values arrive here as ordinary frontmatter for your
templates and build code to use however you like:

```jsonc
{
  "title": "…",
  "postFields": [
    { "key": "activity", "label": "Activity file", "type": "file", "accept": ".fit,.gpx" },
    { "key": "effort",   "label": "Effort",        "type": "select", "options": ["easy", "steady", "race"] }
  ]
}
```

Types: `text`, `select` (with `options`), `file` (with an `accept` filter —
the file is committed beside the post's `index.md`, the field holds its name).
Fields are advisory: hand-written posts don't need them, and nothing blocks
publishing.

### Worked example: render a .fit activity file

Every attachment beside a post is published beside the post's page, so a
`.fit` named in frontmatter is already downloadable at `/<slug>/<name>`. To *render* it,
parse it at build time — your repository, your dependencies:

```bash
npm install fit-file-parser
```

```js
// eleventy.config.js — inside the exported function
import FitParser from 'fit-file-parser';
import { readFileSync } from 'node:fs';

eleventyConfig.addAsyncShortcode('activity', async function (name) {
  if (!name) return '';
  const dir = this.page.inputPath.replace(/index\.md$/, '');
  const fit = await new Promise((resolve, reject) =>
    new FitParser({ speedUnit: 'km/h' }).parse(readFileSync(`${dir}${name}`), (err, data) =>
      err ? reject(err) : resolve(data),
    ),
  );
  const s = fit.sessions?.[0];
  if (!s) return '';
  const km = (s.total_distance / 1000).toFixed(1);
  const min = Math.round(s.total_timer_time / 60);
  return `<p class="meta">${km} km · ${min} min · <a href="${name}">${name}</a></p>`;
});
```

```njk
{# _includes/post.njk — under the meta line #}
{% if activity %}{% activity activity %}{% endif %}
```

The app never learns what an activity file is — it offers the typed slot, your
build gives it meaning.

## Changed the blog's address?

After adding a custom domain (or renaming the repository), publish anything,
or run the Deploy workflow by hand (Actions → Deploy → Run workflow). Pages
does not rebuild the site on its own, and links built for the old address
break until it does.

## Licenses

See `NOTICE`: the theme is adapted from no-style-please (MIT), and the fonts
are under the SIL Open Font License, whose text is in `fonts/OFL.txt` and is
published with the fonts.
