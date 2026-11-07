"use client";

import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { approveWorkLogAction, deleteShiftAction } from "@/modules/shifts/actions";
import { useT } from "@/components/locale";

export function DeleteShiftButton({ shiftId, title, confirmed }: { shiftId: string; title: string; confirmed: number }) {
  const router = useRouter();
  const t = useT();
  return (
    <ActionButton variant="ghost" className="text-danger" action={() => deleteShiftAction(shiftId)} onSuccess={() => router.push("/admin/shifts")}
      confirm={{ title: t("adm2.shifts.del.q", { title }), message: confirmed ? t("adm2.shifts.del.confirmed", { n: confirmed }) : t("adm2.shifts.del.all"), confirmLabel: t("adm2.common.delete"), tone: "danger" }}>
      <Trash2 className="h-4 w-4" /> {t("adm2.common.delete")}
    </ActionButton>
  );
}

export function ApproveWorkLogButtons({ id, name }: { id: string; name: string }) {
  const t = useT();
  return (
    <div className="flex gap-1.5">
      <ActionButton size="sm" className="h-11" action={() => approveWorkLogAction(id, true)} refresh><Check className="h-4 w-4" /> {t("adm2.shifts.wl.approve")}</ActionButton>
      <ActionButton size="sm" variant="ghost" className="h-11" aria-label={t("adm2.shifts.wl.rejectAria", { name })} action={() => approveWorkLogAction(id, false)} refresh
        confirm={{ title: t("adm2.shifts.wl.rejectQ"), message: t("adm2.shifts.wl.rejectText", { name }), confirmLabel: t("adm2.shifts.wl.reject"), tone: "danger" }}>
        <X className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
