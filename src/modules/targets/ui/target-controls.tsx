"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { deleteTargetAction, setTargetHiddenAction } from "@/modules/targets/actions";
import { Button } from "@/components/ui";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { useT } from "@/components/locale";
import type { TFunction } from "@/lib/i18n/core";

/** Fehler beim Aufruf einer Server-Action (z.B. offline) als Toast melden; Navigationen durchlassen. */
function reportActionError(err: unknown, t: TFunction) {
  if (isNavigationError(err)) throw err;
  toast.error(isNetworkError(err) ? t("adm2.targets.c.network") : t("adm2.targets.c.failed"));
}

export function TargetHiddenToggle({ targetId, hidden }: { targetId: string; hidden: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending}
      onClick={() => start(async () => {
        try {
          const r = await setTargetHiddenAction(targetId, !hidden);
          if (!r.ok) toast.error(r.error);
        } catch (err) {
          reportActionError(err, t);
        }
      })}>
      {hidden ? <><Eye className="h-4 w-4" /> {t("adm2.targets.c.show")}</> : <><EyeOff className="h-4 w-4" /> {t("adm2.targets.c.hide")}</>}
    </Button>
  );
}

export function TargetDeleteButton({ targetId, redirectTo = "/targets" }: { targetId: string; redirectTo?: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="ghost" disabled={pending} className="text-ink-3"
      onClick={async () => {
        if (!(await confirmDialog({ title: t("adm2.targets.c.confirmDelete"), tone: "danger", confirmLabel: t("adm2.targets.c.delete") }))) return;
        start(async () => {
          try {
            const r = await deleteTargetAction(targetId);
            if (r.ok) router.push(redirectTo);
            else toast.error(r.error);
          } catch (err) {
            reportActionError(err, t);
          }
        });
      }}>
      <Trash2 className="h-4 w-4" /> {t("adm2.targets.c.delete")}
    </Button>
  );
}
