# Notes folders design

Approved 2026-10-05. This revises the content model and the routes in
[2026-10-05-notes-collection-design.md](2026-10-05-notes-collection-design.md). The schema rules,
drafts, tags, RSS, the disclosure scan, diagrams, and the release process do not change.

## Goal

Notes keep the folder structure and the file names of their source. A folder from a source
repository, such as `docs/observability/`, is copied as a folder and made generic. It is not
merged into one page. Visitors read the same pages in two views:

- **Latest:** a blog list of every published file, newest first.
- **Files:** a file explorer. It shows the folder tree, the files, and the attachments.

## Content model

```
src/content/notes/<folder>/.../<name>.{md,mdx}   one page per file; any depth
src/content/notes/<folder>/README.{md,mdx}       the folder's own page
src/content/notes/<folder>/<sub>/<file>.<ext>    attachments, such as images/
```

| Source path | URL |
| --- | --- |
| `observability/README.md` | `/notes/observability/` |
| `observability/diagnose-with-cli.md` | `/notes/observability/diagnose-with-cli/` |
| `observability/images/02-trace-tree.jpg` | `/notes/observability/images/02-trace-tree.jpg` |

- Every Markdown file has the frontmatter from the first design: `title`, `summary`, `date`,
  `tags`, and optional `updated`, `source`, and `draft`.
- Names keep their source spelling. Each path segment must be URL-safe (`A-Z a-z 0-9 . _ -`).
- A README cannot be at the root of `src/content/notes/`, because `/notes/` is the index.
- The root folder names `tags` and `rss.xml` are reserved.
- Two sources cannot map to the same URL. Examples: `x.md` and the folder `x/`, or `README.md`
  and `README.mdx`.

## Links

A Markdown plugin rewrites relative links at build time, so the copied files keep their source
links. As built, it is a Sätteri mdast plugin, `scripts/note-links.mjs`, because Sätteri is the
default Markdown and MDX processor in Astro 7. Its `astro.config.mjs` import needs a direct pin of
`@astrojs/markdown-satteri`.

- `diagnose-with-cli.md#step-2` becomes `/notes/observability/diagnose-with-cli/#step-2`.
- `README.md` becomes the folder URL.
- A link to an attachment becomes its stable attachment URL.
- Relative image references stay with the Astro image pipeline, which makes optimized copies.
- A relative link to a file that does not exist, or that is outside `src/content/notes/`, fails
  the build. Example: a link to a private ADR that was not copied. As built, the glob loader
  only logs a render error in a `.md` file and continues. Two checks enforce the rule instead:
  `src/pages/notes/[...path].astro` fails the build for a `.md` file that did not render, and
  `check-site.mjs` asserts that no published file has a broken or outside relative link.

## Routes and views

| Route | Content |
| --- | --- |
| `/notes/` | Two tabs: **Latest** (the blog list) and **Files** (the tree from the root). Without JavaScript, both views are shown, one after the other. |
| `/notes/<folder>/` | The explorer for the folder: the tree at the side, the folder's files and attachments, then its README. A folder without a README shows only the listing. |
| `/notes/<path>/` | One file. The tree is at the side and the breadcrumb is `notes / observability / diagnose-with-cli.md`. |
| `/notes/<path>.<ext>` | The raw attachment, with a stable URL for download. |
| `/notes/tags/<tag>/`, `/notes/rss.xml` | Unchanged. They list files. |

On phones, the tree goes into a collapsible section above the content.

As built, attachments use one route for each extension, `src/pages/notes/[...file].<ext>.ts`, not
one `[...file].ts` route. In development, Astro exempts an endpoint from
`trailingSlash: 'always'` only when its route name ends in a literal extension. The served
extensions are `jpg`, `png`, `webp`, `gif`, `svg`, and `pdf`.

## Attachments and drafts

An attachment is published only if a published file refers to it. A draft's images therefore do
not ship as raw files. The `/_astro/` orphan-asset check still applies to the optimized copies.
The explorer lists only published attachments.

## Verification additions

`check-site.mjs` checks the following:

- the URL of every published file, folder page, and attachment;
- that no two sources share a URL;
- that path segments are URL-safe;
- that the sitemap lists every page, and that drafts are absent from every listing;
- that each unpublished attachment is absent from `dist/`.

The existing link walker checks the rewritten links.

## First folder: observability

The single combined note becomes `src/content/notes/observability/`, using the source file names:
`README.md`, `diagnose-in-langfuse-ui.md`, `diagnose-with-cli.md`, and
`images/01-tracing-search.jpg`, `02-trace-tree.jpg`, `03-trace-timeline.jpg`, and
`05-next-tool-call.jpg`. These are the reviewed crops. Image 04 stays dropped. The text that was
already reviewed moves back to the file it came from. The README keeps the source's "Read | When"
table, which links to the two guides. The diagram goes to `images/trace-pipeline.svg`, with its
`.mmd` source next to it.
