// Images and embedded frames that fit the column, on a phone too, and load
// as the reader reaches them. Applied to each post's page as it is written
// (eleventy.config.js), to Markdown images and HTML ones alike:
//
// - An image whose file is in the post gets its width and height, so the
//   words below it no longer jump as it loads, and a width that keeps it
//   within the column and within 80% of the screen's height, its shape kept:
//   a tall photo once filled 1,100px of a laptop screen.
// - Every image after the first loads lazily, and decodes off the main
//   thread. The first may be what the reader sees first, so it is not delayed.
// - A frame (a YouTube or CodeSandbox embed) loads lazily, and one that gives
//   a width and height keeps their proportions when the column is narrower:
//   a 560px YouTube frame once pushed a phone's page sideways.
//
// Attributes the post sets itself are left as they are. Pure, so it can be
// tested without a build: the caller says how big an image file is.

const TAG = (name) => new RegExp(`<${name}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi');
const ATTR = (name) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');

/** An attribute's value in a tag, or null when it has none. */
function attr(tag, name) {
  const m = ATTR(name).exec(tag);
  if (m) return m[2] ?? m[3] ?? m[4] ?? '';
  return new RegExp(`\\s${name}(?=[\\s/>])`, 'i').test(tag) ? '' : null;
}

/** The tag with these attributes added before its end. */
function withAttrs(tag, added) {
  const text = Object.entries(added)
    .map(([name, value]) => ` ${name}="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join('');
  return tag.replace(/\s*(\/?)>$/, (end, slash) => `${text}${slash ? ' /' : ''}>`);
}

/** The tag with a style added after its own, or as its style. */
function withStyle(tag, style) {
  const own = attr(tag, 'style');
  if (own === null) return withAttrs(tag, { style });
  const joined = `${own.trim().replace(/;?$/, ';')} ${style}`.trim();
  return tag.replace(ATTR('style'), ` style="${joined.replace(/"/g, '&quot;')}"`);
}

const whole = (value) => (/^\d+$/.test(String(value ?? '').trim()) ? Number(value) : null);

/**
 * @param {string} html a page of the blog
 * @param {{ sizeOf?: (src: string) => { width: number, height: number } | null }} options
 *   `sizeOf`: an image file's size from the address the post gives, or null.
 */
export function fitMedia(html, { sizeOf = () => null } = {}) {
  const seen = { images: 0 };
  // Scripts (the JSON-LD), styles and comments are passed through untouched.
  return String(html)
    .split(/(<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->)/i)
    .map((part, i) => (i % 2 === 1 ? part : printVideos(markBareLinks(fitFrames(fitImages(part, seen, sizeOf))))))
    .join('');
}

/**
 * A link whose words are its own address ("https://example.com/link",
 * linkified or written out) is marked `bare`, so print does not add the
 * address a second time after it (views critique 2026-10-08, second pass
 * N15).
 */
export function markBareLinks(html) {
  return String(html).replace(/(<a\b(?:[^>"']|"[^"]*"|'[^']*')*>)([^<]*)<\/a>/gi, (whole, open, text) => {
    const href = decodeEntities(attr(open, 'href') ?? '').trim();
    const words = decodeEntities(text).trim();
    const same = href !== '' && (words === href || words === href.replace(/^mailto:/i, '') || `${words}/` === href);
    if (!same) return whole;
    const own = attr(open, 'class');
    const tag = own === null ? withAttrs(open, { class: 'bare' }) : open.replace(ATTR('class'), ` class="${own} bare"`);
    return `${tag}${text}</a>`;
  });
}

/**
 * On paper a video is its address, not a black player box (second pass
 * N15): after each <video>, a link to its file that only print shows.
 */
export function printVideos(html) {
  return String(html).replace(/<video\b[\s\S]*?<\/video\s*>/gi, (video) => {
    const open = video.match(TAG('video'))?.[0] ?? '';
    const source = video.match(TAG('source'))?.[0] ?? '';
    const src = attr(open, 'src') || attr(source, 'src');
    if (!src) return video;
    const safe = src.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `${video}<a class="print-only bare" href="${safe}">${safe}</a>`;
  });
}

function fitImages(html, seen, sizeOf) {
  return html.replace(TAG('img'), (tag) => {
    const first = seen.images++ === 0;
    const added = {};
    if (!first && attr(tag, 'loading') === null) added.loading = 'lazy';
    if (attr(tag, 'decoding') === null) added.decoding = 'async';
    let style = null;
    if (attr(tag, 'width') === null && attr(tag, 'height') === null) {
      const size = sizeOf(decodeEntities(attr(tag, 'src') ?? ''));
      if (size && size.width > 0 && size.height > 0) {
        added.width = size.width;
        added.height = size.height;
        if (attr(tag, 'style') === null) {
          style = `width: min(${size.width}px, 100%, calc(80vh * ${size.width} / ${size.height}));`;
        }
      }
    }
    const next = withAttrs(tag, added);
    return style ? withStyle(next, style) : next;
  });
}

function fitFrames(html) {
  return html.replace(TAG('iframe'), (tag) => {
    let next = attr(tag, 'loading') === null ? withAttrs(tag, { loading: 'lazy' }) : tag;
    const [w, h] = [whole(attr(tag, 'width')), whole(attr(tag, 'height'))];
    if (w && h && !/aspect-ratio/i.test(attr(tag, 'style') ?? '')) {
      next = withStyle(next, `aspect-ratio: ${w} / ${h}; height: auto;`);
    }
    return next;
  });
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
