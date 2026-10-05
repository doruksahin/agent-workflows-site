import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('webp', 'image/webp');
