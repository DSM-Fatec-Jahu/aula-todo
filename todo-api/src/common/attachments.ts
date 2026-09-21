export const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function isImage(contentType: string) {
  return contentType.startsWith('image/');
}

export function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(-100);
  return cleaned.length > 0 ? cleaned : 'arquivo';
}

export function contentDisposition(fileName: string, contentType: string) {
  const kind = isImage(contentType) ? 'inline' : 'attachment';
  return `${kind}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
