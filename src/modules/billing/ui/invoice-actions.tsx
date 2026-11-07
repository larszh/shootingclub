"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, XCircle } from "lucide-react";
import { markRemindedAction, setFeeInvoiceStatusAction } from "@/modules/billing/actions";
import { useT } from "@/components/locale";

/** `reopenBlocked`: stornierte Rechnung darf nicht reaktiviert werden (Schützenstube-Einträge freigegeben, sonst doppelt verrechnet). */
export function FeeInvoiceActions({ id, status, reopenBlocked = false }: { id: string; status: string; reopenBlocked?: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (s: "OPEN" | "PAID" | "CANCELLED") => start(async () => {
    const r = await setFeeInvoiceStatusAction(id, s);
    if (!r.ok) toast.error(r.error);
    router.refresh();
  });
  return (
    <div className="flex items-center gap-1">
      {status === "OPEN" ? <button type="button" disabled={pending} onClick={() => set("PAID")} className="press h-11 px-3 rounded-control bg-ink text-bg text-xs font-medium inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {t("money.status.PAID")}</button> : null}
      {status === "PAID" ? <button type="button" disabled={pending} onClick={() => set("OPEN")} className="press h-11 px-3 rounded-control border border-line text-xs font-medium inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> {t("money.status.OPEN")}</button> : null}
      {status !== "CANCELLED" ? <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: t("adm1.inv.cancelTitle"), tone: "danger", confirmLabel: t("adm1.inv.cancel"), cancelLabel: t("adm1.inv.keep") }))) set("CANCELLED"); }} className="h-11 w-11 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label={t("adm1.inv.cancel")}><XCircle className="h-4 w-4" /></button> : null}
      {status === "CANCELLED" && !reopenBlocked ? <button type="button" disabled={pending} onClick={() => set("OPEN")} className="press h-11 px-3 rounded-control border border-line text-xs font-medium">{t("adm1.inv.reopen")}</button> : null}
    </div>
  );
}

export function MarkRemindedButton({ ids }: { ids: string[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending || ids.length === 0} onClick={() => start(async () => { await markRemindedAction(ids); router.refresh(); })} className="press h-11 px-3 rounded-control border border-line text-sm font-medium disabled:opacity-40">
      {t("adm1.inv.markRemindedN", { n: ids.length })}
    </button>
  );
}
