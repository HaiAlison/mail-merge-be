export const DEFAULT_PAGE_NUMBER = 1;
export const DEFAULT_LIMIT_NUMBER = 25;
export const FILE_TYPES_IMPORT_ALLOWED = ['xlsx', 'xls', 'csv'];
export const FILE_TYPES_ATTACHMENT_ALLOWED = ['xlsx', 'xls', 'csv', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'zip'];

// Gmail API limits
export const GMAIL_MAX_MESSAGE_SIZE = 25 * 1024 * 1024; // 25 MB total message
export const GMAIL_SIMPLE_UPLOAD_LIMIT = 5 * 1024 * 1024; // 5 MB — use resumable above this
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB per file
