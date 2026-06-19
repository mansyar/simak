// Server-side file upload validation. Enforces TDD §5 File Management rules:
// - .docx and .pdf only (extension + MIME cross-check)
// - 25MB max size
// Used at presign (type check) and at submission record (size + filename check).
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const ACCEPTED_FILE_EXTENSIONS = ['pdf', 'docx'];
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const EXTENSION_TO_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
export function validateUploadType(extension, contentType) {
  const ext = extension.toLowerCase().replace(/^\./, '');
  if (!ACCEPTED_FILE_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Unsupported file extension' };
  }
  const expectedMime = EXTENSION_TO_MIME[ext];
  if (contentType !== expectedMime) {
    return { valid: false, error: 'Content type does not match file extension' };
  }
  return { valid: true };
}
export function validateUploadSize(fileSize) {
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 25MB limit' };
  }
  return { valid: true };
}
export function validateUploadFileName(fileName) {
  const ext = fileName.toLowerCase().split('.').pop();
  if (!ext || !ACCEPTED_FILE_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'Unsupported file type' };
  }
  return { valid: true };
}
