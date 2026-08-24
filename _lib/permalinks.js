// Slug collision resolution — docs/content-contract/post-identity.md:
// "A build never hard-fails over a slug; it logs a warning." The post with the
// lexicographically earliest immutable directory path keeps the clean URL;
// every other collider gets `slug-<short-id>`. Pure so it can be tested.

/** @param {{ inputPath: string, slug: string, shortId: string }[]} posts */
export function resolvePermalinks(posts) {
  const bySlug = new Map();
  for (const p of posts) {
    const group = bySlug.get(p.slug) ?? [];
    group.push(p);
    bySlug.set(p.slug, group);
  }
  const out = new Map(); // inputPath -> url slug
  const warnings = [];
  for (const [slug, group] of bySlug) {
    if (group.length === 1) {
      out.set(group[0].inputPath, slug);
      continue;
    }
    // Earliest immutable path wins the clean URL; the path can never change,
    // so a date edit can never reshuffle which post owns the URL.
    const sorted = [...group].sort((a, b) => (a.inputPath < b.inputPath ? -1 : 1));
    out.set(sorted[0].inputPath, slug);
    for (const p of sorted.slice(1)) {
      out.set(p.inputPath, `${slug}-${p.shortId}`);
    }
    warnings.push(
      `Duplicate slug "${slug}" across ${group.length} posts; ` +
        `${sorted[0].inputPath} keeps /${slug}/, the rest get a suffixed URL.`,
    );
  }
  return { urls: out, warnings };
}

/** Short id = first 8 chars of the directory-name prefix `<short-id>-<slug>`. */
export function shortIdFromPath(inputPath) {
  const dir = inputPath.split('/').slice(-2, -1)[0] ?? '';
  return dir.split('-')[0] || dir || 'post';
}
