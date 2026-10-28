"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { deleteTargetAction, setTargetHiddenAction } from "@/modules/targets/actions";
import { Button } from "@/components/ui";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";

/** Fehler beim Aufruf einer Server-Action (z.B. offline) als Toast melden; Navigationen durchlassen. */
function reportActionError(err: unknown) {
  if (isNavigationError(err)) throw err;
  toast.error(isNetworkError(err) ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.");
}

export function TargetHiddenToggle({ targetId, hidden }: { targetId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending}
      onClick={() => start(async () => {
        try {
          const r = await setTargetHiddenAction(targetId, !hidden);
          if (!r.ok) toast.error(r.error);
        } catch (err) {
          reportActionError(err);
        }
      })}>
      {hidden ? <><Eye className="h-4 w-4" /> Im Verein anzeigen</> : <><EyeOff className="h-4 w-4" /> Im Verein verstecken</>}
    </Button>
  );
}

export function TargetDeleteButton({ targetId, redirectTo = "/targets" }: { targetId: string; redirectTo?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="ghost" disabled={pending} className="text-ink-3"
      onClick={async () => {
        if (!(await confirmDialog({ title: "Scheibe wirklich löschen?", tone: "danger", confirmLabel: "Löschen" }))) return;
        start(async () => {
          try {
            const r = await deleteTargetAction(targetId);
            if (r.ok) router.push(redirectTo);
            else toast.error(r.error);
          } catch (err) {
            reportActionError(err);
          }
        });
      }}>
      <Trash2 className="h-4 w-4" /> Löschen
    </Button>
  );
}
