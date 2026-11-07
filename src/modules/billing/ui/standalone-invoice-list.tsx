"use client";

import Link from "next/link";
import { AlertTriangle, Info, Printer } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { FeeInvoiceActions } from "@/modules/billing/ui/invoice-actions";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/i18n/core";
import { useLocale, useT } from "@/components/locale";
import type { StandaloneInvoiceRow } from "@/modules/billing/queries";

/** Liste der Einzelrechnungen (Verwaltung): Status ändern, QR-Rechnung drucken, Hinweise. */
export function StandaloneInvoiceList({ invoices }: { invoices: StandaloneInvoiceRow[] }) {
  const t = useT();
  const locale = useLocale();
  const d = (x: Date) => formatDate(x, locale);
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {invoices.map((i) => {
        const st = FEE_INVOICE_STATUS[i.status] ? { label: t(`money.status.${i.status}`), tone: FEE_INVOICE_STATUS[i.status]!.tone } : { label: i.status, tone: "neutral" as const };
        return (
          <div key={i.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.memberName}</div>
                <div className="text-xs text-ink-3">
                  {i.number} · {i.categoryName}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="outline">{t(`adm1.inv.kind.${i.kind}`)}{i.kind === "kiosk" && i.kioskEntries ? ` · ${t(i.kioskEntries === 1 ? "adm1.inv.positions.one" : "adm1.inv.positions.other", { n: i.kioskEntries })}` : ""}</Badge>
                  {i.overdue ? <Badge tone="danger">{t("adm1.inv.overdue")}</Badge> : null}
                  {i.reminders > 0 ? <Badge tone="warn">{t("adm1.inv.reminded", { n: i.reminders })}</Badge> : null}
                  {i.onlinePaid ? <Badge tone="ok">{t("adm1.inv.paidOnline")}</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-ink-3">
                  {t("adm1.inv.issuedOn", { date: d(i.issuedAt) })}
                  {i.status === "OPEN" ? ` · ${t("adm1.inv.dueOn", { date: d(i.dueAt) })}` : ""}
                  {i.paidAt ? ` · ${t("adm1.inv.paidOn", { date: d(i.paidAt) })}` : ""}
                  {i.status === "CANCELLED" && i.cancelledAt ? ` · ${t("adm1.inv.cancelledOn", { date: d(i.cancelledAt) })}` : ""}
                </div>
                {i.note ? <div className="mt-1 whitespace-pre-line text-xs text-ink-2">{i.note}</div> : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums">{formatMoney(i.amountCents, i.currency)}</div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            </div>
            {i.hints.length ? (
              <ul className="mt-2 space-y-1">
                {i.hints.map((h) => (
                  <li key={h.text} className={`flex items-start gap-1.5 text-xs ${h.tone === "warn" ? "text-warn" : "text-ink-3"}`}>
                    {h.tone === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
                    <span>{h.key ? t(h.key, h.vars) : h.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
              <Link href={`/billing/invoices/${i.id}/print`} target="_blank" className="press inline-flex h-11 items-center gap-1 rounded-control border border-line px-3 text-xs font-medium">
                <Printer className="h-3.5 w-3.5" aria-hidden /> {t(i.status === "OPEN" ? "adm1.inv.qrInvoice" : "adm1.inv.invoice")}
              </Link>
              <FeeInvoiceActions id={i.id} status={i.status} reopenBlocked={i.reopenBlocked} />
            </div>
          </div>
        );
      })}
      {invoices.length === 0 ? <p className="p-4 text-sm text-ink-3">{t("adm1.inv.noneInSelection")}</p> : null}
    </Card>
  );
}
