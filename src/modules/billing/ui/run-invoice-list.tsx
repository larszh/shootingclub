"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck } from "lucide-react";
import { bulkMarkFeeInvoicesPaidAction, markRemindedAction } from "@/modules/billing/actions";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { FeeInvoiceActions } from "@/modules/billing/ui/invoice-actions";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";
import { cn, plural } from "@/lib/utils";

export type RunInvoiceDto = {
  id: string; memberName: string; number: string; categoryName: string; amountCents: number; currency: string; status: string;
  remindedAt: Date | null; paidAt: Date | null; reminders: number; overdue: boolean; note: string | null;
};

const d = (x: Date) => formatDateZurich(x, { weekday: undefined });

export function RunInvoiceList({ invoices }: { invoices: RunInvoiceDto[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const openIds = invoices.filter((i) => i.status === "OPEN").map((i) => i.id);
  const chosen = openIds.filter((id) => selected.has(id));
  const chosenTotal = invoices.filter((i) => chosen.includes(i.id)).reduce((a, i) => a + i.amountCents, 0);
  const allChosen = openIds.length > 0 && chosen.length === openIds.length;

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(openIds));

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? { ok: true, text: r.message ?? "Erledigt." } : { ok: false, text: r.error ?? "Fehler" });
    if (r.ok) {
      setSelected(new Set());
      router.refresh();
    }
  });

  return (
    <div>
      {openIds.length ? (
        <label className="mb-2 flex items-center gap-3 px-1 text-sm text-ink-2 cursor-pointer min-h-11">
          <input type="checkbox" checked={allChosen} onChange={toggleAll} className="h-5 w-5 accent-[var(--ink)]" />
          Alle offenen in dieser Auswahl wählen ({openIds.length})
        </label>
      ) : null}
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {invoices.map((i) => {
          const st = FEE_INVOICE_STATUS[i.status]!;
          const isOpen = i.status === "OPEN";
          return (
            <div key={i.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:flex-nowrap", selected.has(i.id) && "bg-surface-2")}>
              {isOpen ? (
                <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="h-5 w-5 shrink-0 accent-[var(--ink)]" aria-label={`${i.memberName} auswählen`} />
              ) : <span className="w-5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <Link href={`/billing/invoices/${i.id}/print`} target="_blank" className="block truncate font-medium hover:underline">{i.memberName}</Link>
                <div className="text-xs text-ink-3">
                  {i.number} · {i.categoryName}
                  {i.paidAt ? ` · bezahlt ${d(i.paidAt)}` : ""}
                </div>
                {i.reminders > 0 || i.overdue ? (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {i.overdue ? <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">überfällig</span> : null}
                    {i.reminders > 0 ? <Badge tone="warn">{i.reminders}× gemahnt{i.remindedAt ? `, zuletzt ${d(i.remindedAt)}` : ""}</Badge> : null}
                  </div>
                ) : null}
                {i.note ? <div className="mt-0.5 text-xs text-ink-3 line-clamp-1">{i.note}</div> : null}
              </div>
              <div className="text-right shrink-0"><div className="font-semibold tabular-nums text-sm">{formatMoney(i.amountCents, i.currency)}</div><Badge tone={st.tone}>{st.label}</Badge></div>
              <div className="flex basis-full justify-end sm:basis-auto"><FeeInvoiceActions id={i.id} status={i.status} /></div>
            </div>
          );
        })}
        {invoices.length === 0 ? <p className="p-4 text-sm text-ink-3">Keine Rechnungen in dieser Auswahl.</p> : null}
      </Card>

      {msg ? <div className="mt-3"><Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert></div> : null}

      {chosen.length ? (
        <div className="sticky bottom-24 md:bottom-4 mt-4 animate-pop">
          <Card className="p-2.5 shadow-lg flex flex-wrap items-center gap-2">
            <span className="px-1.5 text-sm"><span className="font-semibold">{chosen.length}</span> gewählt · {formatMoney(chosenTotal, invoices[0]?.currency ?? "CHF")}</span>
            <div className="ml-auto flex gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => markRemindedAction(chosen))}><BellRing className="h-4 w-4" /> Gemahnt</Button>
              <Button type="button" size="sm" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: `${plural(chosen.length, "Rechnung", "Rechnungen")} als bezahlt markieren?`, confirmLabel: "Als bezahlt markieren" }))) run(() => bulkMarkFeeInvoicesPaidAction(chosen)); }}>
                {pending ? <Spinner /> : <CheckCheck className="h-4 w-4" />} Als bezahlt markieren
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
