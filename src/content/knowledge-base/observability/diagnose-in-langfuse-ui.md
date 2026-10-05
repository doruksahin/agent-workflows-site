---
title: Diagnose a run in the Langfuse UI
summary: Find the slow part of a traced agent run in the Langfuse UI, step by step, with a screenshot of each step.
date: 2026-10-05
tags: [langfuse, observability]
source: Generalized from private work notes, October 2026.
---

Use the Langfuse UI to look at a slow run, with a screenshot of each step. [Observability](README.md) explains how to turn tracing on and what each observation means. The screenshots come from Langfuse 4.50.0.

This procedure uses one real run as an example. In that run, the agent step took 459 s of a 702 s CI job. The CI step time includes more than the agent span, which took 446 s.

## 1. Make sure that the agent step is the slow part

Open the CI run and read the duration of each step. Only the agent step is traced. If a different step takes most of the time, the trace cannot explain it.

## 2. Find the slow observations

1. Sign in to Langfuse and open the project.
2. Select **Tracing**.
3. Set the time range at the top right so that it includes the run, for example **Past 1 day**.
4. Type this filter in the search box, and press Enter:

   ```text
   latency:>20 metadata.resourceAttributes.run.ticket:PROJ-123
   ```

You can also make the same filter in the filter panel. Set **Latency (s)** to `> 20`. Then add a **Metadata** filter on the key `resourceAttributes.run.ticket`.

![Langfuse observations table with two claude_code.interaction rows and seven claude_code.llm_request rows, each over 20 seconds](./images/01-tracing-search.jpg)

In this deployment, the Tracing table lists observations, not traces. Each run has one `claude_code.interaction` row. The table shows two, because the filter also matches an earlier local run of the same task. All other rows are model requests that took more than 20 s. No tool call took more than 20 s. Thus, the slow parts of this run are model requests, not tools.

The UI shows times in the local time of the browser. The CLI shows UTC.

## 3. Open the run

Click the `claude_code.interaction` row of the run.

![Trace tree: the interaction span at 7m 26s, then model requests and tool calls, each tool call with its permission-wait and execution children](./images/02-trace-tree.jpg)

- The `claude_code.interaction` row shows the agent wall time, here `7m 26s`.
- The metadata shows the resource attributes. The CI run ID connects the trace to the CI run.
- The tree lists the run in order. A model request comes first, and then its tool call. Each tool call has an execution child and a permission-wait child.

## 4. Look at the shape of the run

Select **Timeline** instead of **Tree**. Each bar is one observation on the clock of the run.

![Trace timeline: a staircase of short bars, with one wide bar about three minutes into the run](./images/03-trace-timeline.jpg)

- **A model-bound run** looks like a staircase of short bars, with some long bars. The long bars are model requests.
- **A tool-bound run** has one wide tool bar instead. In a different run, two polling loops that the agent wrote took 449 s and 120 s.

This example run is model-bound.

## 5. Examine the widest bar

Click the widest bar. In the right panel, select **Attributes** instead of **Preview**.

In the example, the bar is a `claude_code.llm_request` that took 1 min 40 s:

| Attribute | Value |
| --- | --- |
| `attributes.output_tokens` | `9722` |
| `attributes.duration_ms` | `100682` |
| `attributes.ttft_ms` | `1104` |

The first token arrived after approximately 1 s. The model used the remaining 99 s to write almost 10,000 tokens. A long request with a fast first token is a large output. It is not a slow API.

## 6. Find what the long request caused

Select **Tree** again. The selected request stays highlighted. Click the `claude_code.tool` row directly below it, and open **Attributes**.

![Trace tree: after the 1m 40s model request, the next tool call has an execution child marked ERROR](./images/05-next-tool-call.jpg)

In the example, the agent wrote a draft of its report in the long request. Then it searched the repository for an example of the report format. The search found nothing, and its execution is marked `ERROR`. Later, the first render of the report failed. The agent edited the report and rendered it again.

The diagnosis: the run is model-bound. Much of its time goes into writing the report and correcting its format. The fix is to give the agent the report format before it starts to write.

## 7. Share the evidence

The URL in the address bar points to the selected observation, in the form `…/traces/<trace-id>?observation=<id>`. Put this URL in the ticket or pull request, next to the diagnosis.

## When the shape is different

| What you see | What it means | Where to look next |
| --- | --- | --- |
| One wide `claude_code.tool` bar | The agent waits on a command, often a poll for the application. | `attributes.full_command` on that bar. Replace the improvised poll with a bounded wait. |
| Many short bars and no outlier | The number of turns sets the time. | Count the model requests [with the CLI](diagnose-with-cli.md#3-split-model-time-from-tool-time), and reduce the turns. |
| Tool executions marked `ERROR` | The agent did more turns after failed commands. | The failed command, and the tool calls after it. |
| A long `claude_code.tool.blocked_on_user` | The agent waited for permission. | How the runner gives permissions. An unattended run shows near zero. |
