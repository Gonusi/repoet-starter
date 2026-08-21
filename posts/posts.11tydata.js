export default {
  layout: 'post.njk',
  permalink: (data) => `/${data.slug || data.page.fileSlug}/`,
  eleventyComputed: {
    // A microblog post may have no title; lists fall back to the body.
    displayTitle: (data) => data.title || '',
  },
};
