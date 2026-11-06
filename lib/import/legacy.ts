import type Database from "better-sqlite3";
import { z } from "zod";
import { storageNameSchema } from "../attachments/rules.ts";
import { normalizedGradeName, weightSchema } from "../grades/validation.ts";
import { gradingSystemIdSchema, gradeEntryValueSchema } from "../grades/systems.ts";

const rowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
type Row = z.infer<typeof rowSchema>;
const rows = (db: Database.Database, table: string) =>
  z.array(rowSchema).parse(db.prepare(`SELECT * FROM "${table}"`).all());
const string = (row: Row, field: string) => z.string().min(1).parse(row[field]);
const owned = (row: Row, parent: Row | undefined) => {
  if (!parent || row.userId !== parent.userId) {
    throw new Error("LEGACY_OWNERSHIP_INVALID");
  }
  return parent;
};
const index = (items: Row[]) => new Map(items.map((row) => [string(row, "id"), row]));

// Only this audited schema is accepted. SQL from the source is never executed.
export function prepareLegacyImport(source: Database.Database) {
  const tables = new Map<string, Row[]>();
  for (const table of [
    "bootstrapState",
    "siteSettings",
    "ssoSettings",
    "user",
    "account",
    "session",
    "verification",
    "twoFactor",
    "rateLimit",
    "gradeList",
    "subject",
    "gradeType",
    "gradeListType",
    "gradeEntry",
    "attachment",
    "dashboardPreference",
    "fileCleanup",
    "calendarFeed",
    "calendarFeedList",
  ]) {
    tables.set(table, rows(source, table));
  }
  for (const row of [...tables.get("attachment")!, ...tables.get("fileCleanup")!]) {
    storageNameSchema.parse(row.storageName);
  }
  const lists = index(tables.get("gradeList")!);
  const subjects = index(tables.get("subject")!);
  const types = tables.get("gradeType")!;
  const categories = rows(source, "subjectCategory");
  const categoryMap = index(categories);
  const sourceGroups = rows(source, "gradeGroup");
  const groupMap = index(sourceGroups);
  const periods: Row[] = [];
  const subjectPeriods: Row[] = [];
  const shares: Row[] = [];
  const groups: Row[] = [];
  const categoryTypes = new Map<string, string>();
  const listTypes = tables.get("gradeListType")!;
  let unassignedPeriods = 0;
  let unassignedTypes = 0;
  for (const list of lists.values()) {
    if (!("isKursstufe" in list)) {
      throw new Error("LEGACY_SCHEMA_UNSUPPORTED");
    }
    const upper = list.isKursstufe === 1;
    list.periodMode = upper ? "SEMESTERS" : "NONE";
    if (list.gradingSystemId === "de_school_v1") {
      list.gradingSystemId = "de_school_extended_v1";
    }
    gradingSystemIdSchema.parse(list.gradingSystemId);
    for (let position = 0; position <= (upper ? 4 : 0); position++) {
      periods.push({
        id: `import_period_${list.id}_${position}`,
        userId: list.userId,
        gradeListId: list.id,
        position,
      });
    }
  }
  for (const category of categories) {
    const subject = owned(category, subjects.get(string(category, "subjectId")));
    const list = owned(subject, lists.get(string(subject, "gradeListId")));
    const name = string(category, "name").trim();
    if (!name || name.length > 120) {
      throw new Error("LEGACY_CATEGORY_INVALID");
    }
    let type = types.find(
      (type) =>
        type.userId === category.userId &&
        normalizedGradeName(string(type, "name")) === normalizedGradeName(name),
    );
    if (!type) {
      type = {
        id: `import_type_${category.id}`,
        userId: category.userId,
        name,
        weight: 1,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      };
      types.push(type);
    }
    categoryTypes.set(string(category, "id"), string(type, "id"));
    if (
      !list.useAllGradeTypes &&
      !listTypes.some((link) => link.gradeListId === list.id && link.gradeTypeId === type.id)
    ) {
      listTypes.push({ userId: list.userId, gradeListId: list.id, gradeTypeId: type.id });
    }
  }
  for (const subject of subjects.values()) {
    if (!("halfYears" in subject) || !("isLk" in subject)) {
      throw new Error("LEGACY_SCHEMA_UNSUPPORTED");
    }
    subject.isAdvanced = subject.isLk === 1 ? 1 : 0;
    const list = owned(subject, lists.get(string(subject, "gradeListId")));
    const positions =
      subject.halfYears == null
        ? [1, 2, 3, 4]
        : z
            .string()
            .parse(subject.halfYears)
            .split(",")
            .filter(Boolean)
            .map((value) => {
              if (!/^H[1-4]$/.test(value)) {
                throw new Error("LEGACY_PERIOD_INVALID");
              }
              return Number(value.slice(1));
            });
    const subjectCategories = categories.filter((category) => category.subjectId === subject.id);
    const mapped = subjectCategories.map((category) => ({
      gradeTypeId: categoryTypes.get(string(category, "id"))!,
      share: Number(category.weight) * 100,
    }));
    if (
      mapped.some(
        (item) => !Number.isInteger(item.share) || item.share < 0 || item.share > 10000,
      ) ||
      (mapped.length && mapped.reduce((sum, item) => sum + item.share, 0) !== 10000) ||
      new Set(mapped.map((item) => item.gradeTypeId)).size !== mapped.length
    ) {
      throw new Error("LEGACY_PERCENTAGES_INVALID");
    }
    for (let position = 0; position <= (list.periodMode === "SEMESTERS" ? 4 : 0); position++) {
      const id = `import_subject_${subject.id}_${position}`;
      subjectPeriods.push({
        id,
        userId: subject.userId,
        gradeListId: list.id,
        subjectId: subject.id,
        periodId: `import_period_${list.id}_${position}`,
        enrolled: position === 0 || positions.includes(position) ? 1 : 0,
        weightingMode: mapped.length ? "PERCENTAGES" : "ENTRIES",
        finalGrade: null,
      });
      for (const share of mapped) {
        shares.push({ subjectPeriodId: id, userId: subject.userId, ...share });
      }
    }
  }
  const entries = tables.get("gradeEntry")!;
  for (const entry of entries) {
    const subject = owned(entry, subjects.get(string(entry, "subjectId")));
    const list = owned(entry, lists.get(string(entry, "gradeListId")));
    if (subject.gradeListId !== list.id) {
      throw new Error("LEGACY_OWNERSHIP_INVALID");
    }
    const system = gradingSystemIdSchema.parse(list.gradingSystemId);
    if (entry.grade !== null) {
      gradeEntryValueSchema(system, z.number().parse(entry.grade)).parse(entry.grade);
    }
    weightSchema.parse(entry.weight);
    let position = 0;
    if (entry.halfYear != null) {
      const value = z
        .string()
        .regex(/^H[1-4]$/)
        .parse(entry.halfYear);
      if (list.periodMode !== "SEMESTERS") {
        throw new Error("LEGACY_PERIOD_INVALID");
      }
      position = Number(value.slice(1));
    } else if (list.periodMode === "SEMESTERS") {
      unassignedPeriods++;
    }
    const periodId = `import_subject_${subject.id}_${position}`;
    if (!subjectPeriods.some((period) => period.id === periodId && period.enrolled === 1)) {
      throw new Error("LEGACY_ENROLLMENT_INVALID");
    }
    entry.subjectPeriodId = periodId;
    entry.gradeText = null;
    owned(
      entry,
      types.find((type) => type.id === entry.gradeTypeId),
    );
    if (entry.categoryId != null) {
      const category = owned(entry, categoryMap.get(string(entry, "categoryId")));
      if (category.subjectId !== subject.id) {
        throw new Error("LEGACY_OWNERSHIP_INVALID");
      }
      entry.gradeTypeId = categoryTypes.get(string(category, "id"))!;
    } else if (categories.some((category) => category.subjectId === subject.id)) {
      // Preserve the original type. The UI marks the missing percentage assignment.
      unassignedTypes++;
    }
    if (entry.groupId != null) {
      const group = owned(entry, groupMap.get(string(entry, "groupId")));
      if (
        group.subjectId !== subject.id ||
        (group.categoryId != null && group.categoryId !== entry.categoryId)
      ) {
        throw new Error("LEGACY_GROUP_INVALID");
      }
      weightSchema.parse(group.weight);
      const id = `import_group_${group.id}_${position}_${entry.gradeTypeId}`;
      if (!groups.some((item) => item.id === id)) {
        groups.push({
          id,
          userId: group.userId,
          subjectPeriodId: periodId,
          gradeTypeId: entry.gradeTypeId,
          name: group.name,
          weight: group.weight,
        });
      }
      entry.groupId = id;
    }
  }
  for (const group of sourceGroups) {
    owned(group, subjects.get(string(group, "subjectId")));
    if (!groups.some((item) => String(item.id).startsWith(`import_group_${group.id}_`))) {
      const category = owned(group, categoryMap.get(string(group, "categoryId")));
      if (category.subjectId !== group.subjectId) {
        throw new Error("LEGACY_GROUP_INVALID");
      }
      weightSchema.parse(group.weight);
      groups.push({
        id: `import_group_${group.id}_0`,
        userId: group.userId,
        subjectPeriodId: `import_subject_${group.subjectId}_0`,
        gradeTypeId: categoryTypes.get(string(category, "id"))!,
        name: group.name,
        weight: group.weight,
      });
    }
  }
  tables.set("gradePeriod", periods);
  tables.set("subjectPeriod", subjectPeriods);
  tables.set("subjectGradeType", shares);
  tables.set("gradeGroup", groups);
  for (const table of ["gradePeriod", "subjectPeriod", "gradeGroup"]) {
    for (const row of tables.get(table)!) {
      if (string(row, "id").length > 128) {
        throw new Error("LEGACY_ID_TOO_LONG");
      }
    }
  }
  return {
    tables,
    summary: {
      users: tables.get("user")!.length,
      lists: lists.size,
      subjects: subjects.size,
      entries: entries.length,
      groups: groups.length,
      attachments: tables.get("attachment")!.length,
      unassignedPeriods,
      unassignedTypes,
    },
  };
}

export function writeLegacyImport(
  target: Database.Database,
  plan: ReturnType<typeof prepareLegacyImport>,
) {
  target.pragma("foreign_keys = ON");
  target.transaction(() => {
    target.pragma("defer_foreign_keys = ON");
    for (const [table, data] of plan.tables) {
      const columns = z
        .array(z.object({ name: z.string() }))
        .parse(target.prepare(`PRAGMA table_info("${table}")`).all())
        .map((column) => column.name);
      for (const row of data) {
        const names = columns.filter((column) => Object.hasOwn(row, column));
        const insert = target.prepare(
          `INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
        );
        insert.run(...names.map((name) => row[name]));
      }
    }
    if (z.array(z.unknown()).parse(target.pragma("foreign_key_check")).length) {
      throw new Error("LEGACY_RELATIONS_INVALID");
    }
  })();
}
