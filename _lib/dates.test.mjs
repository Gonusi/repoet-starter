// Dates in the blog's language (_lib/dates.js; views critique X3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateFormat } from './dates.js';

test('dates read in the blog’s language, and English as before', () => {
  assert.equal(dateFormat('en')('2026-01-29T10:00:00Z'), 'Jan 29, 2026');
  assert.equal(dateFormat('de')('2026-01-29T10:00:00Z'), '29. Jan. 2026');
  assert.equal(dateFormat('en-GB')('2026-01-29T10:00:00Z'), '29 Jan 2026');
});

test('the build has every language: Node’s full ICU, as the deploy workflow’s setup-node gives', () => {
  for (const language of ['de', 'lt', 'ja', 'fr']) {
    assert.deepEqual(Intl.DateTimeFormat.supportedLocalesOf([language]), [language], language);
  }
});

test('a language Intl cannot read, or none, reads as English; a date is the deploy’s, UTC', () => {
  assert.equal(dateFormat('not a language!')('2026-01-29T10:00:00Z'), 'Jan 29, 2026');
  assert.equal(dateFormat('')('2026-01-29T10:00:00Z'), 'Jan 29, 2026');
  assert.equal(dateFormat(undefined)('2026-01-29T23:30:00-05:00'), 'Jan 30, 2026');
});
