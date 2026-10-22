type AttachmentErrorCode =
  | "INVALID_FILE"
  | "TOO_LARGE"
  | "TOO_MANY"
  | "QUOTA_EXCEEDED"
  | "NOT_FOUND"
  | "ARCHIVED"
  | "FILE_MISSING"
  | "UNAUTHENTICATED"
  | "PASSWORD_CHANGE_REQUIRED";

export class AttachmentError extends Error {
  readonly code: AttachmentErrorCode;
  constructor(code: AttachmentErrorCode) {
    super(code);
    this.code = code;
  }
}
