"use client";

import { approveAssociationMemberAction, rejectAssociationMemberAction, removeAssociationMemberAction } from "@/modules/association/actions";
import { ActionButton } from "@/components/ui/action-button";
import { useT } from "@/components/locale";

export function PendingActions({ associationId, memberId, clubName }: { associationId: string; memberId: string; clubName: string }) {
  const t = useT();
  return (
    <div className="flex gap-2">
      <ActionButton action={() => approveAssociationMemberAction(associationId, memberId)} refresh>{t("adm2.assoc.c.approve")}</ActionButton>
      <ActionButton
        variant="secondary"
        action={() => rejectAssociationMemberAction(associationId, memberId)}
        confirm={{ title: t("adm2.assoc.c.rejectQ", { name: clubName }), confirmLabel: t("adm2.assoc.c.reject"), tone: "danger" }}
        refresh
      >
        {t("adm2.assoc.c.reject")}
      </ActionButton>
    </div>
  );
}

export function RemoveClubButton({ associationId, memberId, clubName }: { associationId: string; memberId: string; clubName: string }) {
  const t = useT();
  return (
    <ActionButton
      variant="ghost"
      action={() => removeAssociationMemberAction(associationId, memberId)}
      confirm={{ title: t("adm2.assoc.c.removeQ", { name: clubName }), message: t("adm2.assoc.c.removeText"), tone: "danger", confirmLabel: t("adm2.common.remove") }}
      refresh
    >
      {t("adm2.common.remove")}
    </ActionButton>
  );
}
