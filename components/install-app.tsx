"use client";

import { useState, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

function canShowAppleInstall() {
  const appleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return (
    appleMobile &&
    !matchMedia("(display-mode: standalone)").matches &&
    !("standalone" in navigator && navigator.standalone === true)
  );
}

function subscribe(onChange: () => void) {
  const mode = matchMedia("(display-mode: standalone)");
  mode.addEventListener("change", onChange);
  return () => mode.removeEventListener("change", onChange);
}

export function InstallApp() {
  const visible = useSyncExternalStore(subscribe, canShowAppleInstall, () => false);
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  if (!visible) {
    return null;
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t.installApp}
        <svg
          aria-hidden="true"
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8" />
        </svg>
      </Button>
      {open && (
        <Dialog title={t.installTitle} onClose={() => setOpen(false)}>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">{t.installHelp}</p>
            <ol className="space-y-4">
              {[t.installStepOne, t.installStepTwo, t.installStepThree].map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.installConnection}</p>
            <Button className="w-full" onClick={() => setOpen(false)}>
              {t.installGotIt}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
