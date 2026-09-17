# Agent Workflows — the website

Public field guide: **https://workflows.doruk.uk**

An Astro static site explaining the tools in the Agent Workflows ecosystem. It contains a tool catalog, a sourced workflow guide, and a downloadable interactive Archify map.

## Develop

Requires Node.js 22.12+ (Node 24 is used in deployment).

```sh
npm ci
npm run dev
```

## Verify

```sh
npm run verify
```

Builds the site and checks local link targets, source provenance, referenced tool relationships, and the included map checksum. Production output is in `dist/`.

## Edit content

- `src/data/tools.json`: tool explanations and reviewed source references.
- `src/pages/guides/*.md`: Markdown walkthroughs with inline source links.
- `src/pages/about.astro`: editorial scope and source policy.
- `public/maps/`: standalone Archify HTML; `content/maps/` owns its input and provenance.

The referenced repositories own installation, behavior, releases, and architecture contracts. This website owns explanatory writing. Private source links are explicitly labeled; public availability of this site does not grant repository access.

Review the actual source revision before updating a claim. Update the commit reference and reviewed date together. Do not publish real task packets, tickets, customer evidence, local session histories, or credentials.

## Deploy

See [deployment.md](deployment.md). Coolify builds the Dockerfile and serves the static output through Nginx. There are no application secrets or runtime environment variables.

To link here from a tool repository, use the permanent route for that tool, for example:

```md
[How this tool fits into the workflow](https://workflows.doruk.uk/tools/agent-sessions/)
```
