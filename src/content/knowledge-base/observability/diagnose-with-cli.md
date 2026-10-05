---
title: Diagnose a run with the CLI
summary: Get exact totals for a traced agent run, compare it with a second run, and find its slow and failed tool calls with the Langfuse CLI.
date: 2026-10-05
tags: [langfuse, observability, claude-code]
source: Generalized from private work notes, October 2026.
---

Use the CLI for exact totals, for comparisons between runs, or when an agent does the diagnosis. This guide uses the same example run as [Diagnose a run in the Langfuse UI](diagnose-in-langfuse-ui.md). [Observability](README.md) explains how to turn tracing on and what each observation means.

The official Langfuse skill drives `npx langfuse-cli`. To install the skill for Claude Code and Codex, run:

```sh
npx skills add langfuse/skills --skill langfuse -g -a claude-code -a codex --copy
```

The CLI reads `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY`, and `LANGFUSE_SECRET_KEY` from the environment. Load them from your secret store for each command. Do not print the keys, and do not paste them into a chat.

To list the resources, run `npx langfuse-cli api __schema`. To list the filters and the `--fields` groups, run `npx langfuse-cli api observations list --help`.

## 1. Make sure that the agent step is the slow part

For GitHub Actions, this command prints the duration of each step:

```sh
gh run view <run-id> --repo <owner>/<repo> --json jobs \
  --jq '.jobs[0].steps[] | select(.conclusion != "skipped" and (.name | startswith("Post") | not)) | "\(.name)\t\(((.completedAt|fromdate)-(.startedAt|fromdate)))s"'
```

## 2. Find the trace of the run

```sh
npx langfuse-cli api observations list --name claude_code.interaction \
  --from-start-time 2026-10-05T00:00:00Z --fields core,metadata,metrics --limit 100 \
  | jq -r --arg t PROJ-123 '.data[] | select(.metadata["resourceAttributes.run.ticket"] == $t)
      | "\(.startTime) trace=\(.traceId) agent=\(.latency)s run=\(.metadata["resourceAttributes.cicd.pipeline.run.id"] // "local")"'
```

Each line gives a start time, a trace ID, the agent wall time, and the CI run ID. A local run shows `run=local`.

## 3. Split model time from tool time

```sh
npx langfuse-cli api observations list --trace-id <trace-id> \
  --fields core,basic,metrics --limit 1000 \
  | jq -r '.data | map(select(.name == "claude_code.interaction" or .name == "claude_code.llm_request" or .name == "claude_code.tool"))
      | group_by(.name)[] | "\(.[0].name)\t\(length)\t\((map(.latency // 0) | add) | floor)s"'
```

The output of the example run:

```text
claude_code.interaction  1   446s
claude_code.llm_request  41  403s
claude_code.tool         54  32s
```

This is the decision point. The model used 403 s of 446 s, which is 90%. The tools used 32 s. The run is model-bound, and faster tools can save 32 s at most. If the tools used most of the time, step 4 names the command to correct.

## 4. List the slowest tool calls

```sh
npx langfuse-cli api observations list --trace-id <trace-id> --name claude_code.tool \
  --fields core,metadata,metrics --expand-metadata attributes.full_command --limit 1000 \
  | jq -r '.data | map(select(.latency != null)) | sort_by(-.latency) | .[0:5][]
      | "\(.latency)s  \(.metadata["attributes.full_command"] // .metadata["attributes.tool_name"])"'
```

One tool call can contain several commands. In the example, the slowest tool call took 7.8 s, and it contained three browser-capture commands.

## 5. Find what the long model requests caused

The latency of a request is mostly the time that the model uses to write its output. To see what that output was for, pair each long request with the next tool call:

```sh
npx langfuse-cli api observations list --trace-id <trace-id> \
  --fields core,basic,metadata,metrics --expand-metadata attributes.full_command,attributes.file_path --limit 1000 \
  | jq -r '(.data | map(select(.latency != null)) | sort_by(.startTime)) as $o
      | ($o | map(select(.name == "claude_code.tool"))) as $t
      | $o[] | select(.name == "claude_code.llm_request" and .latency > 20) as $g
      | ([ $t[] | select(.startTime >= $g.endTime) ][0]) as $n
      | "\($g.startTime[11:19]) model \($g.latency)s out=\($g.metadata["attributes.output_tokens"]) → next: \($n.metadata["attributes.tool_name"] // "end") \($n.metadata["attributes.file_path"] // $n.metadata["attributes.full_command"] // "")"'
```

## 6. Find failed commands

```sh
npx langfuse-cli api observations list --trace-id <trace-id> \
  --fields core,basic,metadata --expand-metadata attributes.full_command --limit 1000 \
  | jq -r '.data as $all | $all[] | select(.level == "ERROR") as $e
      | ($all[] | select(.id == $e.parentObservationId)) as $p
      | "\($e.startTime[11:19]) \($e.statusMessage)  \($p.metadata["attributes.full_command"])"'
```

A failed execution is a child of its tool call. The command text is on the parent. If you use `--level ERROR` alone, the CLI lists the failed executions without their commands.

## 7. Compare with a second run

Do step 3 again for a second run of the same task. In the example, a local run of the same task gave this result:

| | CI run | Local run |
| --- | --- | --- |
| Agent wall time | 446 s | 506 s |
| Model requests | 41, 403 s | 51, 7.8 min |
| Tool calls | 54, 32 s | 60, 29.5 s |
| Longest model request | 100.7 s, 9,722 tokens | 1.7 min, 10,745 tokens |

The two runs have the same shape. One run can give an incorrect conclusion. Two runs that agree give a finding that you can act on.

## 8. Decide

| Evidence | Next step |
| --- | --- |
| Model-bound, with format searches and a failed render after the draft | Give the agent the output format before it starts to write. |
| One tool call that takes more than a minute | Correct that command, or give the agent a bounded wait instead of an improvised poll. |
| Neither | The number of turns sets the time. Reduce the turns, not the tool time. |

After a change, run the same task again and do steps 2 and 3. The two traces are the before-and-after evidence.
