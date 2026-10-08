// A post's own words as plain text (_lib/text.js): an untitled note's title
// and a description the post does not give (views critique, 2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt, firstSentence, isFieldLine, leadSentence, noteTitle, plainText } from './text.js';

test('plain text reads entities, keeps blocks apart, and drops scripts and styles', () => {
  assert.equal(plainText('<p>Tom &amp; Jerry &lt;3 &#8217; &#x2019;</p><p>Next</p>'), 'Tom & Jerry <3 ’ ’ Next');
  assert.equal(plainText('<p>Some <em>word</em>s</p>'), 'Some words', 'inline tags join their words');
  assert.equal(plainText('<script>alert(1)</script><style>p{}</style><!-- x --><p>Only this</p>'), 'Only this');
  assert.equal(plainText(''), '');
  assert.equal(plainText(undefined), '');
});

test('an excerpt is cut at a space and ends in one ellipsis character, never three full stops', () => {
  assert.equal(excerpt('Short enough', 60), 'Short enough');
  assert.equal(excerpt('A microblog note about something rather long that goes on', 30), 'A microblog note about…');
  assert.equal(excerpt('Ends at a comma, then more words follow here', 18), 'Ends at a comma…');
  assert.equal(excerpt('Supercalifragilisticexpialidocious', 12), 'Supercalifr…', 'one long word is cut where the room ends');
});

test('a description is the first sentence, with the next while the first is short, within 160 characters', () => {
  assert.equal(firstSentence('Rendering is hard. It takes years.'), 'Rendering is hard. It takes years.');
  assert.equal(
    firstSentence('Rendering in pen and ink is an old craft that takes years. It is worth it. Really.'),
    'Rendering in pen and ink is an old craft that takes years.',
  );
  assert.equal(firstSentence('Version 3.5 shipped with a fix for the feed order today! More later.'), 'Version 3.5 shipped with a fix for the feed order today!');
  const long = 'word '.repeat(60).trim();
  assert.ok(firstSentence(long).length <= 160);
  assert.match(firstSentence(long), /…$/);
  assert.equal(firstSentence(''), '');
});

test('an untitled note is titled with its first sentence, or its opening words cut near 60 characters', () => {
  assert.equal(noteTitle('Shipped the feed today. It took three tries.'), 'Shipped the feed today.');
  assert.equal(
    noteTitle('A very long note without any end mark that keeps going for a long while with many words'),
    'A very long note without any end mark that keeps going for…',
  );
});

// Views critique 2026-10-08, second pass N1: the description joined the
// field line to the next paragraph on a real share card, and took a
// code-first post's code. Cases from the owner's blog, as built.

test('a book review’s description skips its line of fields: Rendering in Pen and Ink', () => {
  const html =
    '<p>Arthur L. Guptill · ISBN 978-0-307-83188-0 · Year 2014</p>\n<p>People that know me will know I like to doodle and perhaps even paint. Since I’ve now decided to make my hobby a bit more public…</p>';
  assert.equal(leadSentence(html), 'People that know me will know I like to doodle and perhaps even paint.');
  assert.equal(leadSentence('<p>Stephen Graham · Year 1926</p><p>A walking book.</p>'), 'A walking book.');
  assert.equal(isFieldLine('Alan Booth · ISBN 978-0-141-99283-9 · Year 2021 (Originally 1985)'), true);
  assert.equal(isFieldLine('Today I learned this · and that, and a whole lot of other things went into one long line'), false);
});

test('a description never runs past its paragraph, even with no full stop in it', () => {
  assert.equal(leadSentence('<p>No stop on this line</p><p>Second paragraph.</p>'), 'No stop on this line');
});

test('code, headings, figures and embeds are skipped; a picture alone is no paragraph', () => {
  const html =
    '<pre class="language-ts"><code>type A = { a: number }; // comment\nconst x = 1;</code></pre>' +
    '<h2 id="simple">Simple JS function</h2>' +
    '<figure><img src="a.jpg" alt="A cat"><figcaption>A cat.</figcaption></figure>' +
    '<div class="videoWrapper"><iframe src="https://www.youtube-nocookie.com/embed/x"></iframe></div>' +
    '<p><img src="kasparas-anusauskas.jpg" alt="Kasparas Anusauskas profile picture"></p>' +
    '<p><span id="greeting">Hi there</span>. You’ve stumbled upon my personal blog. I’ve been programming computers for more than 15 years.</p>';
  assert.equal(leadSentence(html), 'Hi there. You’ve stumbled upon my personal blog.');
});

test('a post with no paragraph of prose has no description of its own', () => {
  assert.equal(leadSentence('<pre><code>ls -la</code></pre>'), '');
  assert.equal(leadSentence(''), '');
});
