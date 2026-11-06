import {
  calculateSubject,
  type CalculationEntry,
  type CalculationList,
  type CalculationSubject,
} from "./averages.ts";
import { gradePoints, gradingSystems, letterGrades } from "./systems.ts";

// Search permitted input grades against exactly the same subject calculation as the UI.
export function requiredGrade(
  list: Pick<CalculationList, "gradingSystemId" | "periodMode">,
  subject: CalculationSubject,
  entries: readonly CalculationEntry[],
  next: Omit<CalculationEntry, "grade">,
  position: number,
  target: number,
) {
  if (list.periodMode === "SEMESTERS" && position === 0) {
    return null;
  }
  const system = gradingSystems[list.gradingSystemId];
  const lower = system.direction === "LOWER_IS_BETTER";
  const letters = letterGrades(list.gradingSystemId);
  const count = letters?.length ?? Math.round((system.max - system.min) / system.entryStep) + 1;
  const candidate = (index: number) =>
    letters
      ? letters[index].value
      : Math.round((system.min + index * system.entryStep) * 100) / 100;
  const at = (quality: number) => candidate(lower ? count - quality - 1 : quality);
  const evaluate = (quality: number) => {
    const grade = at(quality);
    return {
      grade,
      average: calculateSubject(list, subject, [...entries, { ...next, grade }], position),
    };
  };
  const meets = (result: ReturnType<typeof evaluate>) =>
    result.average.value !== null &&
    (lower ? result.average.value <= target + 1e-10 : result.average.value >= target - 1e-10);
  if (
    !Number.isFinite(target) ||
    target < gradePoints(list.gradingSystemId, system.min) ||
    target > gradePoints(list.gradingSystemId, system.max) ||
    !meets(evaluate(count - 1))
  ) {
    return null;
  }
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (meets(evaluate(middle))) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return evaluate(low);
}
