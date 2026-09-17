---
layout: ../../layouts/Article.astro
title: From a Jira ticket to a reviewed report
description: Follow the task context, evidence, and review decisions across four separate responsibilities.
---

A Jira issue gives a team a starting point. A useful verification report needs more: a stable task snapshot, a running implementation, approved criteria, and evidence someone can inspect.

This guide follows the **stored-packet route** described by the system’s [workflow playbook](https://github.com/doruksahin/plugin-architecture/blob/500efba206ed7011896df1eb259801229b48d19e/docs/workflows.md). That source is private and requires repository access. The guide explains the flow; the owning repositories provide the complete installation and execution instructions.

> **The path:** Jira issue → frozen packet → stored verification run → human review → Jira attachment and comment.

## 1. Freeze the task context

**Owner: [Jira to Packet](/tools/jira-to-packet/)**

Start with a Jira ticket key, Jira read credentials, a store configuration, and a fresh processing workspace. The producer calls the Jira exporter, checks its receipt, and prepares the task packet.

It then saves the packet, fetches a fresh copy, and compares the saved files and packet identity. Success means the result contains a `packet-ready` status, a packet digest, and the actual saved location.

The distinction matters: exporting Jira into Markdown is only one part of producing a verified stored packet. The [exporter](/tools/jira-markdown-exporter/) owns the Jira snapshot; the producer owns composing that snapshot into the packet and checking its saved form.

**Inspect the result:** check the producer’s JSON receipt and use its reported location. A successful export alone is not proof that the packet reached the store.

Source: [producer README](https://github.com/doruksahin/jira-to-packet/blob/9170efa1b16fccb64986d7878a0f808b39e1cf2e/README.md) and [CLI playbook](https://github.com/doruksahin/jira-to-packet/blob/9170efa1b16fccb64986d7878a0f808b39e1cf2e/docs/cli.md), private source.

## 2. Keep storage separate from execution

**Owner: [Task Packet Store](/tools/task-packet-store/)**

The store can be a filesystem directory, a Google Shared Drive, or a git repository. A credential-free configuration selects the driver. Credentials, when needed, are supplied separately.

The machine that runs a workflow is a separate choice. It needs the relevant tools, temporary working space, and—when capturing behavior—a supported browser and running application. Saving a packet to Drive does not make Drive an execution host.

| Thing | Responsibility |
| --- | --- |
| Frozen packet | The stable task input passed between tools |
| Processing workspace | Temporary working files on the execution machine |
| Stored stage run | The saved result and evidence from a workflow attempt |
| Location receipt | Where the actual saved artifact can be found |

The store’s commands reserve a stage run, checkpoint files into it, and resolve their location. Storage success says that the artifacts were saved. It says nothing about whether the implementation meets its acceptance criteria.

Source: [store README](https://github.com/doruksahin/task-packet-store/blob/1749b74322e221bb864b89dfd000da3e51da8afe/README.md), private source.

## 3. Verify the implementation and save the evidence

**Owner: [AC Walkthrough](/tools/ac-walkthrough/)**

The stored-packet runner consumes a packet that already exists. It does not create a missing packet from Jira. It also needs the application and capture environment prepared according to its own instructions.

At the reviewed architecture snapshot, the playbook’s example targets an already-running `v2-mock` application at `http://localhost:5173/`. That example is not a promise that any arbitrary preview URL can be substituted. Use the [portable workflow instructions](https://github.com/AdCreative-ai/AC-visual-walkthrough/blob/67cf6fb976d0076399cb1913b763c9bebb9d58c4/docs/portable-workflows.md) for the supported setup.

The runner fetches and validates the packet, reserves a stage run, and executes the AC workflow. The authoring lifecycle is:

1. **Prepare:** identify the task input, approved criteria, and capture target.
2. **Capture:** record the relevant behavior with reproducible steps and evidence.
3. **Judge:** assess each criterion against that evidence.
4. **Build the report:** render the versioned HTML and its supporting material.
5. **Human review:** inspect the report and its conclusions.

The stored route checkpoints the result under a `20-ac-walkthrough` run and reports the primary HTML location with supporting evidence. The final save must succeed before the command reports saved output.

**Inspect the result:** open the primary HTML, follow the reproduction steps, and check that verdicts are supported by the captured evidence. A saved draft still requires review.

The interactive skills and the stored-packet runner have distinct entry points. Do not assume that every interactive run supports saving into a task packet.

Sources: [AC README](https://github.com/AdCreative-ai/AC-visual-walkthrough/blob/67cf6fb976d0076399cb1913b763c9bebb9d58c4/README.md), [portable workflows](https://github.com/AdCreative-ai/AC-visual-walkthrough/blob/67cf6fb976d0076399cb1913b763c9bebb9d58c4/docs/portable-workflows.md), and [Pathfinder’s routing boundary](https://github.com/doruksahin/agent-workflows/blob/18ffb6cdd825278ae1236d7c7d4facfaa54145e9/plugins/adc-pathfinder/README.md), private sources.

## 4. Review the exact publication inputs

**Owners: the workflow’s publisher adapter and [Jira Handoff](/tools/jira-handoff/)**

The workflow prepares the exact attachment and Jira comment. It freezes those bytes together with the issue key and publication identity, then presents that concrete publication for human review.

After authorization, the shared transport checks the identity before making a Jira write. It uploads the attachment, inserts the resulting attachment URL into the prepared comment, posts the comment, and saves a receipt.

The division of responsibility is deliberate:

- **The workflow** understands the report, writes the summary, prepares Jira ADF, and owns the review gate.
- **The transport** owns the upload, comment request, input identity checks, and publication receipt.

If the attachment or comment changes, the publication identity and review must be renewed. Reusing a matching completed receipt returns the recorded result without another write. An uncertain or incomplete receipt needs inspection before an automatic retry.

**Inspect the result:** confirm the receipt records the intended issue, attachment, and comment. Publication does not approve the evidence or change the issue’s status.

Source: [Jira Handoff contract](https://github.com/doruksahin/agent-workflows/blob/18ffb6cdd825278ae1236d7c7d4facfaa54145e9/packages/jira-handoff/README.md) and [publication ownership](https://github.com/doruksahin/plugin-architecture/blob/500efba206ed7011896df1eb259801229b48d19e/docs/workflows.md), private sources.

## Where Recon fits

[Recon](/tools/recon/) answers a different question: is this task actionable, what code is involved, and what should be handed off before implementation?

It is not a required stage between packet creation and AC verification. Its optional store adapter accepts a current workspace that already contains `report/dossier.html` and saves a `10-recon` run. That adapter does not rerun the agent or imply that all Recon entry points consume stored task packets.

Source: [Recon pipeline](https://github.com/AdCreative-ai/recon-plugin/blob/87148d77016b9011319124d196f6036416a0d9e3/README.md) and [storage contract](https://github.com/AdCreative-ai/recon-plugin/blob/87148d77016b9011319124d196f6036416a0d9e3/recon/docs/storage.md), public source.

## Choose your next step

- To understand responsibilities at a glance, open the [interactive system map](/map/).
- To prepare the actual commands and dependencies, use the linked owner playbooks for your installed version.
- To find a tool for a different task, return to the [catalog](/tools/).

This is a source-based explanation of the reviewed workflow contract, not evidence that a particular ticket has been run successfully. Each real run produces its own artifacts and receipts.
