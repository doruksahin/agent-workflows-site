import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRules } from './disclosure.mjs';
import { liftLead, redactJson, redactText, takeTitle, unlinkPrivate } from './redact.mjs';

const rules = loadRules(new URL('./disclosure-rules.json', import.meta.url));

test('replaces each match with a bar of the same length', () => {
  assert.equal(redactText('Ticket ATT-5933 in Infisical', rules), 'Ticket ████████ in █████████');
  assert.equal(redactText('ordinary text, 2026-10-05', rules), 'ordinary text, 2026-10-05');
});
test('redacts JSON strings and matching numbers, keeps keys and other numbers', () => {
  assert.deepEqual(redactJson({ ticket: 'ATT-1', run: 37285429758, tokens: 9722, list: ['adcreative'] }, rules),
    { ticket: '█████', run: '███████████', tokens: 9722, list: ['██████████'] });
});
test('unlinks private and out-of-folder links, keeps other links and images', () => {
  const leaves = url => url.startsWith('../');
  assert.equal(unlinkPrivate('[ADR](../adr/x.md) [repo](https://github.com/AdCreative-ai/r) [ok](a.md) ![i](../i.png)', rules, leaves),
    'ADR repo [ok](a.md) ![i](../i.png)');
  assert.equal(unlinkPrivate('```\n[x](../y)\n```\n', rules, leaves), '```\n[x](../y)\n```\n');
});
test('splits the title and lifts a leading paragraph as plain text', () => {
  assert.deepEqual(takeTitle('# Hello\n\nBody'), { title: 'Hello', body: 'Body' });
  assert.deepEqual(liftLead('Read `x` in [the guide](g.md),\n**now**.\n\n## Next'), { lead: 'Read x in the guide, now.', body: '## Next' });
  assert.equal(liftLead('| a |\n\ntext').lead, null);
});
