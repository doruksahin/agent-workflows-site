# Notes Folders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Serve notes as source-shaped folders, with a Latest (blog) view and a Files (explorer)
view under `/notes/`.

**Architecture:** The glob loader reads every `**/*.{md,mdx}` file under `src/content/notes/`.
The ID is the path, and a README maps to its folder. `src/lib/notes.ts` builds a tree of folders,
files, and attachments that a published file refers to. A catch-all route renders folder pages and
file pages. An endpoint copies the published attachments to stable URLs. A Sätteri mdast plugin
rewrites relative links. `check-site.mjs` gets red/green checks for each rule.

**Deviations, as built (Task 1):**
- The link rewriter is a Sätteri mdast plugin, `scripts/note-links.mjs`, not a remark plugin.
  Sätteri is Astro 7's default Markdown processor. `astro.config.mjs` imports it, so
  `@astrojs/markdown-satteri` has a direct pin in `package.json`.
- Attachments use one route for each extension, `src/pages/notes/[...file].<ext>.ts`, with shared
  code in `_attachments.ts`. In development, only an endpoint whose route name ends in a literal
  extension is exempt from `trailingSlash: 'always'`.
- The glob loader only logs a broken link in a `.md` file. A render check in
  `src/pages/notes/[...path].astro` and an assertion in `check-site.mjs` make it fail the build.

**Design:** [2026-10-05-notes-folders-design.md](2026-10-05-notes-folders-design.md)

**Conventions:** these are the same as in [the first plan](2026-10-05-notes-collection.md). Work on
branch `feat/notes-collection`, use terse style, and write a failing check before you write the
code. Check exit statuses with `echo $?`. Use Conventional Commits.

---

### Task 1: Folder structure, routes, and checks

**Files:**
- Move: `src/content/notes/langfuse-tracing-claude-code/` → `src/content/notes/observability/`
  - `index.mdx` → `README.mdx`
  - crops → `images/01-tracing-search.jpg`, `images/02-trace-tree.jpg`,
    `images/03-trace-timeline.jpg`, `images/05-next-tool-call.jpg`
  - diagram → `images/trace-pipeline.{mmd,svg}`
- Modify: `src/content.config.ts`, `src/lib/notes.ts`, `astro.config.mjs`,
  `src/components/NoteCard.astro`, `src/layouts/Note.astro`, `src/pages/notes/index.astro`,
  `src/pages/notes/rss.xml.ts`, `src/pages/notes/tags/[tag].astro`, `src/pages/sitemap.xml.ts`,
  `scripts/check-site.mjs`, `src/styles/global.css`
- Create: `src/pages/notes/[...path].astro` (replaces `[slug].astro`),
  `src/pages/notes/[...file].<ext>.ts` and `_attachments.ts` (attachments),
  `src/components/NoteTree.astro`, `scripts/note-paths.mjs`, `scripts/note-links.mjs`
- Test: `scripts/note-links.test.mjs`, which is a unit test of the URL mapping and the link
  rewrite

**Steps:**
1. Make the move with `git mv` and fix the image paths in the note. The note keeps its body for
   now; Task 2 splits it.
2. Write failing checks in `check-site.mjs` and failing unit tests for the plugin. They cover
   every rule in the design's "Verification additions". Run `npm run verify` and confirm the
   failure.
3. Implement the loader IDs, the tree, the routes, the views, the attachments, and the plugin.
4. Run `npm run verify` and confirm that it passes. Then run the negative checks, each with a
   temporary fixture:
   - a draft with an image,
   - a URL collision,
   - an unsafe name,
   - a root README,
   - a broken relative link,
   - a link outside the tree.
5. Check in the browser, at desktop width and at 375 px: the `/notes/` tabs, the folder page, and
   a file page.
6. Commit: `feat(notes): serve notes as folders with latest and files views`.

### Task 2: Split the observability note into its source files

**Files:**
- Modify: `src/content/notes/observability/README.mdx` → `README.md`
- Create: `src/content/notes/observability/diagnose-in-langfuse-ui.md`
- Create: `src/content/notes/observability/diagnose-with-cli.md`

**Steps:**
1. Move the reviewed text back to the file it came from:
   - README: why, how it works, observations, what is exported, and lessons, plus the "Read |
     When" table with relative `.md` links;
   - `diagnose-in-langfuse-ui.md`: the UI steps and screenshots;
   - `diagnose-with-cli.md`: the CLI steps.
   Each file gets its own frontmatter. Do not add new facts.
2. Run `npm run verify` and confirm that it passes. The disclosure scan and the link rewrite both
   run.
3. Commit: `feat(notes): split the observability notes into their source files`.

### Task 3: Docs and review

1. Update `README.md`, `deployment.md`, and `PROJECT.md` for the new paths. Commit with
   `docs: ...`.
2. Run the final review. Then do a clean `npm ci && npm run verify` and a `docker build`.
