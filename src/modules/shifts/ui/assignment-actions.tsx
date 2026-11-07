"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, RotateCcw, UserX, X } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { confirmAllDoneAction, removeAssignmentAction, setAssignmentStatusAction } from "@/modules/shifts/actions";
import { useT } from "@/components/locale";

/** Aktionen pro Einteilung: erledigt (mit Stunden), nicht erschienen, zurücksetzen, entfernen. */
export function AssignmentActions({ assignmentId, name, status, defaultHours, started }: { assignmentId: string; name: string; status: string; defaultHours: number; started: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {started && status !== "DONE" ? (
        <Button size="sm" className="h-11" onClick={() => setOpen(true)}><Check className="h-4 w-4" /> {t("adm2.shifts.as.done")}</Button>
      ) : null}
      {started && status === "DONE" ? (
        <Button size="sm" variant="secondary" className="h-11" onClick={() => setOpen(true)}>{t("adm2.shifts.as.changeHours")}</Button>
      ) : null}
      {started && status !== "NO_SHOW" ? (
        <ActionButton size="sm" variant="secondary" className="h-11" action={() => setAssignmentStatusAction(assignmentId, "NO_SHOW")} refresh
          confirm={{ title: t("adm2.shifts.as.noShowQ", { name }), message: t("adm2.shifts.as.noShowText"), confirmLabel: t("adm2.shifts.as.noShowConfirm") }}>
          <UserX className="h-4 w-4" /> {t("adm2.shifts.as.notThere")}
        </ActionButton>
      ) : null}
      {status !== "ASSIGNED" ? (
        <ActionButton size="sm" variant="ghost" className="h-11" action={() => setAssignmentStatusAction(assignmentId, "ASSIGNED")} refresh aria-label={t("adm2.shifts.as.resetAria")}>
          <RotateCcw className="h-4 w-4" />
        </ActionButton>
      ) : null}
      <ActionButton size="sm" variant="ghost" className="h-11" action={() => removeAssignmentAction(assignmentId)} refresh aria-label={t("adm2.shifts.as.removeAria", { name })}
        confirm={{ title: t("adm2.shifts.as.removeQ", { name }), message: status === "DONE" ? t("adm2.shifts.as.removeText") : undefined, confirmLabel: t("adm2.common.remove"), tone: "danger" }}>
        <X className="h-4 w-4" />
      </ActionButton>
      {open ? <HoursDialog assignmentId={assignmentId} name={name} defaultHours={defaultHours} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function HoursDialog({ assignmentId, name, defaultHours, onClose }: { assignmentId: string; name: string; defaultHours: number; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const [hours, setHours] = useState(String(defaultHours));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = Number(hours.replace(",", "."));
  const valid = hours.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 24;

  function submit() {
    setError(null);
    if (!valid) return setError(t("adm2.shifts.msg.hoursRange"));
    start(async () => {
      try {
        const r = await setAssignmentStatusAction(assignmentId, "DONE", n);
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm2.shifts.as.confirmed"));
        onClose();
        router.refresh();
      } catch {
        setError(t("adm2.common.network"));
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title={t("adm2.shifts.as.title")} description={name}
      footer={<Button onClick={submit} disabled={pending || !valid}>{pending ? <Spinner /> : <Check className="h-4 w-4" />} {t("adm2.shifts.as.confirm")}</Button>}>
      <div className="space-y-3 pb-2">
        <Field label={t("adm2.shifts.form.credit")} hint={t("adm2.shifts.as.hoursHint")}>
          <Input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))} inputMode="decimal" className="text-lg" data-autofocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[...new Set([defaultHours, 1, 2, 3, 4, 8])].map((h) => (
            <Button key={h} type="button" variant="secondary" className="h-11 min-w-14" onClick={() => setHours(String(h))}>{h} h</Button>
          ))}
        </div>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}

export function ConfirmAllButton({ shiftId, count, hours }: { shiftId: string; count: number; hours: string }) {
  const t = useT();
  return (
    <ActionButton variant="secondary" action={() => confirmAllDoneAction(shiftId)} refresh
      confirm={{ title: t(count === 1 ? "adm2.shifts.as.allQ.one" : "adm2.shifts.as.allQ.other", { n: count }), message: t("adm2.shifts.as.allText", { h: hours }), confirmLabel: t("adm2.shifts.as.allConfirm") }}>
      <CheckCheck className="h-4 w-4" /> {t("adm2.shifts.as.allDone")}
    </ActionButton>
  );
}
