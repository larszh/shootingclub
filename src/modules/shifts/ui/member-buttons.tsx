"use client";

import { HandHelping, LogOut, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { deleteMyWorkLogAction, signUpAction, withdrawAction } from "@/modules/shifts/actions";

export function SignUpButton({ shiftId, title, warning }: { shiftId: string; title: string; warning?: string | null }) {
  return (
    <ActionButton className="w-full sm:w-auto" action={() => signUpAction(shiftId)} refresh
      confirm={warning ? { title: `Für «${title}» eintragen?`, message: warning, confirmLabel: "Eintragen" } : undefined}>
      <HandHelping className="h-4 w-4" /> Ich helfe mit
    </ActionButton>
  );
}

export function WithdrawButton({ shiftId, title }: { shiftId: string; title: string }) {
  return (
    <ActionButton variant="secondary" className="w-full sm:w-auto" action={() => withdrawAction(shiftId)} refresh
      confirm={{ title: `Von «${title}» austragen?`, message: "Dein Platz wird wieder frei.", confirmLabel: "Austragen", tone: "danger" }}>
      <LogOut className="h-4 w-4" /> Austragen
    </ActionButton>
  );
}

export function DeleteWorkLogButton({ id }: { id: string }) {
  return (
    <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Eintrag löschen" action={() => deleteMyWorkLogAction(id)} refresh
      confirm={{ title: "Eintrag löschen?", confirmLabel: "Löschen", tone: "danger" }}>
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}
