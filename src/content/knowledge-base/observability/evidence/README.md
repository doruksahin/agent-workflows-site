---
title: "Evidence"
summary: "This folder holds measurements that back decisions about walkthrough speed and behavior. Each entry is a dated write-up with its raw data next to it."
date: 2026-10-05
tags: [langfuse, observability, claude-code]
source: "Synced from a private repository's docs. Private details are redacted."
verbatim: true
---
# Evidence

This folder holds measurements that back decisions about walkthrough speed and behavior. Each
entry is a dated write-up with its raw data next to it.

Every number comes from a real run and can be checked again:
- traces through the queries in [Diagnose a run with the CLI](../diagnose-with-cli.md);
- runs through their CI run IDs;
- drafts through their Drive store versions.

Each write-up states its method, what was excluded and why, and its limits.

| Date | Question | Write-up | Data | Decision |
| --- | --- | --- | --- | --- |
| 2026-10-05 | Which reasoning effort should the verification agent run at? | [Effort level comparison: ████████](2026-10-05-effort-level-att-5933.md) | [JSON](2026-10-05-effort-level-att-5933.json) | Pin `high`: #116 |

## Adding an entry

1. Use the same ticket and the same inputs for every run you compare. Record those inputs, and
   keep the trace ID of every run, including runs you exclude.
2. Write the per-run numbers to `<date>-<topic>.json`. Read them from Langfuse with
   `npx langfuse-cli api observations list --trace-id <id> …`; do not copy them by hand.
3. In `<date>-<topic>.md`, cover the method, the results table, the exclusions and why, a
   reading of the results, and the limits.
4. Add a row to the table above and link the entry from the issue or PR it decides.
