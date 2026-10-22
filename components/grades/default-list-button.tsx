"use client";

import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { MutationError } from "./form-parts";
import { useGradeMutation } from "./use-grade-mutation";

export function DefaultListButton({
  id,
  name,
  isDefault,
}: {
  id: string;
  name: string;
  isDefault: boolean;
}) {
  const { t } = useLanguage();
  const mutation = useGradeMutation();
  const label = isDefault ? t.unsetDefaultList : t.setDefaultList;

  return (
    <div className="relative z-10">
      <Button
        variant="secondary"
        className={`size-11 shrink-0 px-0 ${isDefault ? "text-primary" : "text-muted-foreground"}`}
        title={label}
        aria-label={`${label}: ${name}`}
        aria-pressed={isDefault}
        disabled={mutation.pending}
        onClick={() => mutation.run({ action: "list.default", id, enabled: !isDefault })}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill={isDefault ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9L12 3Z" />
        </svg>
      </Button>
      <MutationError message={mutation.error} />
    </div>
  );
}
