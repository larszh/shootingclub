import Link from "next/link";
import { CalendarDays, ChevronRight, CreditCard, Package, Printer, Receipt } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { CopyButton } from "@/components/ui/controls";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";
import { formatIban, formatQrReference } from "@/lib/qr-reference";
import { cn } from "@/lib/utils";
import { PAYMENT_SOURCE_LABEL, PAYMENT_STATUS_LABEL, type PaymentItem, type PaymentSource } from "../overview";

/** Gemeinsame Darstellung der Zahlungsübersicht (Mitglied und Verwaltung). Ohne Client-State. */

const SOURCE_ICON: Record<PaymentSource, React.ComponentType<{ className?: string }>> = {
  FEE: Receipt,
  BOOKING: CalendarDays,
  ONLINE: CreditCard,
  AMMO: Package,
};

export function SourceIcon({ source, tone = "neutral" }: { source: PaymentSource; tone?: "neutral" | "warn" | "danger" }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        tone === "danger" ? "bg-danger/12 text-danger" : tone === "warn" ? "bg-warn/15 text-warn" : "bg-surface-2 text-ink-2",
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

const day = (d: Date) => formatDateZurich(d, { weekday: undefined });

export function dueText(item: PaymentItem) {
  if (item.status !== "OPEN") {
    if (item.status === "PAID" && item.paidAt) return `bezahlt am ${day(item.paidAt)}`;
    return null;
  }
  if (!item.dueAt) return "offen";
  return item.overdue ? `überfällig seit ${day(item.dueAt)}` : `zahlbar bis ${day(item.dueAt)}`;
}

/** Zahlungsangaben eines Vereins für die Kopierknöpfe. */
export type PayeeInfo = { iban: string | null; payeeName: string; qrIban: boolean };

/** Offene Rechnung als Karte mit Kopierknöpfen für IBAN, Referenz bzw. Zahlungszweck und Betrag. */
export function OpenPaymentCard({ item, payee }: { item: PaymentItem; payee: PayeeInfo }) {
  const purpose = (item.number && !item.title.includes(item.number) ? `${item.title} ${item.number}` : item.title).trim();
  const due = dueText(item);
  return (
    <Card className={cn("p-4", item.overdue && "border-danger/50")}>
      <div className="flex items-start gap-3">
        <SourceIcon source={item.source} tone={item.overdue ? "danger" : "warn"} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">{item.title}</div>
          <div className="text-xs text-ink-3">
            {[item.number, PAYMENT_SOURCE_LABEL[item.source], item.detail].filter(Boolean).join(" · ")}
          </div>
          {due ? <div className={cn("mt-0.5 text-xs font-medium", item.overdue ? "text-danger" : "text-ink-2")}>{due}</div> : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums">{formatMoney(item.amountCents, item.currency)}</div>
          <Badge tone={item.overdue ? "danger" : "warn"}>{item.overdue ? "Überfällig" : "Offen"}</Badge>
        </div>
      </div>

      {payee.iban ? (
        <div className="mt-3 rounded-control bg-surface-2 p-3 text-sm">
          <div className="text-xs text-ink-3">Zahlbar an {payee.payeeName}</div>
          <div className="mt-0.5 break-all font-mono tabular-nums">{formatIban(payee.iban)}</div>
          {item.reference ? (
            <div className="mt-1.5">
              <div className="text-xs text-ink-3">Referenz</div>
              <div className="break-all font-mono tabular-nums">{formatQrReference(item.reference)}</div>
            </div>
          ) : payee.qrIban ? (
            <p className="mt-1.5 text-xs text-ink-3">Bitte mit der QR-Rechnung bezahlen, dort steht die Referenznummer.</p>
          ) : (
            <div className="mt-1.5">
              <div className="text-xs text-ink-3">Zahlungszweck</div>
              <div>{purpose}</div>
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <CopyButton text={payee.iban.replace(/\s+/g, "")} label="IBAN kopieren" copiedMessage="IBAN kopiert" className="min-h-11" />
            {item.reference ? (
              <CopyButton text={item.reference} label="Referenz kopieren" copiedMessage="Referenz kopiert" className="min-h-11" />
            ) : !payee.qrIban ? (
              <CopyButton text={purpose} label="Zweck kopieren" copiedMessage="Zahlungszweck kopiert" className="min-h-11" />
            ) : null}
            <CopyButton text={(item.amountCents / 100).toFixed(2)} label="Betrag kopieren" copiedMessage="Betrag kopiert" className="min-h-11" />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">Die Zahlungsangaben stehen auf der Rechnung.</p>
      )}

      <Link
        href={item.href}
        target={item.external ? "_blank" : undefined}
        className="press mt-3 flex h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface text-[15px] font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Printer className="h-4 w-4" aria-hidden /> QR-Rechnung öffnen
      </Link>
    </Card>
  );
}

/** Kompakte Zeile (erledigte Posten oder Verwaltungsliste). */
export function PaymentRow({ item, showMember }: { item: PaymentItem; showMember?: boolean }) {
  const st = item.overdue ? { label: "Überfällig", tone: "danger" as const } : PAYMENT_STATUS_LABEL[item.status];
  const due = dueText(item);
  const sub = [showMember ? item.memberName : null, item.number, PAYMENT_SOURCE_LABEL[item.source], showMember ? null : item.detail].filter(Boolean).join(" · ");
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      className={cn("flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent", item.overdue && "bg-danger/5")}
    >
      <SourceIcon source={item.source} tone={item.overdue ? "danger" : item.status === "OPEN" ? "warn" : "neutral"} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.title}</div>
        <div className="truncate text-xs text-ink-3">{sub}</div>
        {due ? <div className={cn("text-xs", item.overdue ? "font-medium text-danger" : "text-ink-3")}>{due}</div> : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{formatMoney(item.amountCents, item.currency)}</div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}

export function formatTotals(totals: Array<{ currency: string; cents: number }>) {
  return totals.map((t) => formatMoney(t.cents, t.currency)).join(" · ");
}
