import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('jpg', 'image/jpeg');
