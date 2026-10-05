import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('png', 'image/png');
