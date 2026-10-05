import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('json', 'application/json');
