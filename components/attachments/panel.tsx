"use client";

import { useRef, useState, type MouseEvent, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import type { AttachmentView } from "@/lib/attachments/rules";
import type { MessageKey } from "@/lib/i18n/messages";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MutationError } from "@/components/grades/form-parts";
import { attachmentRequestError, FilePicker, useAttachmentUpload } from "./upload";

export function AttachmentsPanel({
  entryId,
  attachments,
  readOnly,
}: {
  entryId: string;
  attachments: AttachmentView[];
  readOnly: boolean;
}) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<AttachmentView | null>(null);
  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-sm font-medium">{t.attachments}</h4>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.noAttachments}</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <DownloadAttachment attachment={attachment} />
              <span className="text-xs text-muted-foreground">
                {new Intl.NumberFormat(locale, {
                  style: "unit",
                  unit: "kilobyte",
                  maximumFractionDigits: 1,
                }).format(attachment.size / 1000)}
              </span>
              {!readOnly && (
                <Button
                  variant="secondary"
                  aria-label={`${t.delete}: ${attachment.originalName}`}
                  onClick={() => setDeleting(attachment)}
                >
                  {t.delete}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t.addAttachments}
        </Button>
      )}
      {open && (
        <UploadDialog entryId={entryId} count={attachments.length} onClose={() => setOpen(false)} />
      )}
      {deleting && <DeleteAttachment attachment={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}

function DownloadAttachment({ attachment }: { attachment: AttachmentView }) {
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const inFlight = useRef(false);
  async function handleDownload(event: MouseEvent<HTMLAnchorElement>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`);
      if (!response.ok) {
        setError(await attachmentRequestError(response));
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Allow the browser to start consuming the download before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("connectionFailed");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <a
        href={`/api/attachments/${attachment.id}`}
        download
        aria-busy={pending}
        className="break-words text-primary underline underline-offset-4"
        onClick={handleDownload}
      >
        {attachment.originalName}
      </a>
      <MutationError message={error ? t[error] : null} />
    </div>
  );
}

function UploadDialog({
  entryId,
  count,
  onClose,
}: {
  entryId: string;
  count: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const upload = useAttachmentUpload();
  const busy = useRef(false);
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !upload.validate(files, count)) {
      return;
    }
    busy.current = true;
    try {
      if (await upload.upload(entryId, files, setFiles)) {
        onClose();
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <Dialog title={t.addAttachments} onClose={onClose} busy={upload.pending}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FilePicker files={files} onChange={setFiles} disabled={upload.pending} />
        <MutationError message={upload.error} />
        <p className="text-xs text-muted-foreground">{t.uploadPartialHelp}</p>
        <Button type="submit" disabled={upload.pending || files.length === 0}>
          {upload.pending ? t.uploading : t.uploadAttachments}
        </Button>
      </form>
    </Dialog>
  );
}

function DeleteAttachment({
  attachment,
  onClose,
}: {
  attachment: AttachmentView;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const inFlight = useRef(false);
  async function handleDelete() {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await attachmentRequestError(response));
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("connectionFailed");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog title={t.delete} onClose={onClose} busy={pending}>
      <div className="space-y-4">
        <p className="break-words font-medium">{attachment.originalName}</p>
        <p className="text-sm">{t.deleteAttachmentConfirm}</p>
        <MutationError message={error ? t[error] : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={pending} data-autofocus onClick={onClose}>
            {t.cancel}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? t.saving : t.delete}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
