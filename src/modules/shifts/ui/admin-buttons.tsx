"use client";

import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { approveWorkLogAction, deleteShiftAction } from "@/modules/shifts/actions";

export function DeleteShiftButton({ shiftId, title, confirmed }: { shiftId: string; title: string; confirmed: number }) {
  const router = useRouter();
  return (
    <ActionButton variant="ghost" className="text-danger" action={() => deleteShiftAction(shiftId)} onSuccess={() => router.push("/admin/shifts")}
      confirm={{ title: `«${title}» löschen?`, message: confirmed ? `${confirmed} bestätigte Einsätze werden mitgelöscht und nicht mehr angerechnet.` : "Alle Einteilungen werden entfernt.", confirmLabel: "Löschen", tone: "danger" }}>
      <Trash2 className="h-4 w-4" /> Löschen
    </ActionButton>
  );
}

export function ApproveWorkLogButtons({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex gap-1.5">
      <ActionButton size="sm" className="h-11" action={() => approveWorkLogAction(id, true)} refresh><Check className="h-4 w-4" /> Bewilligen</ActionButton>
      <ActionButton size="sm" variant="ghost" className="h-11" aria-label={`Eintrag von ${name} ablehnen`} action={() => approveWorkLogAction(id, false)} refresh
        confirm={{ title: "Eintrag ablehnen?", message: `Der Eintrag von ${name} wird entfernt und nicht angerechnet. ${name} wird benachrichtigt.`, confirmLabel: "Ablehnen", tone: "danger" }}>
        <X className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
