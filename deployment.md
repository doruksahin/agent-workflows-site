# Deployment

- Public URL: https://workflows.doruk.uk
- Source: https://github.com/doruksahin/agent-workflows-site
- Source branch: `main`; each manual deployment must select the release's full commit SHA
- Platform: self-hosted Coolify
- Coolify project: `Agent Workflows` (`w12ca4yu0hjz67bee7rp0a6j`)
- Coolify application: `agent-workflows-site` (`lnv4671o2e912w8s2b8if72i`)
- Build pack: Dockerfile at `/Dockerfile`
- Application port: `80`
- Build: Node 24, `npm ci`, then `npm run verify`
- Runtime: Nginx serving Astro's static `dist/`
- Health check: `GET /`
- Runtime limits: 128 MiB memory, 0.5 CPU
- No database, application secrets, or runtime environment variables

Coolify and infrastructure credentials belong to the operator's shared operations system, outside this public repository.

## Deploy a reviewed release

First complete the [release PR review](README.md#review-a-release). Wait for the
GitHub release and its tag to exist. Then resolve the intended release to its exact
commit; replace `v0.1.0` below with the release you are deploying:

```sh
git fetch origin --tags
git rev-parse 'v0.1.0^{commit}'
```

1. Open this application's **Configuration → Git Source** in Coolify. Keep the
   source branch as `main`, set **Commit SHA** to the full commit printed above,
   and save. Do not select the moving `main` tip as a substitute for the release.
2. Click **Deploy**. Confirm the deployment reports that exact SHA and becomes
   healthy. The Docker build installs the locked dependencies and runs
   `npm run verify` before producing the static image.
3. Check `/`, `/tools/`, one tool detail, `/guides/jira-to-reviewed-report/`, and
   `/map/` over public HTTPS. Check that the map opens and the disclosures expand.
4. Download `/downloads/agent-workflows.html` and compare its SHA-256 with
   `content/maps/provenance.json` at the released commit. Use the download route;
   Cloudflare can inject a browser-check script into the inline HTML route.

Keep the commit pinned until deliberately deploying another release. A later
release or push does not change this setting. The GitHub release records the
available version; Coolify's deployment history records what was actually deployed.

The existing site was initially deployed directly from `main` before this release
process was installed. The first manual release deployment establishes its release
pin; installing Release Please alone does not alter the current production revision.

Deployments are manual through this application's Coolify Deploy action or the
operator's authenticated deployment API. No repository webhook or deployment
workflow is configured. Neither a push nor a GitHub release updates the live site.
No GitHub Actions secrets are required. Coolify's deploy API `tag` parameter selects
tagged Coolify resources, not a Git release tag; select the application's Git commit
explicitly when using that API.

## Recovery

Select the previous known-good release commit using this application's Coolify
deployment history, set its Commit SHA, and redeploy it. Verify the deployment's
SHA and public pages again. Do not move an existing Git release tag to perform a
rollback, or restart or modify unrelated host resources.

The standalone map is versioned with its JSON input and checksum. Replacing it requires a fresh Archify render and validation before updating the provenance manifest.
