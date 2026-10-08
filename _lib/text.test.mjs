// A post's own words as plain text (_lib/text.js): an untitled note's title
// and a description the post does not give (views critique, 2026-10-08).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt, firstSentence, noteTitle, plainText } from './text.js';

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
