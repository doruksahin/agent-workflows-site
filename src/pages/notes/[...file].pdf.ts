import { attachmentRoute } from './_attachments';
export const { getStaticPaths, GET } = attachmentRoute('pdf', 'application/pdf');
