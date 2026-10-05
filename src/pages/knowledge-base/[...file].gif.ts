import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('gif', 'image/gif');
