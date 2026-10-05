---
title: "Effort level comparison: ████████ (2026-10-05)"
summary: "This is the evidence behind #116: which reasoning effort the verification agent should run at. The raw per-run numbers are in 2026-10-05-effort-level-att-5933.json. They were read from Langfuse with the queries in Diagnose a run with the CLI."
date: 2026-10-05
tags: [langfuse, observability, claude-code]
source: "Synced from a private repository's docs. Private details are redacted."
verbatim: true
---
# Effort level comparison: ████████ (2026-10-05)

This is the evidence behind
#116: which reasoning effort
the verification agent should run at. The raw per-run numbers are in
[2026-10-05-effort-level-att-5933.json](2026-10-05-effort-level-att-5933.json). They were read from
Langfuse with the queries in [Diagnose a run with the CLI](../diagnose-with-cli.md).

**Result:** `high` cut the local agent step by about 23% (365 s against 473 s on average) and
produced equivalent verdicts. `medium` was faster still, but it omitted required evidence.
`high` is pinned.

## Why effort matters

- **Model time is output generation.** Every run writes at about 104–114 output tokens/s, and
  the model takes 90–93% of the agent step. Tools take 28–33 s.
- **Most output is hidden reasoning.** Two CI runs show it most clearly:

  | CI run | Visible output (text + tool inputs) | Reported output |
  | --- | --- | --- |
  | `███████████` | 3,298 + 27,814 characters, about 7.8k tokens | 31,356 tokens |
  | `███████████` | 4,364 + 26,784 characters, about 7.8k tokens | 36,697 tokens |

  That makes about 75–80% of the output hidden reasoning. The `███████████` transcript holds 23
  `thinking` blocks whose content is hidden; only their signatures are stored.
