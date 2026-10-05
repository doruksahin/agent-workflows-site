---
title: Observability
summary: See where an unattended agent run spends its time, using Claude Code's built-in OpenTelemetry export and a self-hosted Langfuse.
date: 2026-10-05
tags: [langfuse, observability, claude-code]
source: Generalized from private work notes, October 2026.
---

An unattended agent run that takes twelve minutes tells you nothing about why. This note explains how to get a timed trace of each model request and tool call, and how to read it.

| Read | When |
| --- | --- |
| This page | To learn what is traced, what is exported, and how to turn tracing on |
| [Diagnose a run in the Langfuse UI](diagnose-in-langfuse-ui.md) | You want to look at a slow run, with screenshots of each step |
| [Diagnose a run with the CLI](diagnose-with-cli.md) | You want exact totals, comparisons between runs, or an agent to do the diagnosis |

The setup was tested with Claude Code 2.1.241 and a self-hosted Langfuse 4.x.

## Why trace an agent run

A runner that starts `claude --print --output-format json` gets one result object when the agent stops. That object gives the total time and the token usage. It does not tell you where the minutes went.

Wall time alone does not separate three different causes:

- **Slow model requests.** Many turns add up, or one request writes a very long output.
- **Slow tools.** One command waits for a long time, for example a polling loop that the agent wrote.
- **Retries.** A command fails, and the agent does more turns to correct the result.

Each cause has a different fix. A trace shows which cause applies to a specific run.

## How it works

![Claude Code sends spans over OTLP to Langfuse, where the UI and CLI read them](./images/trace-pipeline.svg)

Claude Code produces the OpenTelemetry spans itself. The runner only sets environment variables, and it sets them for the agent process only. Claude Code sends the spans over OTLP/HTTP to the Langfuse endpoint `/api/public/otel`.

There is no SDK, no hook, no OpenTelemetry Collector, and no transcript parser.

To turn tracing on, start the agent with these variables. The values are placeholders. Replace the host and the Langfuse project key pair with your own.

```sh
# Build the header value from the Langfuse project key pair.
# Keep the literal space after "Basic".
AUTH="$(printf '%s:%s' 'pk-lf-…' 'sk-lf-…' | base64 | tr -d '\n')"

env \
  CLAUDE_CODE_ENABLE_TELEMETRY=1 \
  CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1 \
  OTEL_TRACES_EXPORTER=otlp \
  OTEL_METRICS_EXPORTER=none \
  OTEL_LOGS_EXPORTER=none \
  OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://langfuse.example.com/api/public/otel" \
  OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $AUTH,x-langfuse-ingestion-version=4" \
  OTEL_LOG_TOOL_DETAILS=1 \
  OTEL_TRACES_EXPORT_INTERVAL=1000 \
  CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS=15000 \
  CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS=15000 \
  CLAUDE_CODE_OTEL_DIAG_STDERR=1 \
  OTEL_RESOURCE_ATTRIBUTES="run.ticket=PROJ-123,run.target=staging" \
  claude --print "<your prompt>"
```

