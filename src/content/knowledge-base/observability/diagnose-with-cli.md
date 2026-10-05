---
title: "Diagnose a run with the CLI"
summary: "This guide works through the same CI run as the UI manual: ████████, CI run ███████████ of the ██████████-ai/██████████-Frontend-V2 trial workflow, recorded on 2026-10-05. Use it when you need exact totals, a comparison between runs, or an agent to do the diagnosis. Every command and output below is from that session. Long paths are shortened to …."
date: 2026-10-05
tags: [langfuse, observability, claude-code]
source: "Synced from a private repository's docs. Private details are redacted."
verbatim: true
---
# Diagnose a run with the CLI

This guide works through the same CI run as [the UI manual](diagnose-in-langfuse-ui.md):
████████, CI run `███████████` of the `██████████-ai/██████████-Frontend-V2` trial workflow,
recorded on 2026-10-05. Use it when you need exact totals, a comparison between runs, or an agent
to do the diagnosis. Every command and output below is from that session. Long paths are shortened
to `…`.

Run every command under the `/telemetry` credentials, as described in
[Observability](README.md#set-up-once-per-machine):

```bash
█████████ run --domain "$█████████_URL" --projectId "$█████████_PROJECT_ID" \
  --env lab --path /telemetry --include-imports=false --recursive=false --expand=false -- \
  <command>
```

`npx langfuse-cli api __schema` lists the resources. `npx langfuse-cli api observations list --help`
lists the filters and the `--fields` groups.

## 1. Check that the agent step is the slow part

```bash
gh run view ███████████ --repo ██████████-ai/██████████-Frontend-V2 --json jobs \
  --jq '.jobs[0].steps[] | select(.conclusion == "success" and (.name | startswith("Post") | not)) | "\(.name)\t\(((.completedAt|fromdate)-(.startedAt|fromdate)))s"'
```

```text
Set up job	56s
Show run configuration	0s
Fetch Jira packet and prepare verification	66s
Check verification readiness	17s
Initialize verification	38s
Verify ACs and capture evidence	459s
Validate report and collect traces	3s
Publish report to Drive	55s
Report outcome and upload evidence	7s
Complete job	1s
```

The agent step takes 459 s of 702 s, which is 65% of the job, so the trace can answer the
question.

## 2. Find the run's trace

```bash
npx langfuse-cli api observations list --name claude_code.interaction \
  --from-start-time 2026-10-05T00:00:00Z --fields core,metadata,metrics --limit 100 \
  | jq -r --arg t ████████ '.data[] | select(.metadata["resourceAttributes.ac.ticket"] == $t)
      | "\(.startTime) trace=\(.traceId) agent=\(.latency)s run=\(.metadata["resourceAttributes.cicd.pipeline.run.id"] // "local")"'
```

```text
2026-10-05T08:46:52.174Z trace=████████████████████████████████ agent=446.041s run=███████████
2026-10-05T08:32:20.374Z trace=████████████████████████████████ agent=505.857s run=local
```

The `run` value matches the GitHub run. The local run of the same ticket is used in step 7.

## 3. Split model time from tool time

```bash
npx langfuse-cli api observations list --trace-id ████████████████████████████████ \
  --fields core,basic,metrics --limit 1000 \
  | jq -r '.data | map(select(.name == "claude_code.interaction" or .name == "claude_code.llm_request" or .name == "claude_code.tool"))
      | group_by(.name)[] | "\(.[0].name)\t\(length)\t\((map(.latency // 0) | add) | floor)s"'
```

```text
claude_code.interaction  1   446s
claude_code.llm_request  41  403s
claude_code.tool         54  32s
```

**This is the decision point.** The model takes 403 of 446 s, which is 90%. Tools take 32 s. The
run is **model-bound**, and faster tools would save at most 32 s. If tools held most of the time,
the run would be tool-bound, as with ████████'s 449 s polling loop, and step 4 would name the
command to fix.

## 4. List the slowest tool calls

```bash
npx langfuse-cli api observations list --trace-id ████████████████████████████████ --name claude_code.tool \
  --fields core,metadata,metrics --expand-metadata attributes.full_command --limit 1000 \
  | jq -r '.data | map(select(.latency != null)) | sort_by(-.latency) | .[0:5][]
      | "\(.latency)s  \(.metadata["attributes.full_command"] // .metadata["attributes.tool_name"])"'
```

```text
7.814s  node session.mjs screenshot --sequence 9 --slug plans-page-popover-closed --full-page false --selection …
echo
node session.mjs trace-stop --sequence 10 --selection … 2>&1 | head -c 500
echo
node session.mjs video-stop --sequence 11 --selection … 2>&1 | head -c 1500
6.642s  node session.mjs open --selection … 2>&1
6.095s  node session.mjs video-start --sequence 5 --ac AC1 --slug profile-popover-view-plans --selection … 2>&1
1.619s  echo "=== packet dir ==="; ls -la … echo "=== source-evidence dir ==="; ls -la …
1.598s  node session.mjs click --sequence 8 --ref f3e572 --selection … 2>&1
```

One tool call can hold several commands. The 7.8 s call is a screenshot, `trace-stop` and
`video-stop` together. Browser capture takes a few seconds per call, so it is not the problem.

## 5. Find what the long model requests led to

A request's latency is mostly the time spent writing output. Pair each long request with the
next tool call to see what that output was for:

```bash
npx langfuse-cli api observations list --trace-id ████████████████████████████████ \
  --fields core,basic,metadata,metrics --expand-metadata attributes.full_command,attributes.file_path --limit 1000 \
  | jq -r '(.data | map(select(.latency != null)) | sort_by(.startTime)) as $o
      | ($o | map(select(.name == "claude_code.tool"))) as $t
      | $o[] | select(.name == "claude_code.llm_request" and .latency > 20) as $g
      | ([ $t[] | select(.startTime >= $g.endTime) ][0]) as $n
      | "\($g.startTime[11:19]) model \($g.latency)s out=\($g.metadata["attributes.output_tokens"]) → next: \($n.metadata["attributes.tool_name"] // "end") \($n.metadata["attributes.file_path"] // $n.metadata["attributes.full_command"] // "")"'
```

```text
08:49:28 model 25.72s out=2378 → next: Bash cd …/ac-walkthrough-plugin && grep -rn "unverified" runtime/scripts/ | grep -v node_module…
08:49:59 model 100.682s out=9722 → next: Bash find runtime/scripts/fixtures -iname "*.md" | xargs grep -l "technical-evidence" …
08:52:19 model 42.808s out=4685 → next: Edit …/████████-ac-verification-v5.walkthrough.md
08:53:27 model 22.241s out=3198 → next: Edit …/████████-ac-verification-v5.walkthrough.md
```

The 100.7 s request drafts the report: 9,722 output tokens. Then, before the first edit, the
agent searches the runtime and fixtures for format examples.

## 6. Find failed commands

```bash
npx langfuse-cli api observations list --trace-id ████████████████████████████████ \
  --fields core,basic,metadata --expand-metadata attributes.full_command --limit 1000 \
  | jq -r '.data as $all | $all[] | select(.level == "ERROR") as $e
      | ($all[] | select(.id == $e.parentObservationId)) as $p
      | "\($e.startTime[11:19]) \($e.statusMessage)  \($p.metadata["attributes.full_command"])"'
```

```text
08:53:07 Shell command failed  cd … && node "████████████████████████████████████.mjs" render "…" "████████" "…" 2>&1
08:51:40 Shell command failed  find runtime/scripts/fixtures -iname "*.md" | xargs grep -l "technical-evidence"
```

Both failures fit the same story:
- the format search right after the draft found nothing;
- the first render rejected the report, which led to the 08:53:27 request, an edit, and a
  successful re-render at 08:53:54.

`--level ERROR` on its own lists the failed executions without their commands.

## 7. Compare with another run

Repeat step 3 for the local run, trace `████████████████████████████████`:

| | CI run ███████████ | Local run (v7) |
| --- | --- | --- |
| Agent wall time | 446 s | 506 s |
| Model requests | 41, 403 s | 51, 7.8 min |
| Tool calls | 54, 32 s | 60, 29.5 s |
| Longest model request | 100.7 s, 9,722 tokens | 1.7 min, 10,745 tokens |

Both runs have the same shape. One run can mislead, but two runs that agree make the finding
actionable.

## 8. Decide

| Evidence | Next step |
| --- | --- |
| Model-bound, with format searches and a rejected render during authoring (steps 3, 5, 6, 7) | Give the agent the report format before it starts writing. Success looks like fewer generations after the draft, no failed render, and a shorter `claude_code.interaction`. |
| One tool call over a minute (████████) | Fix that command, or give the agent a bounded wait instead of improvised polling. |
| Neither | Turn count sets the time. Reduce turns, not tool time. |

After a change, rerun the ticket and repeat steps 2–3. The two traces are the before-and-after
evidence.
