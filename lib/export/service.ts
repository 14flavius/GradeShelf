import { Readable } from "node:stream";
import { ZipFile } from "yazl";
import type { PrismaClient } from "@/generated/prisma/client";
import { readStoredFile } from "../attachments/storage.ts";
import { gradingSystems } from "../grades/systems.ts";
import { messages } from "../i18n/messages.ts";
import { logEvent } from "../logger.mjs";
import type { Theme } from "../theme.ts";

export async function readExport(db: PrismaClient, userId: string, theme: Theme) {
  // A single read transaction keeps IDs, relationships and preferences consistent.
  // Explicit selects prevent future private model fields from entering the export.
  return db.$transaction(async (tx) => {
    const profile = await tx.user.findFirst({
      where: { id: userId, isActive: true, mustChangePassword: false },
      select: {
        id: true,
        username: true,
        name: true,
        locale: true,
        localeSelected: true,
        role: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!profile) {
      return null;
    }
    const [
      gradeLists,
      subjects,
      gradeTypes,
      gradeListTypes,
      gradeEntries,
      attachments,
      dashboardPreferences,
    ] = await Promise.all([
      tx.gradeList.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          gradingSystemId: true,
          isDefault: true,
          useAllGradeTypes: true,
          gradingSystemLockedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.subject.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          gradeListId: true,
          name: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.gradeType.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          weight: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.gradeListType.findMany({
        where: { userId },
        orderBy: [{ gradeListId: "asc" }, { gradeTypeId: "asc" }],
        select: { gradeListId: true, gradeTypeId: true },
      }),
      tx.gradeEntry.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          gradeListId: true,
          subjectId: true,
          gradeTypeId: true,
          title: true,
          date: true,
          grade: true,
          gradedAt: true,
          weight: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.attachment.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          gradeEntryId: true,
          originalName: true,
          storageName: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      }),
      tx.dashboardPreference.findMany({
        where: { userId },
        orderBy: { gradeListId: "asc" },
        select: {
          gradeListId: true,
          showOnDashboard: true,
          includeInOverall: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    const calendarFeed = await tx.calendarFeed.findUnique({
      where: { userId },
      select: {
        name: true,
        enabled: true,
        locale: true,
        titleTemplate: true,
        descriptionTemplate: true,
        createdAt: true,
        updatedAt: true,
        lists: { select: { gradeListId: true }, orderBy: { gradeListId: "asc" } },
      },
    });
    const exportedAt = new Date();
    const files = attachments.map((attachment, index) => {
      // Prefixes prevent collisions and reserved filenames. Original names stay in JSON.
      const name =
        attachment.originalName
          .replace(/[\x00-\x1f\x7f/\\<>:"|?*\u202a-\u202e\u2066-\u2069]/gu, "_")
          .slice(0, 180)
          .replace(/[. ]+$/, "") || "attachment";
      return {
        ...attachment,
        archivePath: `attachments/${String(index + 1).padStart(6, "0")}-${name}`,
      };
    });
    return {
      files,
      filename: `gradeshelf-export-${exportedAt.toISOString().replace(/[:.]/g, "-")}.zip`,
      data: {
        format: "gradeshelf-export",
        formatVersion: 1,
        exportedAt,
        profile,
        browserPreferences: { theme },
        calendarFeed,
        gradingSystems: [...new Set(gradeLists.map((list) => list.gradingSystemId))]
          .sort()
          .map((id) => {
            const { labelKey, ...definition } = gradingSystems[id];
            return {
              id,
              name: { en: messages.en[labelKey], de: messages.de[labelKey] },
              ...definition,
            };
          }),
        gradeLists,
        subjects,
        gradeTypes,
        gradeListTypes,
        gradeEntries,
        dashboardPreferences,
        attachments: files.map((file) => ({
          id: file.id,
          gradeEntryId: file.gradeEntryId,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          createdAt: file.createdAt,
          archivePath: file.archivePath,
        })),
      },
    };
  });
}

export function streamExport(
  snapshot: NonNullable<Awaited<ReturnType<typeof readExport>>>,
  signal: AbortSignal,
  finished: () => void,
) {
  const zip = new ZipFile();
  const output = zip.outputStream;
  if (!(output instanceof Readable)) {
    throw new Error("EXPORT_STREAM_UNAVAILABLE");
  }
  let activeFile: Readable | undefined;
  let stopped = false;
  let canceled = false;
  zip.on("error", () => {
    if (stopped) {
      return;
    }
    stopped = true;
    activeFile?.destroy();
    // The stream fails completely if a file is missing or changes during export.
    // Never expose filesystem paths through Next.js stream-error logging.
    output.destroy(new Error("EXPORT_FAILED"));
    if (!canceled) {
      logEvent("export.stream_failed", "error");
    }
  });
  const cancel = () => {
    canceled = true;
    zip.emit("error", new Error("EXPORT_CANCELED"));
  };
  output.once("close", () => {
    signal.removeEventListener("abort", cancel);
    if (!output.readableEnded) {
      cancel();
    }
    finished();
  });
  signal.addEventListener("abort", cancel, { once: true });

  const options = { mtime: snapshot.data.exportedAt, mode: 0o100600 };
  zip.addBuffer(
    Buffer.from(JSON.stringify(snapshot.data, null, 2) + "\n"),
    "gradeshelf.json",
    options,
  );
  zip.addBuffer(
    Buffer.from(
      [
        "GradeShelf — personal data export / Persönlicher Datenexport",
        "",
        "gradeshelf.json: UTF-8 JSON, formatVersion 1. Dates are YYYY-MM-DD; timestamps are UTC (ISO 8601).",
        "All records belong to profile.id. IDs connect lists, subjects, types, entries and attachments.",
        "grade = null means no grade; 0 is a grade. Entry weights are saved snapshots.",
        "For letter systems, grade is a category value: gradingSystems[].letters maps value to label and points.",
        "Letter averages use the explicit points, never the category values. A and A+ stay distinct.",
        "attachments[].archivePath points to the unchanged original file; originalName keeps its original name.",
        "browserPreferences contains the theme of the browser used for this export.",
        "No passwords, sessions, 2FA secrets or recovery codes. This is not a full server backup or an import file.",
        "Attachments are untrusted user files, not scanned or sanitized. Open them with care.",
        "",
        "Alle Datensätze gehören zu profile.id. IDs verknüpfen Listen, Fächer, Notenarten, Einträge und Anhänge.",
        "grade = null bedeutet keine Note; 0 ist eine Note. Gewichte der Einträge sind gespeicherte Momentaufnahmen.",
        "Bei Buchstabenskalen ist grade eine Kategorie: gradingSystems[].letters ordnet value den label und points zu.",
        "Buchstabenschnitte verwenden die zugeordneten Punkte, niemals die Kategorie-Werte. A und A+ bleiben unterscheidbar.",
        "attachments[].archivePath verweist auf die unveränderte Datei; originalName enthält ihren Originalnamen.",
        "browserPreferences enthält die Designwahl des für diesen Export verwendeten Browsers.",
        "Keine Passwörter, Sessions, 2FA-Geheimnisse oder Recovery Codes. Kein vollständiges Serverbackup oder Importformat.",
        "Anhänge sind ungeprüfte Nutzerdateien ohne Virenscan oder Inhaltsbereinigung. Mit Vorsicht öffnen.",
        "",
      ].join("\n"),
    ),
    "README.txt",
    options,
  );
  for (const file of snapshot.files) {
    zip.addReadStreamLazy(
      file.archivePath,
      { mtime: file.createdAt, mode: 0o100600, size: file.size, compress: false },
      (ready) => {
        if (stopped) {
          return;
        }
        // At most one bounded attachment is read at a time; no archive is stored on disk.
        void readStoredFile(file.storageName, file.size)
          .then((bytes) => {
            if (stopped) {
              return;
            }
            activeFile = Readable.from([bytes]);
            ready(null, activeFile);
          })
          .catch(() => zip.emit("error", new Error("EXPORT_FILE_UNAVAILABLE")));
      },
    );
  }
  zip.end();
  const reader = Readable.toWeb(output).getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          reader.releaseLock();
          controller.close();
        } else if (value instanceof Uint8Array) {
          controller.enqueue(value);
        } else {
          controller.error(new Error("EXPORT_FAILED"));
        }
      } catch {
        controller.error(new Error("EXPORT_FAILED"));
      }
    },
    async cancel() {
      cancel();
      await reader.cancel();
      reader.releaseLock();
    },
  });
  if (signal.aborted) {
    cancel();
  }
  return body;
}