| Variable | What it does |
| --- | --- |
| `CLAUDE_CODE_ENABLE_TELEMETRY`, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` | Turn on the telemetry. The trace spans are a beta feature. |
| `OTEL_TRACES_EXPORTER=otlp`, with metrics and logs set to `none` | Send traces only. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | Send the spans to the Langfuse project, with its key pair. |
| `OTEL_LOG_TOOL_DETAILS=1` | Add the command text to each tool span. |
| `OTEL_TRACES_EXPORT_INTERVAL=1000` | Send spans every 1 s while the agent runs. |
| `CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS`, `CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` | Give the last spans time to arrive when the agent stops. |
| `CLAUDE_CODE_OTEL_DIAG_STDERR=1` | Write export errors to standard error, so that they appear in the job log. |
| `OTEL_RESOURCE_ATTRIBUTES` | Add the identity of the run to every span. |

If the header or the endpoint is wrong, the run continues and only the spans are lost. A trace is a diagnostic aid. It never changes the outcome of the run.

## What each observation tells you

Langfuse stores each span as an observation. A traced run has these observations:

| Observation | Langfuse type | Tells you |
| --- | --- | --- |
| `claude_code.interaction` | span | The whole agent run. Its latency is the agent wall time. It arrives last, when the agent stops. |
| `claude_code.llm_request` | generation | One model request: its latency, the time to first token, and the token counts. |
| `claude_code.tool` | tool | One tool call: its latency, the tool name, and the command text. |
| `claude_code.tool.execution` | tool | The time that the tool actually ran. A failed shell command is marked `ERROR`. |
| `claude_code.tool.blocked_on_user` | span | The time spent waiting for permission. In an unattended run, this is near zero. |

These metadata fields are the most useful:

| Field | On | Meaning |
| --- | --- | --- |
| `attributes.duration_ms` | Requests and tools | The duration in milliseconds |
| `attributes.ttft_ms` | `claude_code.llm_request` | The time to the first token |
| `attributes.output_tokens`, `attributes.input_tokens`, `attributes.cache_read_tokens` | `claude_code.llm_request` | The token counts |
| `attributes.tool_name` | `claude_code.tool` | The tool, for example `Bash` or `Edit` |
| `attributes.full_command` | `claude_code.tool` | The shell command, when `OTEL_LOG_TOOL_DETAILS=1` is set |
| `attributes.file_path` | `claude_code.tool` | The file that a file tool used |

Put the identity of the run in `OTEL_RESOURCE_ATTRIBUTES`. Use short, generic keys, for example `run.ticket` and `run.target`. In CI, also add the CI run ID, for example as `cicd.pipeline.run.id`. In GitHub Actions, set `OTEL_RESOURCE_ATTRIBUTES="run.ticket=PROJ-123,run.target=staging,cicd.pipeline.run.id=$GITHUB_RUN_ID"`. Each key then appears on every observation as `resourceAttributes.<key>`. You can filter on it in the UI and in the CLI.

## What is exported, and what is not

Claude Code does not export these items:

- **Prompt text.** The prompt attribute shows `<REDACTED>`.
- **Model responses.**
- **Tool output.**

A trace shows what ran and how long it took. It does not show what the commands returned.

Claude Code does export these items:

- **Command text**, when `OTEL_LOG_TOOL_DETAILS=1` is set. Commands can contain paths and arguments. Keep secrets in the environment, not in command arguments.
- **The identity of the signed-in account.** Under OAuth, Claude Code adds `user.email`, `user.account_uuid`, `user.account_id`, and `organization.id` to every span. As of version 2.1.241, the Claude Code documentation offers no switch that removes them from spans.

The privacy lesson: a trace is not anonymous. Send it only to a backend that you control. If the account identity must not leave the machine, remove it in an OpenTelemetry Collector before the spans reach the backend. The Langfuse UI also shows the user identifier in the trace header. Redact it before you share a screenshot.

## Lessons

- **Read the CI step durations first.** Only the agent process is traced. The timings of all other steps come from the CI job, not from the trace.
- **The root span arrives last.** Spans arrive while the agent runs, and `claude_code.interaction` arrives when the agent stops. If a trace has spans but no `claude_code.interaction`, the agent is still running, or it was stopped before the last flush.
- **A fast first token means a large output.** A long model request with a time to first token of about 1 s spends its time writing. The API is not slow.
- **One tool call is not one command.** A single Bash call can contain several commands. Read `attributes.full_command` before you blame one command.
- **Use the v2 observations API.** In the events-only mode of Langfuse 4.x, a v1 trace read returns 404. Use `observations list`, which uses `/api/public/v2/observations`.
- **Some IDs are numbers.** The CI run ID is stored as a number. A `jq` comparison with a quoted string finds nothing. Use `tostring`, or compare with a number.
- **Langfuse shows no cost.** Claude Code does not use the `gen_ai.usage.*` names for its token counts. Langfuse keeps them as metadata, not as usage. Keep a separate record of cost.
- **Keep the literal space after `Basic`.** The header form `Authorization=Basic <base64>` was tested and works. A percent-encoded `Basic%20…` value was not tested. Also remove the line breaks from the encoded value: macOS `base64` does not wrap its output, but GNU and BusyBox `base64` wrap it at 76 columns.
- **Export errors go to the log.** A wrong key pair shows `OTEL diag error` with code 401. An unreachable host shows `ECONNREFUSED`. To make sure that the host responds, request `/api/public/health`. It returns `{"status":"OK"}`.
- **An unreachable endpoint makes the exit slower.** The agent can wait up to approximately 30 s when it stops: 15 s for the flush, and 15 s for the shutdown.
- **Give the trace settings to the agent process only.** Do not let the agent inherit `OTEL_*` variables from the runner environment. With tracing off, remove them. In the tested version, Claude Code also removed `OTEL_*` from the environment of its Bash tool and its hooks. Anthropic does not document this behavior.
- **Span names can change.** The spans come from a beta feature of Claude Code. Pin the Claude Code version, and make sure that the trace still works after each upgrade.
