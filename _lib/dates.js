// Dates as readers see them, in the blog's language (blog.json `language`):
// "29 Jan 2026" in English, "29. Jan. 2026" in German, "2026-01-29" in
// Lithuanian: each language's own short date, from the build's full ICU
// (Node's official builds, which the deploy workflow uses, carry every
// language). A language Intl does not know reads as English.
//
// English is day first, whichever English (en, en-US, en-GB): the app, the
// Repoet site and its picture of a blog all say "29 Jan" (views critique
// 2026-10-08, second pass N13). The month keeps English's three letters
// ("Sep", not en-GB's "Sept").
//
// In UTC, as the deploy builds it and as <time datetime> says, so a build on
// your own machine shows the dates the published site shows.

const OPTIONS = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

/** A function from a date to its words in `language`. */
export function dateFormat(language) {
  let format;
  try {
    format = new Intl.DateTimeFormat(String(language ?? '').trim() || 'en', OPTIONS);
  } catch {
    format = new Intl.DateTimeFormat('en', OPTIONS);
  }
  if (format.resolvedOptions().locale.split('-')[0] === 'en') {
    const english = new Intl.DateTimeFormat('en-US', OPTIONS);
    return (value) => {
      const part = Object.fromEntries(english.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
      return `${part.day} ${part.month} ${part.year}`;
    };
  }
  return (value) => format.format(new Date(value));
}
