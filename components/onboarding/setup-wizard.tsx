import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";
import { MutationError } from "@/components/grades/form-parts";
import { useGradeMutation } from "@/components/grades/use-grade-mutation";
import { gradeListInputSchema, normalizedGradeName } from "@/lib/grades/validation";
import { setupSubjectsSchema, setupTypeSelectionSchema } from "@/lib/grades/setup";
import type { TypeChoice } from "@/lib/grades/types";
import type { GradeCommand } from "@/lib/grades/commands";
import type { MessageKey } from "@/lib/i18n/messages";
import { SetupFields, SetupSummary, type SetupDraft } from "./setup-fields";

export function SetupWizard({
  onClose,
  availableTypes,
}: {
  onClose: () => void;
  availableTypes: TypeChoice[];
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const helpId = useId();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [error, setError] = useState<MessageKey | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submission = useRef<Extract<GradeCommand, { action: "setup.create" }> | null>(null);
  const mutation = useGradeMutation({ refresh: false });
  const [draftState, setDraft] = useState<SetupDraft>(() => ({
    name: "",
    gradingSystemId: "",
    subjects: [{ key: 0, name: "" }],
    types: availableTypes.length
      ? []
      : [
          { key: 0, name: t.tutorialTypeExam, weight: "2", suggestedName: "tutorialTypeExam" },
          { key: 1, name: t.tutorialTypeOral, weight: "1", suggestedName: "tutorialTypeOral" },
        ],
    existingTypeIds: availableTypes.map(({ id }) => id),
    showOnDashboard: true,
    includeInOverall: true,
  }));
  // Only untouched suggestions follow the language; typed names and saved types stay as entered.
  const draft: SetupDraft = {
    ...draftState,
    subjects: draftState.subjects.map((subject) => ({
      ...subject,
      name: subject.suggestedName ? t[subject.suggestedName] : subject.name,
    })),
    types: draftState.types.map((type) => ({
      ...type,
      name: type.suggestedName ? t[type.suggestedName] : type.name,
    })),
  };
  const steps = [
    t.tutorialWelcomeStep,
    t.tutorialListStep,
    t.tutorialSubjectsStep,
    t.tutorialTypesStep,
    t.tutorialReviewStep,
  ];
  const titles = [
    t.tutorialWelcome,
    t.tutorialList,
    t.tutorialSubjects,
    t.tutorialTypes,
    t.tutorialReview,
    t.tutorialDone,
  ];
  const descriptions = [
    t.tutorialWelcomeHelp,
    t.tutorialListHelp,
    t.tutorialSubjectsHelp,
    t.tutorialTypesHelp,
    t.tutorialReviewHelp,
    t.tutorialDoneHelp,
  ];

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const field = window.matchMedia("(hover: hover) and (pointer: fine)").matches
      ? content.current?.querySelector<HTMLInputElement>('input:not([type="checkbox"])')
      : null;
    (field ?? heading.current)?.focus({ preventScroll: true });
    content.current?.scrollTo({ top: 0 });
  }, [step]);

  function move(next: number) {
    setError(null);
    setDirection(next < step ? "backward" : "forward");
    setStep(next);
  }
  function stepError(target: number): MessageKey | null {
    if (
      target === 1 &&
      !gradeListInputSchema.safeParse({ name: draft.name, gradingSystemId: draft.gradingSystemId })
        .success
    ) {
      return "gradeInvalid";
    }
    if (
      target === 2 &&
      !setupSubjectsSchema.safeParse(draft.subjects.map(({ name }) => ({ name }))).success
    ) {
      return "tutorialSubjectInvalid";
    }
    if (target === 3) {
      if (
        !setupTypeSelectionSchema.safeParse({
          types: draft.types.map(({ name, weight }) => ({ name, weight })),
          existingTypeIds: draft.existingTypeIds,
        }).success
      ) {
        return "tutorialTypesInvalid";
      }
      if (
        draft.types.some((type) =>
          availableTypes.some(
            (existing) => normalizedGradeName(existing.name) === normalizedGradeName(type.name),
          ),
        )
      ) {
        return "typeNameExists";
      }
    }
    return null;
  }

  function navigate(next: number) {
    if (!submitted && next !== step && next >= 0 && next < steps.length) {
      move(next);
    }
  }

  async function advance(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.pending) {
      return;
    }
    // Direct navigation may skip incomplete steps. Validate the whole draft before saving.
    const stepsToCheck = step === 4 ? [1, 2, 3] : [step];
    for (const target of stepsToCheck) {
      const invalid = stepError(target);
      if (invalid) {
        move(target);
        setError(invalid);
        return;
      }
    }
    if (step < 4) {
      move(step + 1);
      return;
    }
    if (!submission.current) {
      if (!draft.gradingSystemId) {
        return;
      }
      submission.current = {
        action: "setup.create",
        data: {
          requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
          list: { name: draft.name, gradingSystemId: draft.gradingSystemId },
          subjects: draft.subjects.map(({ name }) => ({ name })),
          types: draft.types.map(({ name, weight }) => ({ name, weight })),
          existingTypeIds: draft.existingTypeIds,
          preferences: {
            showOnDashboard: draft.showOnDashboard,
            includeInOverall: draft.includeInOverall,
          },
        },
      };
    }
    setSubmitted(true);
    const id = await mutation.run(submission.current);
    if (id) {
      setSavedId(id);
      move(5);
    }
  }

  let nextLabel = t.tutorialNext;
  if (mutation.pending) {
    nextLabel = t.tutorialCreating;
  } else if (step === 0) {
    nextLabel = t.tutorialBegin;
  } else if (step === 4) {
    nextLabel = submitted ? t.tutorialRetry : t.tutorialCreate;
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={helpId}
      onCancel={(event) => {
        event.preventDefault();
        if (!mutation.pending) {
          onClose();
        }
      }}
      className="setup-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandIcon />
            <span className="font-semibold tracking-tight">GradeShelf</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div>
              <LanguageSwitcher compact disabled={submitted} />
            </div>
            <Button variant="secondary" onClick={onClose} disabled={mutation.pending}>
              {step === 0 ? t.tutorialLater : t.close}
            </Button>
          </div>
        </header>
        <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pb-6">
          <aside className="hidden flex-col justify-between py-8 lg:flex">
            <div>
              <p className="mb-8 text-sm font-medium text-muted-foreground">{t.tutorialTitle}</p>
              <ol className="space-y-2">
                {steps.map((label, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      aria-current={step === index ? "step" : undefined}
                      disabled={submitted}
                      onClick={() => navigate(index)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left motion-safe:transition-colors disabled:cursor-default ${step === index ? "bg-card font-medium shadow-surface" : "text-muted-foreground enabled:hover:bg-card/60 enabled:hover:text-foreground"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step === index || (step > index && !stepError(index)) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                      >
                        {step > index && !stepError(index) ? "✓" : index + 1}
                      </span>
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-8 max-w-60 text-xs leading-relaxed text-muted-foreground">
              {t.tutorialAdditive}
            </p>
          </aside>
          <form
            onSubmit={advance}
            className="flex min-h-0 min-w-0 flex-col bg-card lg:rounded-3xl lg:shadow-surface"
            aria-busy={mutation.pending}
          >
            <div className="shrink-0 px-6 pt-5 sm:px-10 sm:pt-7">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {step === 5
                    ? t.tutorialDoneLabel
                    : `${t.tutorialStep} ${step + 1} ${t.tutorialOf} ${steps.length}`}
                </span>
                <span className="hidden lg:inline">{steps[step] ?? t.tutorialSaved}</span>
                {step < 5 ? (
                  <select
                    aria-label={t.tutorialStep}
                    value={step}
                    disabled={submitted}
                    onChange={(event) => navigate(Number(event.target.value))}
                    className="min-h-10 max-w-[55%] rounded-lg border border-input bg-field pl-3 text-sm text-foreground lg:hidden"
                  >
                    {steps.map((label, index) => (
                      <option key={index} value={index}>
                        {index + 1}. {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="lg:hidden">{t.tutorialSaved}</span>
                )}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500"
                  style={{ width: `${Math.min((step + 1) / steps.length, 1) * 100}%` }}
                />
              </div>
            </div>
            <div
              ref={content}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-10 sm:py-10"
            >
              <div key={step} className="setup-step mx-auto max-w-2xl" data-direction={direction}>
                {(step === 0 || step === 5) && (
                  <div
                    aria-hidden="true"
                    className="setup-emblem mb-8 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-4xl text-primary"
                  >
                    {step === 5 ? (
                      "✓"
                    ) : (
                      <svg
                        viewBox="0 0 48 48"
                        className="size-12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="10" y="8" width="28" height="34" rx="5" />
                        <path d="M18 8V5h12v3M18 19h12M18 26h12M18 33h6" />
                      </svg>
                    )}
                  </div>
                )}
                <h2
                  ref={heading}
                  tabIndex={-1}
                  id={titleId}
                  className="text-3xl font-semibold leading-tight tracking-tight outline-none sm:text-4xl"
                >
                  {titles[step]}
                </h2>
                <p
                  id={helpId}
                  className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
                >
                  {descriptions[step]}
                </p>
                <div className="mt-8">
                  {step === 0 && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[t.tutorialListStep, t.tutorialSubjectsStep, t.tutorialTypesStep].map(
                          (label, index) => (
                            <div
                              key={label}
                              className="setup-preview rounded-2xl bg-muted/50 p-5"
                              style={{ animationDelay: `${index * 70}ms` }}
                            >
                              <span className="mb-5 block text-2xl font-semibold tabular-nums text-primary/60">
                                0{index + 1}
                              </span>
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                          ),
                        )}
                      </div>
                      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                        {t.tutorialDraftHint}
                      </p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground lg:hidden">
                        {t.tutorialAdditive}
                      </p>
                    </>
                  )}
                  {step > 0 && step < 4 && (
                    <SetupFields
                      step={step}
                      draft={draft}
                      availableTypes={availableTypes}
                      onChange={(next) => {
                        setError(null);
                        setDraft(next);
                      }}
                    />
                  )}
                  {step === 4 && (
                    <fieldset disabled={submitted}>
                      <SetupSummary
                        draft={draft}
                        availableTypes={availableTypes}
                        onChange={setDraft}
                      />
                    </fieldset>
                  )}
                  {step === 5 && (
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-muted/50 p-5">
                        <p className="break-words text-lg font-semibold [overflow-wrap:anywhere]">
                          {draft.name}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {draft.subjects.length} {t.subjects} ·{" "}
                          {draft.types.length + draft.existingTypeIds.length} {t.gradeTypes}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed">{t.tutorialEntryTip}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t.tutorialMoreTip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <footer className="shrink-0 space-y-3 bg-card px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-toolbar sm:px-10 lg:rounded-b-3xl">
              <MutationError message={error ? t[error] : mutation.error} />
              {submitted && mutation.error && (
                <p className="text-xs text-muted-foreground">{t.tutorialRetryHelp}</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {step > 0 && step < 5 ? (
                  <Button variant="secondary" onClick={() => move(step - 1)} disabled={submitted}>
                    {t.tutorialBack}
                  </Button>
                ) : (
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {t.tutorialTitle}
                  </span>
                )}
                {savedId ? (
                  <Button
                    className="ml-auto"
                    onClick={() => {
                      onClose();
                      router.push(`/lists/${savedId}`);
                    }}
                  >
                    {t.tutorialOpenList}
                    <span aria-hidden="true">→</span>
                  </Button>
                ) : (
                  <Button type="submit" className="ml-auto" disabled={mutation.pending}>
                    {nextLabel}
                    <span aria-hidden="true">→</span>
                  </Button>
                )}
              </div>
            </footer>
          </form>
        </div>
      </div>
    </dialog>
  );
}
