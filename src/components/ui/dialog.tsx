"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { AlertTriangle, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  confirmDialog,
  getConfirmQueue,
  getServerConfirmQueue,
  registerDialogHost,
  resolveConfirm,
  subscribeConfirm,
  type ConfirmOptions,
} from "@/lib/ui-feedback";
import { buttonClasses } from "./index";

export { confirmDialog };
export type { ConfirmOptions };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Knöpfe unten (rechtsbündig am Desktop, volle Breite mobil) */
  footer?: React.ReactNode;
  /**
   * auto: mobil als Bottom-Sheet, ab sm zentriert (Standard)
   * center: immer zentriert · sheet: immer von unten
   */
  variant?: "auto" | "center" | "sheet";
  /** Schliessen per Hintergrund-Klick erlauben (Standard: ja) */
  dismissible?: boolean;
  /** Element, das beim Öffnen den Fokus erhält (sonst erstes fokussierbares) */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  icon?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
};

/**
 * Zugänglicher modaler Dialog auf Basis von <dialog>: Fokusfalle, Escape, Klick auf
 * den Hintergrund, aria-modal und Rückgabe des Fokus an das auslösende Element.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = "auto", dismissible = true, initialFocusRef, icon, className, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    if (!el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    }
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const target = initialFocusRef?.current ?? el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    // Schliessen/Unmount: Dialog zu, Scrollen freigeben, Fokus zurückgeben.
    return () => {
      if (el.open) el.close();
      el.removeAttribute("open");
      document.documentElement.style.overflow = prevOverflow;
      const back = returnFocus.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open, initialFocusRef]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (dismissible) onCloseRef.current();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!nodes.length) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const sheet = variant === "sheet";
  const auto = variant === "auto";
  const width = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" }[size];

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onCloseRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onCloseRef.current();
      }}
      className={cn(
        "bg-transparent p-0 text-ink backdrop:bg-black/45 backdrop:backdrop-blur-[2px] open:animate-fade",
        "max-h-[100dvh] w-full max-w-none overflow-visible",
        sheet || auto ? "mb-0 mt-auto" : "m-auto px-4",
        auto && cn("sm:m-auto sm:px-4", width),
        !sheet && !auto && width,
        sheet && "mx-auto sm:max-w-lg",
      )}
    >
      {open ? (
        <div
          className={cn(
            "relative flex max-h-[min(88dvh,46rem)] flex-col border border-line bg-surface shadow-2xl animate-rise",
            sheet || auto ? "rounded-t-card pb-[env(safe-area-inset-bottom)]" : "rounded-card",
            auto && "sm:rounded-card sm:pb-0",
            className,
          )}
        >
          {sheet || auto ? <div aria-hidden className={cn("mx-auto mt-2 h-1.5 w-10 rounded-full bg-line", auto && "sm:hidden")} /> : null}
          <div className="flex items-start gap-3 px-5 pt-4 pb-2">
            {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold leading-snug tracking-tight">{title}</h2>
              {description ? <div id={descId} className="mt-1 text-[15px] text-ink-2">{description}</div> : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                aria-label="Dialog schliessen"
                className="press -mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{children}</div> : null}
          {footer ? <div className="flex flex-col-reverse gap-2 px-5 pt-3 pb-5 sm:flex-row sm:justify-end">{footer}</div> : <div className="h-3" />}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Zeigt Bestätigungsdialoge aus confirmDialog(). Einmal im Layout einbinden:
 *   <DialogHost />
 */
export function DialogHost() {
  const queue = useSyncExternalStore(subscribeConfirm, getConfirmQueue, getServerConfirmQueue);
  useEffect(() => registerDialogHost(), []);
  const current = queue[0];
  return current ? <ConfirmView key={current.id} req={current} /> : null;
}

/**
 * Rückfall, falls kein confirmLabel übergeben wurde. «Löschen» nur, wenn der Titel
 * tatsächlich vom Löschen spricht – sonst neutral (Absagen, Stornieren usw. bitte
 * immer explizit als confirmLabel angeben).
 */
function defaultConfirmLabel(title: string, danger: boolean) {
  return danger && /löschen/i.test(title) ? "Löschen" : "Bestätigen";
}

function ConfirmView({ req }: { req: ReturnType<typeof getConfirmQueue>[number] }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = req.tone === "danger";
  return (
    <Dialog
      open
      onClose={() => resolveConfirm(req.id, false)}
      title={req.title}
      description={req.message}
      size="sm"
      // Bei gefährlichen Aktionen startet der Fokus auf «Abbrechen».
      initialFocusRef={danger ? cancelRef : confirmRef}
      icon={
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", danger ? "bg-danger/10 text-danger" : "bg-surface-2 text-ink-2")}>
          {danger ? <AlertTriangle className="h-5 w-5" aria-hidden /> : <HelpCircle className="h-5 w-5" aria-hidden />}
        </span>
      }
      footer={
        <>
          <button ref={cancelRef} type="button" className={buttonClasses("secondary", "lg", "w-full sm:w-auto sm:h-11")} onClick={() => resolveConfirm(req.id, false)}>
            {req.cancelLabel ?? "Abbrechen"}
          </button>
          <button ref={confirmRef} type="button" className={buttonClasses(danger ? "danger" : "primary", "lg", "w-full sm:w-auto sm:h-11")} onClick={() => resolveConfirm(req.id, true)}>
            {req.confirmLabel ?? defaultConfirmLabel(req.title, danger)}
          </button>
        </>
      }
    />
  );
}
