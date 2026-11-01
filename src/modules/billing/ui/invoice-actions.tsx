"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, XCircle } from "lucide-react";
import { markRemindedAction, setFeeInvoiceStatusAction } from "@/modules/billing/actions";

export function FeeInvoiceActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (s: "OPEN" | "PAID" | "CANCELLED") => start(async () => {
    const r = await setFeeInvoiceStatusAction(id, s);
    if (!r.ok) toast.error(r.error);
    router.refresh();
  });
  return (
    <div className="flex items-center gap-1">
      {status === "OPEN" ? <button type="button" disabled={pending} onClick={() => set("PAID")} className="press h-11 px-3 rounded-control bg-ink text-bg text-xs font-medium inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Bezahlt</button> : null}
      {status === "PAID" ? <button type="button" disabled={pending} onClick={() => set("OPEN")} className="press h-11 px-3 rounded-control border border-line text-xs font-medium inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Offen</button> : null}
      {status !== "CANCELLED" ? <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: "Rechnung stornieren?", tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" }))) set("CANCELLED"); }} className="h-11 w-11 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label="Stornieren"><XCircle className="h-4 w-4" /></button> : null}
      {status === "CANCELLED" ? <button type="button" disabled={pending} onClick={() => set("OPEN")} className="press h-11 px-3 rounded-control border border-line text-xs font-medium">Reaktivieren</button> : null}
    </div>
  );
}

export function MarkRemindedButton({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending || ids.length === 0} onClick={() => start(async () => { await markRemindedAction(ids); router.refresh(); })} className="press h-11 px-3 rounded-control border border-line text-sm font-medium disabled:opacity-40">
      Als gemahnt markieren ({ids.length})
    </button>
  );
}
