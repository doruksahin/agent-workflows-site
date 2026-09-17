# Deployment

- Public URL: https://workflows.doruk.uk
- Source: https://github.com/doruksahin/agent-workflows-site
- Branch: `main`
- Platform: self-hosted Coolify
- Build pack: Dockerfile at `/Dockerfile`
- Application port: `80`
- Build: Node 24, `npm ci`, then `npm run verify`
- Runtime: Nginx serving Astro's static `dist/`
- Health check: `GET /`
- No database, application secrets, or runtime environment variables

Coolify and infrastructure credentials belong to the operator's shared operations system, outside this public repository.

## Release

1. Run `npm ci && npm run verify`.
2. Review content for public suitability and source accuracy.
3. Commit and push to `main`.
4. Deploy this application's latest main revision in Coolify.
5. Verify the homepage, a tool page, the guide, and `/maps/agent-workflows.html` over public HTTPS.

Automatic deployment configuration is recorded below after setup. Do not assume that a push deployed until Coolify reports success and the live site is verified.

## Recovery

Redeploy the previous known-good commit using this application's Coolify deployment history. Do not restart or modify unrelated host resources.

The standalone map is versioned with its JSON input and checksum. Replacing it requires a fresh Archify render and validation before updating the provenance manifest.
