"use client";

import { HandHelping, LogOut, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { useT } from "@/components/locale";
import { deleteMyWorkLogAction, signUpAction, withdrawAction } from "@/modules/shifts/actions";

export function SignUpButton({ shiftId, title, warning }: { shiftId: string; title: string; warning?: string | null }) {
  const t = useT();
  return (
    <ActionButton className="w-full sm:w-auto" action={() => signUpAction(shiftId)} refresh
      confirm={warning ? { title: t("shooting.shifts.signUpTitle", { title }), message: warning, confirmLabel: t("shooting.shifts.signUpConfirm") } : undefined}>
      <HandHelping className="h-4 w-4" /> {t("shooting.shifts.signUp")}
    </ActionButton>
  );
}

export function WithdrawButton({ shiftId, title }: { shiftId: string; title: string }) {
  const t = useT();
  return (
    <ActionButton variant="secondary" className="w-full sm:w-auto" action={() => withdrawAction(shiftId)} refresh
      confirm={{ title: t("shooting.shifts.withdrawTitle", { title }), message: t("shooting.shifts.withdrawText"), confirmLabel: t("shooting.shifts.withdraw"), tone: "danger" }}>
      <LogOut className="h-4 w-4" /> {t("shooting.shifts.withdraw")}
    </ActionButton>
  );
}

export function DeleteWorkLogButton({ id }: { id: string }) {
  const t = useT();
  return (
    <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label={t("shooting.shifts.deleteLog")} action={() => deleteMyWorkLogAction(id)} refresh
      confirm={{ title: t("shooting.shifts.deleteLogTitle"), confirmLabel: t("shooting.common.delete"), tone: "danger" }}>
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}
