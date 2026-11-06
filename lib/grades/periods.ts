import type { PeriodMode } from "../../generated/prisma/enums.ts";
import type { messages } from "../i18n/messages.ts";

export function periodCount(mode: PeriodMode) {
  return mode === "SEMESTERS" ? 4 : mode === "SCHOOL_YEAR" ? 2 : 0;
}

export function periodLabel(
  position: number,
  t: Pick<(typeof messages)["en"], "wholeList" | "halfYear">,
) {
  return position === 0 ? t.wholeList : `${t.halfYear} ${position}`;
}
