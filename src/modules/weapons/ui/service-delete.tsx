"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { deleteServiceAction } from "@/modules/weapons/actions";
import { useT } from "@/components/locale";

export function ServiceDeleteButton({ id }: { id: string }) {
  const t = useT();
  return (
    <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0 text-ink-3 hover:text-danger" aria-label={t("adm2.weapons.service.deleteAria")}
      action={() => deleteServiceAction(id)} confirm={{ title: t("adm2.weapons.service.deleteQ"), message: t("adm2.weapons.service.deleteText"), confirmLabel: t("adm2.common.delete"), tone: "danger" }}>
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}
