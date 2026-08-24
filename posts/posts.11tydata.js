export default {
  layout: 'post.njk',
  permalink: (data) => {
    // Use the collision-resolved slug (eleventy.config.js), so duplicate slugs
    // get a suffixed URL instead of a fatal output conflict.
    const key = String(data.page.inputPath).replace(/^\.\//, '');
    const slug = data.permalinkMap?.[key] || data.slug || data.page.fileSlug;
    return `/${slug}/`;
  },
  eleventyComputed: {
    // A microblog post may have no title; lists fall back to the body.
    displayTitle: (data) => data.title || '',
  },
};
