# Deployment

- Public URL: https://workflows.doruk.uk
- Source: https://github.com/doruksahin/agent-workflows-site
- Branch: `main`
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

## Release

1. Run `npm ci && npm run verify`.
2. Review content for public suitability and source accuracy.
3. Commit and push to `main`.
4. Deploy this application's latest main revision in Coolify.
5. Verify the homepage, a tool page, the guide, and `/maps/agent-workflows.html` over public HTTPS.

Deployments are manual through this application's Coolify Deploy action or the
operator's authenticated deployment API. No repository webhook is configured.
A push alone does not update the live site. No GitHub Actions secrets are required.

## Recovery

Redeploy the previous known-good commit using this application's Coolify deployment history. Do not restart or modify unrelated host resources.

The standalone map is versioned with its JSON input and checksum. Replacing it requires a fresh Archify render and validation before updating the provenance manifest.
