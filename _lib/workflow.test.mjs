import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The deploy workflow ships into every blog, so its first run is the first
// thing a new user hears from GitHub. QA 2026-08-24: that first run FAILED and
// emailed them — the repository builds the moment it is generated, before
// Repoet has enabled Pages, so `configure-pages` 404s. Nothing is broken (the
// app enables Pages and re-triggers), but "your build failed" is a terrible
// hello. The workflow must skip cleanly instead.

const wf = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf-8');

test('the build asks whether Pages is enabled before configuring it', () => {
  assert.match(wf, /id:\s*pages/, 'needs a readiness step with an id');
  assert.match(wf, /api\.github\.com\/repos\/\$\{\{\s*github\.repository\s*\}\}\/pages/,
    'readiness is decided by asking the Pages API, not by guessing');
});

test('every step that needs Pages is skipped when Pages is not enabled yet', () => {
  // Each of these fails or uploads pointlessly without a Pages site.
  for (const step of ['configure-pages', 'upload-pages-artifact']) {
    const idx = wf.indexOf(step);
    assert.ok(idx > 0, `${step} present`);
    const block = wf.slice(Math.max(0, idx - 260), idx + 120);
    assert.match(block, /if:\s*steps\.pages\.outputs\.enabled\s*==\s*'true'/,
      `${step} must be conditional on the readiness check`);
  }
});

test('the deploy job does not run when the build skipped', () => {
  assert.match(wf, /needs:\s*build[\s\S]{0,200}if:\s*needs\.build\.outputs\.enabled\s*==\s*'true'/,
    'deploy must depend on the build reporting that Pages is enabled');
});

test('a skipped first run still succeeds, and says why in plain words', () => {
  assert.match(wf, /Pages is not enabled yet/i,
    'the log should explain the skip to whoever opens it');
  assert.doesNotMatch(wf, /exit 1/, 'skipping is not a failure');
});

test('actions are current, so blogs do not inherit deprecation warnings', () => {
  for (const [action, min] of [['checkout', 5], ['configure-pages', 6], ['upload-pages-artifact', 5], ['deploy-pages', 5]]) {
    const m = new RegExp(`actions/${action}@v(\\d+)`).exec(wf);
    assert.ok(m, `${action} pinned`);
    assert.ok(Number(m[1]) >= min, `actions/${action} should be v${min}+, found v${m[1]}`);
  }
});
