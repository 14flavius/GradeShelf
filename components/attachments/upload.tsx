import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { attachmentAccept, attachmentNameSchema } from "@/lib/attachments/rules";
import { Input } from "@/components/ui/input";
import { StorageUsage, useAttachmentStorage } from "./storage-usage";

const errors: Record<string, MessageKey> = {
  INVALID_FILE: "invalidAttachment",
  TOO_LARGE: "attachmentTooLarge",
  TOO_MANY: "tooManyAttachments",
  QUOTA_EXCEEDED: "storageQuotaExceeded",
  NOT_FOUND: "gradeNotFound",
  ARCHIVED: "archivedReadOnly",
  FILE_MISSING: "attachmentMissing",
  UNAUTHENTICATED: "gradeSignIn",
  PASSWORD_CHANGE_REQUIRED: "passwordRequired",
  FORBIDDEN: "gradeForbidden",
  UPLOAD_BUSY: "uploadBusy",
};

export async function attachmentRequestError(response: Response): Promise<MessageKey> {
  const body: unknown = await response.json().catch(() => null);
  const code =
    body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code
      : "";
  return Object.hasOwn(errors, code) ? errors[code] : "serviceUnavailable";
}

export function useAttachmentUpload() {
  const { t } = useLanguage();
  const { limits, usedBytes } = useAttachmentStorage();
  const { maxFileSize, maxAttachments, maxUserStorage } = limits;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  function validate(files: File[], existingCount: number) {
    setError(null);
    if (files.length + existingCount > maxAttachments) {
      setError("tooManyAttachments");
      return false;
    }
    if (files.some((file) => file.size > maxFileSize)) {
      setError("attachmentTooLarge");
      return false;
    }
    if (
      maxUserStorage > 0 &&
      usedBytes + files.reduce((sum, file) => sum + file.size, 0) > maxUserStorage
    ) {
      setError("storageQuotaExceeded");
      return false;
    }
    if (
      files.some((file) => file.size === 0 || !attachmentNameSchema.safeParse(file.name).success)
    ) {
      setError("invalidAttachment");
      return false;
    }
    return true;
  }
  async function upload(entryId: string, files: File[], remaining: (files: File[]) => void) {
    setPending(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const response = await fetch(`/api/entries/${encodeURIComponent(entryId)}/attachments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(files[i].name),
          },
          body: files[i],
        });
        if (!response.ok) {
          setError(await attachmentRequestError(response));
          return false;
        }
        remaining(files.slice(i + 1));
      }
      return true;
    } catch {
      setError("attachmentConnectionFailed");
      return false;
    } finally {
      setPending(false);
      router.refresh();
    }
  }
  const errorMessage = error
    ? t[error]
        .replace("{size}", String(maxFileSize / 1024 ** 2))
        .replace("{count}", String(maxAttachments))
    : null;
  return { upload, validate, pending, error: errorMessage };
}

export function FilePicker({
  files,
  onChange,
  disabled,
  hideLabel = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const { t } = useLanguage();
  const { limits } = useAttachmentStorage();
  return (
    <div className="space-y-2">
      <label className="grid gap-2 text-sm font-medium">
        <span className={hideLabel ? "sr-only" : undefined}>{t.attachmentsOptional}</span>
        <Input
          type="file"
          multiple
          accept={attachmentAccept}
          disabled={disabled}
          onChange={(event) => {
            const selected = Array.from(event.currentTarget.files ?? []);
            if (selected.length > 0) {
              onChange([...files, ...selected]);
            }
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {t.attachmentLimits
          .replace("{size}", String(limits.maxFileSize / 1024 ** 2))
          .replace("{count}", String(limits.maxAttachments))}
      </p>
      {limits.maxUserStorage > 0 && <StorageUsage compact />}
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((file, index) => (
            <li className="flex items-start gap-2" key={index}>
              <span className="min-w-0 flex-1 break-words">{file.name}</span>
              <button
                type="button"
                disabled={disabled}
                className="shrink-0 text-primary underline disabled:opacity-50"
                aria-label={`${t.removeSelection}: ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                {t.removeSelection}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
