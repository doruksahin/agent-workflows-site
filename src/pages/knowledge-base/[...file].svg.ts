import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('svg', 'image/svg+xml');
