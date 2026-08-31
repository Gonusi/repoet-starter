# Your Repoet blog

This repository **is** your blog. Posts live under `posts/**` as markdown with
frontmatter; [Eleventy](https://www.11ty.dev/) builds the site; GitHub Pages
serves it. The [Repoet app](https://repoet.pages.dev) writes only inside
`posts/**` and `blog.json` — everything else here is yours to edit, and the
blog keeps working if you stop using the app entirely.

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

Every attachment beside a post is copied to the site, so a `.fit` named in
frontmatter is already downloadable at `/<slug>/<name>`. To *render* it,
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

## Licenses

See `NOTICE` (theme adapted from no-style-please, MIT; fonts under the SIL
Open Font License).
