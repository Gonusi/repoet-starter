// Images and frames that fit the column and load lazily (_lib/media.js;
// views critique P8, P10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitMedia, markBareLinks, printVideos } from './media.js';

const sizes = { 'tall.jpg': { width: 1400, height: 2400 }, 'wide.png': { width: 800, height: 600 } };
const sizeOf = (src) => sizes[src] ?? null;

test('an image gets its size, a width that keeps it in the column and the screen, and decodes off the main thread', () => {
  assert.equal(
    fitMedia('<img src="tall.jpg" alt="A tall photo">', { sizeOf }),
    '<img src="tall.jpg" alt="A tall photo" decoding="async" width="1400" height="2400" style="width: min(1400px, 100%, calc(80vh * 1400 / 2400));">',
  );
});

test('every image but the first loads lazily; the first may be what the reader sees first', () => {
  const html = fitMedia('<img src="wide.png"><p><img src="wide.png" /></p><img src="gone.jpg">', { sizeOf });
  const tags = html.match(/<img[^>]*>/g);
  assert.doesNotMatch(tags[0], /loading=/);
  assert.match(tags[1], /loading="lazy"/);
  assert.match(tags[1], / \/>$/, 'a self-closed tag stays self-closed');
  assert.match(tags[2], /loading="lazy"/);
  assert.doesNotMatch(tags[2], /width=/, 'no file, no size');
});

test('what a post sets itself is left as it is', () => {
  const tag = '<img src="tall.jpg" width="300" loading="eager" decoding="sync" style="float: right">';
  assert.equal(fitMedia(`<img src="wide.png">${tag}`, { sizeOf }), `<img src="wide.png" decoding="async" width="800" height="600" style="width: min(800px, 100%, calc(80vh * 800 / 600));">${tag}`);
});

test('a frame loads lazily and keeps its width-to-height when the column is narrower', () => {
  assert.equal(
    fitMedia('<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/x" frameborder="0"></iframe>'),
    '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/x" frameborder="0" loading="lazy" style="aspect-ratio: 560 / 315; height: auto;"></iframe>',
  );
  assert.equal(
    fitMedia('<iframe src="https://codesandbox.io/embed/x" style="width:100%; height:500px"></iframe>'),
    '<iframe src="https://codesandbox.io/embed/x" style="width:100%; height:500px" loading="lazy"></iframe>',
  );
});

test('scripts, styles and comments are passed through: an <img in a JSON-LD string is not touched', () => {
  const html = '<script type="application/ld+json">{"d":"<img src=x>"}</script><!-- <img src=y> --><img src="wide.png">';
  assert.match(fitMedia(html, { sizeOf }), /^<script type="application\/ld\+json">\{"d":"<img src=x>"\}<\/script><!-- <img src=y> --><img src="wide.png" decoding/);
});

// Views critique 2026-10-08, second pass N15: print doubled a bare URL, and
// printed a video as a black box.
test('a link whose words are its address is marked bare, so print does not repeat it', () => {
  assert.equal(
    markBareLinks('<a href="https://example.com/link">https://example.com/link</a> and <a href="https://x.org">x</a>'),
    '<a href="https://example.com/link" class="bare">https://example.com/link</a> and <a href="https://x.org">x</a>',
  );
  assert.equal(markBareLinks('<a class="u" href="https://a.b/">https://a.b</a>'), '<a class="u bare" href="https://a.b/">https://a.b</a>');
});

test('a video is followed by its address, for print only', () => {
  assert.equal(
    printVideos('<video controls src="clip.mp4"></video>'),
    '<video controls src="clip.mp4"></video><a class="print-only bare" href="clip.mp4">clip.mp4</a>',
  );
  assert.equal(
    printVideos('<video controls><source src="https://v.example/a.mp4" type="video/mp4"></video>'),
    '<video controls><source src="https://v.example/a.mp4" type="video/mp4"></video><a class="print-only bare" href="https://v.example/a.mp4">https://v.example/a.mp4</a>',
  );
});
