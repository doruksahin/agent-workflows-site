import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRules, scanText } from './disclosure.mjs';

const rules = loadRules(new URL('./disclosure-rules.json', import.meta.url));
const ids = text => scanText(text, rules).map(f => f.id);

test('flags employer and secret-manager names case-insensitively', () => {
  assert.deepEqual(ids('Stored in infisical for AdCreative-ai'), ['employer-name', 'secret-manager']);
});
test('flags ticket keys, CI run URLs, secret commands, and emails', () => {
  assert.deepEqual(ids('ATT-1234'), ['ticket-key']);
  assert.deepEqual(ids('https://github.com/o/r/actions/runs/12345678901'), ['ci-run-url', 'ci-run-id']);
  assert.deepEqual(ids('gh secret set TOKEN'), ['secret-command']);
  assert.deepEqual(ids('mail jane.doe@example.org'), ['email']);
});
test('flags run IDs, trace IDs, and internal script paths and names', () => {
  assert.deepEqual(ids('gh run view 12345678901 --json jobs'), ['ci-run-id']);
  assert.deepEqual(ids('run=12345678901.'), ['ci-run-id']);
  assert.deepEqual(ids('trace=0123456789abcdef0123456789abcdef agent=446s'), ['trace-id']);
  assert.deepEqual(ids('node .github/scripts/run-walkthrough.mjs'), ['internal-script-path', 'internal-script-name']);
  assert.deepEqual(ids('node walkthrough-delivery.mjs render'), ['internal-script-name']);
});
test('does not flag ordinary technical text', () => {
  assert.deepEqual(ids('UTF-8, ADR-style notes, npx langfuse-cli@1.2.3, user.email, @astrojs/mdx'), []);
  assert.deepEqual(ids('2026-10-05, 9,722 tokens, 100682 ms, translate(0, -19.299999237060547), r="478.3999938964844"'), []);
});
test('reports 1-based line numbers and the matched text', () => {
  assert.deepEqual(scanText('ok\nsee ATT-12 here', rules), [{ id: 'ticket-key', line: 2, match: 'ATT-12' }]);
});
test('accepts rule flags that already include g', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rules-'));
  try {
    const file = join(dir, 'rules.json');
    writeFileSync(file, JSON.stringify([{ id: 'x', pattern: 'a', flags: 'gi' }]));
    assert.equal(scanText('A a', loadRules(file)).length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
