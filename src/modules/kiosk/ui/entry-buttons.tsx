"use client";

import { Trash2, Undo2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { releaseCancelledAction, stornoEntryAction } from "@/modules/kiosk/actions";

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
