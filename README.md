# Agent Workflows — the website

Public field guide: **https://workflows.doruk.uk**

An Astro static site explaining the tools in the Agent Workflows ecosystem. Explore the
[visual tool and repository catalog](https://workflows.doruk.uk/tools/), expand source
references, follow a [workflow guide](https://workflows.doruk.uk/guides/), or open the
[full-page Archify map](https://workflows.doruk.uk/map/).

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

The **Verify** GitHub Actions workflow runs these checks on pull requests and manual
dispatches. **Release Please** reuses the same check on pushes to `main` before
managing a release, then checks the exact head commit of the open release PR,
including unchanged PRs on retries. Each verification job has read-only repository
permissions.

## Edit content

- `src/data/tools.json`: tool explanations and reviewed source references.
- `src/pages/guides/*.md`: Markdown walkthroughs with inline source links.
- `src/pages/about.astro`: editorial scope and source policy.
- `src/components/`: reusable tool cards, icons, and visual workflow steps.
- `src/pages/map.astro`: the full-page map and expandable GitHub references.
- `public/maps/`: standalone Archify HTML; `content/maps/` owns its input and provenance.

The referenced repositories own installation, behavior, releases, and architecture contracts. This website owns explanatory writing. Private source links are explicitly labeled; public availability of this site does not grant repository access.

Review the actual source revision before updating a claim. Update the commit reference and reviewed date together. Do not publish real task packets, tickets, customer evidence, local session histories, or credentials.

## Version and release

[Release Please](https://github.com/googleapis/release-please) manages one website
version using the Node strategy. It updates `package.json`, `package-lock.json`,
`.release-please-manifest.json`, and `CHANGELOG.md` in a release PR. Merging that PR
causes the next successful Release Please run to create a `vX.Y.Z` tag and
[GitHub release](https://github.com/doruksahin/agent-workflows-site/releases).
There is no npm publication; `private: true` prevents accidental npm publishing
and does not make the GitHub repository private.

Use Conventional Commits for commits on `main` (or squash-merge titles):

| Change | Example | Version effect after the first release |
| --- | --- | --- |
| New guide, capability, or substantial UI addition | `feat(content): explain the Recon workflow` | Minor |
| Content correction or behavior fix | `fix(map): correct a repository reference` | Patch |
| Repository instructions or maintenance | `docs: clarify the local setup` / `chore: refresh tooling` | No release by itself |
| Breaking change, such as removing a supported route | `feat!: replace the public tool routes` | Major |

The first release is explicitly `v0.1.0`. The initial empty manifest means nothing
has been released yet; Release Please will fill it when preparing the first PR.
No bootstrap cutoff is set, so that first changelog includes the existing history.
Do not keep a permanent `release-as` override or manually bump the version files.
Tool source commits and the map checksum remain independent of the website version.

### Review a release

1. Merge the intended changes to `main` and let **Release Please** prepare or update
   its release PR.
2. Inspect its version and changelog. Confirm the latest **Release Please** run's
   `verify-release-pr / verify` job passed for the current PR head; its job summary
   records the full verified commit. This check belongs to the triggering `main`
   workflow run, so it may not appear as a normal PR-head check.
3. Merge the release PR when ready. Wait for the subsequent Release Please run to
   pass and publish the tag and release.
4. Follow [deployment.md](deployment.md) to deploy that release's exact commit.

The workflows use the built-in `GITHUB_TOKEN`; no release PAT is needed. Repository
Settings → Actions → General must allow GitHub Actions to create pull requests.
Token-created PR workflows can be suppressed or require approval, which is why the
release workflow explicitly runs `verify-release-pr` with read-only permissions.
For recovery, rerun **Release Please** through Actions → Run workflow on `main`.
To independently check a release branch, run **Verify** on that branch.

## Deploy a release

See [deployment.md](deployment.md). Deployment remains manual: publishing a GitHub
release does not deploy the website. Coolify builds the selected release commit's
Dockerfile and serves the static output through Nginx. There are no application
secrets or runtime environment variables.

To link here from a tool repository, use the permanent route for that tool, for example:

```md
[How this tool fits into the workflow](https://workflows.doruk.uk/tools/agent-sessions/)
```
