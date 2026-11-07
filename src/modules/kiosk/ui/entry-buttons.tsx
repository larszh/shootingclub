"use client";

import { Check, RotateCcw, Trash2, Undo2, XCircle } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { releaseCancelledAction, stornoEntryAction } from "@/modules/kiosk/actions";
import { setFeeInvoiceStatusAction } from "@/modules/billing/actions";
import { useT } from "@/components/locale";

/** Storno eines unverrechneten Eintrags (Verwaltung). */
export function StornoEntryButton({ id, label }: { id: string; label: string }) {
  const t = useT();
  return (
    <ActionButton
      variant="ghost"
      size="sm"
      className="h-11 w-11 shrink-0 rounded-full px-0 text-ink-3 hover:bg-danger/10 hover:text-danger"
      aria-label={t("adm1.kiosk.stornoLabel", { label })}
      action={() => stornoEntryAction(id)}
      confirm={{ title: t("adm1.kiosk.stornoTitle"), message: t("adm1.kiosk.stornoMessage", { label }), tone: "danger", confirmLabel: t("adm1.inv.cancel") }}
      refresh
    >
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}

/** Einträge aus stornierten Rechnungen wieder freigeben. */
export function ReleaseCancelledButton({ count }: { count: number }) {
  const t = useT();
  return (
    <ActionButton
      variant="secondary"
      action={() => releaseCancelledAction()}
      confirm={{ title: t(count === 1 ? "adm1.kiosk.releaseTitle.one" : "adm1.kiosk.releaseTitle.other", { n: count }), message: t("adm1.kiosk.releaseMessage"), confirmLabel: t("adm1.kiosk.release") }}
      refresh
    >
      <Undo2 className="h-4 w-4" /> {t("adm1.kiosk.releaseAgain")}
    </ActionButton>
  );
}

/**
 * Status einer Schützenstube-Rechnung ändern (Einzelrechnung ohne Beitragslauf): bar oder per
 * Überweisung ohne QR-Referenz bezahlt markieren, zurück auf offen, oder stornieren
 * (danach lassen sich die Einträge freigeben und neu verrechnen). Nur für Admins (Recht tenant.manage).
 */
export function KioskInvoiceActions({ id, number, status }: { id: string; number: string; status: string }) {
  const t = useT();
  return (
    <div className="flex shrink-0 items-center gap-1">
      {status === "OPEN" ? (
        <ActionButton size="sm" className="h-11" action={() => setFeeInvoiceStatusAction(id, "PAID")} successMessage={t("adm1.kiosk.markedPaid", { number })} refresh aria-label={t("adm1.kiosk.markPaidLabel", { number })}>
          <Check className="h-4 w-4" /> {t("money.status.PAID")}
        </ActionButton>
      ) : null}
      {status === "PAID" ? (
        <ActionButton size="sm" variant="secondary" className="h-11" action={() => setFeeInvoiceStatusAction(id, "OPEN")} successMessage={t("adm1.kiosk.reopened", { number })} refresh aria-label={t("adm1.kiosk.reopenLabel", { number })}>
          <RotateCcw className="h-4 w-4" /> {t("money.status.OPEN")}
        </ActionButton>
      ) : null}
      {status !== "CANCELLED" ? (
        <ActionButton
          variant="ghost" size="sm" className="h-11 w-11 shrink-0 rounded-full px-0 text-ink-3 hover:bg-danger/10 hover:text-danger"
          aria-label={t("adm1.kiosk.cancelLabel", { number })}
          action={() => setFeeInvoiceStatusAction(id, "CANCELLED")}
          confirm={{ title: t("adm1.kiosk.cancelTitle", { number }), message: t("adm1.kiosk.cancelMessage"), tone: "danger", confirmLabel: t("adm1.inv.cancel"), cancelLabel: t("adm1.inv.keep") }}
          successMessage={t("adm1.kiosk.cancelled", { number })}
          refresh
        >
          <XCircle className="h-4 w-4" />
        </ActionButton>
      ) : (
        <ActionButton size="sm" variant="secondary" className="h-11" action={() => setFeeInvoiceStatusAction(id, "OPEN")} successMessage={t("adm1.kiosk.reactivated", { number })} refresh aria-label={t("adm1.kiosk.reactivateLabel", { number })}>
          {t("adm1.inv.reopen")}
        </ActionButton>
      )}
    </div>
  );
}
