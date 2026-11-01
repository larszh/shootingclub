"use client";

import { Check, RotateCcw, Trash2, Undo2, XCircle } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { releaseCancelledAction, stornoEntryAction } from "@/modules/kiosk/actions";
import { setFeeInvoiceStatusAction } from "@/modules/billing/actions";

/** Storno eines unverrechneten Eintrags (Verwaltung). */
export function StornoEntryButton({ id, label }: { id: string; label: string }) {
  return (
    <ActionButton
      variant="ghost"
      size="sm"
      className="h-11 w-11 shrink-0 rounded-full px-0 text-ink-3 hover:bg-danger/10 hover:text-danger"
      aria-label={`${label} stornieren`}
      action={() => stornoEntryAction(id)}
      confirm={{ title: "Eintrag stornieren?", message: `${label}. Der Eintrag wird gelöscht und erscheint auf keiner Rechnung.`, tone: "danger", confirmLabel: "Stornieren" }}
      refresh
    >
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}

/** Einträge aus stornierten Rechnungen wieder freigeben. */
export function ReleaseCancelledButton({ count }: { count: number }) {
  return (
    <ActionButton
      variant="secondary"
      action={() => releaseCancelledAction()}
      confirm={{ title: `${count} ${count === 1 ? "Eintrag" : "Einträge"} freigeben?`, message: "Die Einträge gehören zu stornierten Rechnungen und werden wieder als offen geführt, damit sie neu verrechnet werden können.", confirmLabel: "Freigeben" }}
      refresh
    >
      <Undo2 className="h-4 w-4" /> Wieder freigeben
    </ActionButton>
  );
}

/**
 * Status einer Schützenstube-Rechnung ändern (Einzelrechnung ohne Beitragslauf): bar oder per
 * Überweisung ohne QR-Referenz bezahlt markieren, zurück auf offen, oder stornieren
 * (danach lassen sich die Einträge freigeben und neu verrechnen). Nur für Admins (Recht tenant.manage).
 */
export function KioskInvoiceActions({ id, number, status }: { id: string; number: string; status: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {status === "OPEN" ? (
        <ActionButton size="sm" className="h-11" action={() => setFeeInvoiceStatusAction(id, "PAID")} successMessage={`${number} als bezahlt markiert.`} refresh aria-label={`Rechnung ${number} als bezahlt markieren`}>
          <Check className="h-4 w-4" /> Bezahlt
        </ActionButton>
      ) : null}
      {status === "PAID" ? (
        <ActionButton size="sm" variant="secondary" className="h-11" action={() => setFeeInvoiceStatusAction(id, "OPEN")} successMessage={`${number} wieder offen.`} refresh aria-label={`Rechnung ${number} wieder auf offen setzen`}>
          <RotateCcw className="h-4 w-4" /> Offen
        </ActionButton>
      ) : null}
      {status !== "CANCELLED" ? (
        <ActionButton
          variant="ghost" size="sm" className="h-11 w-11 shrink-0 rounded-full px-0 text-ink-3 hover:bg-danger/10 hover:text-danger"
          aria-label={`Rechnung ${number} stornieren`}
          action={() => setFeeInvoiceStatusAction(id, "CANCELLED")}
          confirm={{ title: `Rechnung ${number} stornieren?`, message: "Die Rechnung gilt danach als storniert. Die Einträge lassen sich anschliessend wieder freigeben und neu verrechnen.", tone: "danger", confirmLabel: "Stornieren", cancelLabel: "Behalten" }}
          successMessage={`${number} storniert.`}
          refresh
        >
          <XCircle className="h-4 w-4" />
        </ActionButton>
      ) : (
        <ActionButton size="sm" variant="secondary" className="h-11" action={() => setFeeInvoiceStatusAction(id, "OPEN")} successMessage={`${number} reaktiviert.`} refresh aria-label={`Rechnung ${number} reaktivieren`}>
          Reaktivieren
        </ActionButton>
      )}
    </div>
  );
}
