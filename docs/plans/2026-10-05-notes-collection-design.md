# Notes collection design

Approved 2026-10-05.

## Goal

Add a place on https://workflows.doruk.uk for Markdown and MDX notes: learned experience,
how-tos, and blog posts. The site also serves each note's attachments. The first note is a
generalized version of the private Langfuse observability notes in
`AC-visual-walkthrough/docs/observability/`.

## Decisions

| Question | Decision |
| --- | --- |
| Platform | Astro Content Collections with `@astrojs/mdx`, inside this repository. No second site, CMS, or theme. |
| Files | Post attachments only. Images and diagrams sit next to their note. Plain downloads go in `public/files/<slug>/`. No object storage. |
| Authoring | `.md` or `.mdx` files edited in the repository, then a pull request, a release, and a manual deployment. |
| Structure | One `notes` collection. Each entry has a date and tags. A "blog" is the same list sorted newest first. |
| Private sources | A reviewed one-way rewrite. No sync, submodule, or private link. A `source` frontmatter field records the origin as text. |

## Content model

```
src/content/notes/<slug>/index.{md,mdx}   one note; <slug> is its URL
src/content/notes/<slug>/*.{jpg,png,svg}  attachments, referenced by relative path
src/content/notes/<slug>/*.mmd            Mermaid source for a committed SVG
public/files/<slug>/                      plain downloads with stable URLs
src/content.config.ts                     collection schema
```

Frontmatter schema:

| Field | Type | Rule |
| --- | --- | --- |
| `title` | string | Required |
| `summary` | string | Required. It is the page description and the RSS description. |
| `date` | date | Required. Sets the order. |
| `updated` | date | Optional |
| `tags` | string[] | At least one. Lowercase kebab-case, so a tag is URL-safe without conversion. |
| `source` | string | Optional provenance text. It never links to a private repository. |
| `draft` | boolean | Default `false`. Drafts appear in `astro dev` and are not in the production build. |

The note's folder name is its ID and URL. An invalid frontmatter field or a missing image fails
the build.

## Routes

| Route | Content |
| --- | --- |
| `/notes/` | Published notes, newest first, with the tag list |
| `/notes/tags/<tag>/` | Notes with one tag |
| `/notes/<slug>/` | One note, in a new `Note.astro` layout that uses `Base` and the existing `.prose` styles |
| `/notes/rss.xml` | RSS feed made with `@astrojs/rss` |

`Base.astro` gets a "Notes" navigation link and an RSS `alternate` link. `sitemap.xml.ts` reads the
collection instead of a hardcoded list of notes. `Article.astro` is unchanged: its reading time,
review date, and breadcrumb are specific to the guide.

## Diagrams

Mermaid is rendered once, when the note is written, with `@mermaid-js/mermaid-cli`. The `.svg`
and its `.mmd` source are committed next to the note. The Docker build therefore needs no browser,
and its output is reproducible.

## Verification

`npm run verify` runs:

1. `node --test` unit tests for the disclosure scanner.
2. `astro build`, which validates the frontmatter schema and the image references.
3. `scripts/check-site.mjs`, extended to:
   - also check `.mdx` files for the existing personal-path rule;
   - check that `/notes/`, `/notes/rss.xml`, and every published note page exist, and that drafts
     are absent from the build;
   - check that the sitemap and the RSS feed list every published note;
   - check that no note folder uses a reserved name (`tags`, `rss.xml`);
   - scan every file under `src/content/notes/` for the patterns in
     `scripts/disclosure-rules.json`. Matches fail the build.
   - check that every built `/_astro/` asset is referenced, so attachments of draft notes cannot
     ship.

The disclosure scan is limited to notes. The existing guide and the tool catalog link to labeled
private repositories on purpose. The scan finds mistakes when content moves from private notes.
It does not replace the author's review.

## First note: Langfuse tracing

Rewrite the three source files as one note: `src/content/notes/langfuse-tracing-claude-code/`.

- **Keep:** Claude Code's native OpenTelemetry export, enabled with environment variables only and
  sent over OTLP/HTTP to Langfuse's `/api/public/otel` endpoint. Also keep the observation types
  and what each one tells you, what is and is not exported, how to diagnose a slow run in the UI,
  and how to diagnose it with the CLI.
- **Make generic:** organization and repository names, secret-manager paths, GitHub secret
  names, CI run IDs, ticket keys, and emails.
- **Screenshots:** check each one of the five. Publish an image only if it shows no internal data
  after cropping. Otherwise, describe the step in text. Record each decision in the pull
  request.

## Release

Release it as a `feat:` change; Release Please makes 0.2.0. Deploy manually with the pinned SHA,
following `deployment.md`. Add `/notes/`, one note, and `/notes/rss.xml` to the post-deploy
checks there.

## Out of scope

Search, comments, a CMS, object storage, cover images, and syncing notes from source
repositories.
