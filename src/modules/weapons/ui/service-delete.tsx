"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { deleteServiceAction } from "@/modules/weapons/actions";

export function ServiceDeleteButton({ id }: { id: string }) {
  return (
    <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0 text-ink-3 hover:text-danger" aria-label="Eintrag löschen"
      action={() => deleteServiceAction(id)} confirm={{ title: "Wartungseintrag löschen?", message: "Der Zähler «Schuss seit der letzten Wartung» richtet sich danach wieder nach dem vorherigen Eintrag.", confirmLabel: "Löschen", tone: "danger" }}>
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}
