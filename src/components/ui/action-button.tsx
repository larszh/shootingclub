"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./index";
import { Spinner } from "./form";
import { confirmDialog, isNavigationError, isNetworkError, toast, type ConfirmOptions } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";

type Result = ActionResult<unknown> | void | undefined;

export type ActionButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick"> & {
  /** Server Action (oder beliebige async-Funktion), z.B. () => deleteMatchAction(id) */
  action: () => Promise<Result>;
  /** Vorher nachfragen. String = Titel. */
  confirm?: ConfirmOptions | string;
  /** Toast bei Erfolg. Standard: message aus dem ActionResult, sonst nichts. false = nie. */
  successMessage?: string | false;
  /** Toast-Text bei Fehler, falls das ActionResult keinen liefert */
  errorMessage?: string;
  /** Text während der Ausführung */
  pendingText?: string;
  /** Nach Erfolg router.refresh() aufrufen (Standard: nein, revalidatePath genügt meist) */
  refresh?: boolean;
  onSuccess?: (result: Result) => void;
  onError?: (error: string) => void;
};

/**
 * Knopf, der eine Server Action ausführt: Ladezustand, optionale Rückfrage und
 * Toasts für Erfolg/Fehler auf Basis von ActionResult.
 *
 * Beispiel:
 *   <ActionButton
 *     variant="danger"
 *     action={() => removeMemberAction(m.id)}
 *     confirm={{ title: `${m.name} entfernen?`, message: "Die Resultate bleiben erhalten.", tone: "danger", confirmLabel: "Entfernen" }}
 *     successMessage="Mitglied entfernt"
 *   >
 *     Entfernen
 *   </ActionButton>
 *
 * redirect() in der Action funktioniert weiterhin (wird nicht als Fehler behandelt).
 */
export function ActionButton({ action, confirm, successMessage, errorMessage, pendingText, refresh, onSuccess, onError, children, disabled, ...props }: ActionButtonProps) {
  const [pending, start] = useTransition();
  const router = useRouter();

  async function run() {
    if (confirm && !(await confirmDialog(confirm))) return;
    start(async () => {
      try {
        const res = await action();
        if (res && res.ok === false) {
          toast.error(res.error || errorMessage || "Das hat nicht geklappt.");
          onError?.(res.error);
          return;
        }
        const msg = successMessage === false ? undefined : (successMessage ?? (res && res.ok ? res.message : undefined));
        if (msg) toast.success(msg);
        onSuccess?.(res);
        if (refresh) router.refresh();
      } catch (err) {
        if (isNavigationError(err)) throw err;
        const offline = isNetworkError(err);
        const text = offline ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : (errorMessage ?? "Das hat nicht geklappt. Bitte nochmals versuchen.");
        toast.error(text);
        onError?.(text);
      }
    });
  }

  return (
    <Button type="button" {...props} disabled={disabled || pending} aria-busy={pending || undefined} onClick={run}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner /> {pendingText ?? children}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