- **The effort level came from a personal settings file.** The runner started
  `claude --print --model sonnet` without `--effort`. The self-hosted runner's account had
  `"effortLevel": "xhigh"` in `~/.claude/settings.json`. Claude Code applies that setting when
  nothing explicit sets the level
  ([resolution order](https://code.claude.com/docs/en/model-config#adjust-effort-level)). The
  default for Sonnet 5 is `high`.

## Method

All runs use the same ticket and the same inputs:

| Input | Value |
| --- | --- |
| Ticket | ████████ |
| Target | `v2-preview` |
| Implementation PR | #915 |
| Code reference | `877251ce055c5a694e840886faa18516e6c5b5a6` |
| Runtime revision | `ead4b6e` (v20.1.0); the first CI run used `fa890e9` |
| Model | `claude-sonnet-5` (`--model sonnet`) |
| Claude Code | 2.1.241 |

- **Local runs** are traced stored-runner runs on the self-hosted Mac. Credentials come from
  █████████ `lab` `/runtime`, `/preview` and `/telemetry`. Each run sets
  `CLAUDE_CODE_EFFORT_LEVEL` explicitly, except the first, which inherited `xhigh`.
- **Override check.** Before the runs, the same reasoning prompt was sent at three levels. All
  three answered correctly, and output tokens fell with effort, so the variable overrides the
  inherited `xhigh`:

  | Level | Output tokens | Time |
  | --- | --- | --- |
  | Inherited `xhigh` | 583 | 9.5 s |
  | `medium` | 363 | 7.5 s |
  | `low` | 7 | 4.8 s |

- **Verdicts** come from each report's AC1 `assessment` block. **Render outcomes** come from the
  agent transcript.

## Results

| Effort | Run | Langfuse trace | Agent | Model | Output tokens | Requests | Verdict | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `xhigh` (inherited) | local | `████████████████████████████████` | 505.9 s | 465.8 s | 41,164 | 51 | AC1 pass, mixed (E1,E2,T1,T2) | delivered (v7) |
| `xhigh` | local, back-to-back | `████████████████████████████████` | 440.4 s | 399.0 s | 36,868 | 37 | AC1 pass, mixed (E1,E2,T1,T2,T3) | delivered (v13) |
| `high` | local | `████████████████████████████████` | 372.7 s | 332.4 s | 31,383 | 37 | AC1 pass, mixed (E1,E2,T1,T2,T3) | delivered (v10) |
| `high` | local, back-to-back | `████████████████████████████████` | 357.6 s | 319.8 s | 29,608 | 36 | AC1 pass, mixed (E1,E2,T1,T2) | delivered (v14) |
| `medium` | local | `████████████████████████████████` | 268.6 s | 242.0 s | 20,919 | 35 | AC1 pass, mixed (E1,E2,T1,T2) | **rejected:** no run-inspection video |

For reference, two CI runs at inherited `xhigh` on GitHub-triggered self-hosted runs:

| CI run | Langfuse trace | Agent | Model | Output tokens |
| --- | --- | --- | --- | --- |
| `███████████` | `████████████████████████████████` | 446.0 s | 403.6 s | 36,697 |
| `███████████` | `████████████████████████████████` | 372.0 s | 336.3 s | 31,356 |

**Excluded:** one `high` run (trace `████████████████████████████████`) failed for an
environment reason that has nothing to do with effort:
1. At 10:45 UTC, `session.mjs open` returned `AUTH_APP_UNAVAILABLE` twice.
2. The agent then spent 105 s searching the disk for session files (`find ~/Library …`, then
   `find / -maxdepth 6 …`).
3. The run ended with `completed capture receipt is incomplete`.

The next run, seven minutes later, authenticated normally.

## Reading

- **`high` against `xhigh`** (local runs only, same machine):
  - `high` averages **365 s**, against **473 s** for `xhigh`: −23%, about 108 s per run.
  - Output tokens average 30.5k against 39.0k: −22%.
  - Both `high` runs are faster than both `xhigh` runs.
- **Verdict equivalence.** Every delivered report gives AC1 pass with mixed evidence: two
  screenshots, two or three code references, and the run-inspection video. The number of code
  references varies within both levels. A reviewer compares the `high` drafts v10 and v14 with
  the `xhigh` draft v13 in the Drive store, under `████████/stages/20-ac-walkthrough/runs/`.
- **`medium` is rejected.** It was the fastest by far, but validation stopped it:
  `current visual section AC1 requires one screenshot-bounded run-inspection video`. Lower
  effort traded away correctness, not just time.
- **The first render fails at every level.** Every compared run hit V10
  (`block ::: technical-evidence is outside the canonical order`) on its first render. That is
  tracked separately in #117.

## Acceptance: the pinned runner

After the pin (`--effort high`, plus dropping an ambient `CLAUDE_CODE_EFFORT_LEVEL`), one traced
local run used the branch at `f523707`. It was started on purpose with an ambient
`CLAUDE_CODE_EFFORT_LEVEL=low`, while the personal `"effortLevel": "xhigh"` was still in
settings.

| Run | Langfuse trace | Agent | Model | Output tokens | Requests | Verdict | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pinned `high` | `████████████████████████████████` | 387.5 s | 346.6 s | 32,250 | 42 | AC1 pass, mixed (E1,E2,T1,T2,T3) | delivered (v15) |

- **The pin held.** The run matches the earlier `high` runs: 29.6–31.4k output tokens and
  358–373 s. It does not match `low`, and it does not match local `xhigh` (36.9–41.2k tokens,
  440–506 s).
- **Run times for ████████ on this machine.** The three `high` runs average **373 s**, against
  **473 s** for the two `xhigh` runs: −21%, about 100 s per run.
- **V10 again.** The first render failed V10, as in every other run
  (#117).

## Limits

- **Few runs, one ticket.** Two runs per compared level, all on ████████, which has one AC. A
  ticket with more ACs, or more judgment, could react differently to lower effort. Recheck
  after a change of model or of Claude Code version.
- **Local and CI absolute times differ.** CI `xhigh` runs took 372–446 s. Compare like with
  like.
- **Personal Serena configuration.** Local runs also received failures from it (`Too many
  consecutive read calls without using symbolic tools`), because the runner account's personal
  configuration reaches the agent. It affects every level equally and is out of scope here.
