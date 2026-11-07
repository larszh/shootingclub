"use client";

import { approveAssociationMemberAction, rejectAssociationMemberAction, removeAssociationMemberAction } from "@/modules/association/actions";
import { ActionButton } from "@/components/ui/action-button";

export function PendingActions({ associationId, memberId, clubName }: { associationId: string; memberId: string; clubName: string }) {
  return (
    <div className="flex gap-2">
      <ActionButton action={() => approveAssociationMemberAction(associationId, memberId)} refresh>Freigeben</ActionButton>
      <ActionButton
        variant="secondary"
        action={() => rejectAssociationMemberAction(associationId, memberId)}
        confirm={{ title: `Anfrage von «${clubName}» ablehnen?`, confirmLabel: "Ablehnen", tone: "danger" }}
        refresh
      >
        Ablehnen
      </ActionButton>
    </div>
  );
}

export function RemoveClubButton({ associationId, memberId, clubName }: { associationId: string; memberId: string; clubName: string }) {
  return (
    <ActionButton
      variant="ghost"
      action={() => removeAssociationMemberAction(associationId, memberId)}
      confirm={{ title: `«${clubName}» entfernen?`, message: "Der Verband sieht danach keine Kennzahlen dieses Vereins mehr. Ein erneuter Beitritt braucht eine neue Anfrage.", tone: "danger", confirmLabel: "Entfernen" }}
      refresh
    >
      Entfernen
    </ActionButton>
  );
}
