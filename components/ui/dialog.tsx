import {
  useLayoutEffect,
  useId,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/provider";

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) {
    return false;
  }

  const bounds = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

// Native modal dialogs provide focus containment, Escape and an inert background.
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const startedOnBackdrop = useRef(false);
  const pointerInteraction = useRef(false);
  const titleId = useId();
  const { t } = useLanguage();
  // Close before React removes the element so the browser can restore focus.
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    const autofocus = dialog?.querySelector<HTMLElement>("[data-autofocus]");
    if (
      autofocus?.dataset.autofocus !== "desktop" ||
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      autofocus?.focus({ preventScroll: true });
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      // close() restores focus natively; a second focus() can highlight the page on Safari.
      dialog?.close();
      // Pointer dismissal should not leave Safari's restored card focus ring visible.
      // Escape/keyboard dismissal retains focus for continued keyboard navigation.
      if (
        pointerInteraction.current &&
        previousFocus instanceof HTMLElement &&
        document.activeElement === previousFocus
      ) {
        previousFocus.blur();
      }
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pointerInteraction.current = true;
    // Both ends must be outside so dragging from a field cannot dismiss the dialog.
    startedOnBackdrop.current = !busy && event.button === 0 && isBackdrop(event);
    if (startedOnBackdrop.current) {
      event.preventDefault();
    }
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    const shouldClose = startedOnBackdrop.current && !busy && isBackdrop(event);
    startedOnBackdrop.current = false;
    if (shouldClose) {
      onClose();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onPointerDown={handlePointerDown}
      onKeyDown={() => {
        pointerInteraction.current = false;
      }}
      onPointerCancel={() => {
        startedOnBackdrop.current = false;
      }}
      onClick={handleClick}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-[calc(100%_-_2rem_-_env(safe-area-inset-left)_-_env(safe-area-inset-right))] max-w-xl overflow-y-auto overscroll-contain rounded-2xl bg-card p-5 text-card-foreground shadow-floating outline-none backdrop:bg-black/35 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 id={titleId} className="pt-2 text-xl font-semibold">
          {title}
        </h2>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t.close}
        </Button>
      </div>
      {children}
    </dialog>
  );
}
