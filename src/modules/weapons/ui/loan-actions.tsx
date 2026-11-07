"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileCheck2, Undo2 } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { markReportedAction, returnLoanAction } from "@/modules/weapons/actions";
import { useT } from "@/components/locale";

/** Knopf «Zurücknehmen» mit Dialog für die Schusszahl. */
export function ReturnButton({ loanId, label, size = "md", variant = "primary", className }: { loanId: string; label: string; size?: "sm" | "md"; variant?: "primary" | "secondary"; className?: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}><CornerDownLeft className="h-4 w-4" /> {t("adm2.weapons.ret.button")}</Button>
      {open ? <ReturnDialog loanId={loanId} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReturnDialog({ loanId, label, onClose }: { loanId: string; label: string; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const [shots, setShots] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = shots === "" || /^\d{1,6}$/.test(shots);

  function submit() {
    setError(null);
    if (!valid) return setError(t("adm2.weapons.ret.wholeNumber"));
    start(async () => {
      try {
        const r = await returnLoanAction(loanId, shots === "" ? null : Number(shots));
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm2.weapons.msg.returned"));
        onClose();
        router.refresh();
      } catch {
        setError(t("adm2.common.network"));
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title={t("adm2.weapons.ret.title")} description={label}
      footer={<Button onClick={submit} disabled={pending || !valid}>{pending ? <Spinner /> : <CornerDownLeft className="h-4 w-4" />} {t("adm2.weapons.ret.button")}</Button>}>
      <div className="space-y-3 pb-2">
        <Field label={t("adm2.weapons.ret.shots")} hint={t("adm2.weapons.ret.shotsHint")}>
          <Input value={shots} onChange={(e) => setShots(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder={t("adm2.weapons.ret.shotsPh")} className="text-lg" data-autofocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[20, 40, 60, 100].map((n) => (
            <Button key={n} type="button" variant="secondary" className="h-11 min-w-16" onClick={() => setShots(String(n))}>{n}</Button>
          ))}
        </div>
        <p className="text-xs text-ink-3">{t("adm2.weapons.ret.check")}</p>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}

/** «Als gemeldet markieren» bzw. (Verwaltung) Markierung entfernen. */
export function ReportButton({ loanId, reported, canUndo, size = "sm" }: { loanId: string; reported: boolean; canUndo: boolean; size?: "sm" | "md" }) {
  const t = useT();
  if (reported) {
    return canUndo ? (
      <ActionButton size={size} variant="ghost" className="h-11" action={() => markReportedAction(loanId, false)} confirm={{ title: t("adm2.weapons.report.removeQ"), message: t("adm2.weapons.report.removeText"), confirmLabel: t("adm2.common.remove") }}>
        <Undo2 className="h-4 w-4" /> {t("adm2.weapons.report.undo")}
      </ActionButton>
    ) : null;
  }
  return (
    <ActionButton size={size} variant="secondary" className="h-11" action={() => markReportedAction(loanId, true)}
      confirm={{ title: t("adm2.weapons.report.markQ"), message: t("adm2.weapons.report.markText"), confirmLabel: t("adm2.weapons.report.reported") }}>
      <FileCheck2 className="h-4 w-4" /> {t("adm2.weapons.report.mark")}
    </ActionButton>
  );
}
