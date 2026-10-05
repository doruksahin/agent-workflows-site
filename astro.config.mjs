import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import noteLinks from './scripts/note-links.mjs';
export default defineConfig({ site: 'https://workflows.doruk.uk', output: 'static', trailingSlash: 'always', markdown: { processor: satteri({ mdastPlugins: [noteLinks({ notesDir: './src/content/notes' })] }) }, integrations: [mdx()] });
