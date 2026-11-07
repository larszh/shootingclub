"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Ban, CheckCircle2, Pencil, Trash2, Wrench } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { deleteWeaponAction, setWeaponStatusAction } from "@/modules/weapons/actions";
import { useT } from "@/components/locale";

/** Statuswechsel für Waffenverantwortliche: sperren (mit Grund), in Wartung, ausmustern, freigeben, löschen. */
export function StatusActions({ weapon }: { weapon: { id: string; name: string; status: string; hasLoans: boolean; blockReason?: string | null } }) {
  const router = useRouter();
  const t = useT();
  const [blockOpen, setBlockOpen] = useState(false);
  const s = weapon.status;
  if (s === "LOANED") return <p className="text-sm text-ink-3">{t("adm2.weapons.st.afterReturn")}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {s !== "AVAILABLE" ? (
        <ActionButton variant="secondary" action={() => setWeaponStatusAction(weapon.id, "AVAILABLE")}
          confirm={s === "RETIRED" ? { title: t("adm2.weapons.st.reactivateQ"), message: t("adm2.weapons.st.reactivateText", { name: weapon.name }), confirmLabel: t("adm2.weapons.st.release") } : undefined}>
          <CheckCircle2 className="h-4 w-4" /> {t("adm2.weapons.st.release")}
        </ActionButton>
      ) : null}
      {s === "AVAILABLE" ? (
        <ActionButton variant="secondary" action={() => setWeaponStatusAction(weapon.id, "SERVICE")}><Wrench className="h-4 w-4" /> {t("adm2.weapons.st.service")}</ActionButton>
      ) : null}
      {s !== "BLOCKED" && s !== "RETIRED" ? (
        <Button variant="secondary" onClick={() => setBlockOpen(true)}><Ban className="h-4 w-4" /> {t("adm2.weapons.st.block")}</Button>
      ) : null}
      {s === "BLOCKED" ? (
        <Button variant="secondary" onClick={() => setBlockOpen(true)}><Pencil className="h-4 w-4" /> {t("adm2.weapons.st.changeReason")}</Button>
      ) : null}
      {s !== "RETIRED" ? (
        <ActionButton variant="secondary" action={() => setWeaponStatusAction(weapon.id, "RETIRED")}
          confirm={{ title: t("adm2.weapons.st.retireQ", { name: weapon.name }), message: t("adm2.weapons.st.retireText"), confirmLabel: t("adm2.weapons.st.retire"), tone: "danger" }}>
          <Archive className="h-4 w-4" /> {t("adm2.weapons.st.retire")}
        </ActionButton>
      ) : null}
      {!weapon.hasLoans ? (
        <ActionButton variant="ghost" className="text-danger" action={() => deleteWeaponAction(weapon.id)} onSuccess={() => router.push("/weapons")}
          confirm={{ title: t("adm2.weapons.st.deleteQ", { name: weapon.name }), message: t("adm2.weapons.st.deleteText"), confirmLabel: t("adm2.common.delete"), tone: "danger" }}>
          <Trash2 className="h-4 w-4" /> {t("adm2.common.delete")}
        </ActionButton>
      ) : null}
      {blockOpen ? <BlockDialog id={weapon.id} name={weapon.name} initial={s === "BLOCKED" ? weapon.blockReason ?? "" : ""} change={s === "BLOCKED"} onClose={() => setBlockOpen(false)} /> : null}
    </div>
  );
}

function BlockDialog({ id, name, initial, change, onClose }: { id: string; name: string; initial: string; change: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const [reason, setReason] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit() {
    setError(null);
    if (!reason.trim()) return setError(t("adm2.weapons.v.reason"));
    start(async () => {
      try {
        const r = await setWeaponStatusAction(id, "BLOCKED", reason);
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm2.weapons.st.blocked"));
        onClose();
        router.refresh();
      } catch {
        setError(t("adm2.common.network"));
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title={change ? t("adm2.weapons.st.changeReason") : t("adm2.weapons.st.blockTitle")} description={name}
      footer={<Button variant="danger" onClick={submit} disabled={pending}>{pending ? <Spinner /> : <Ban className="h-4 w-4" />} {change ? t("adm2.common.save") : t("adm2.weapons.st.block")}</Button>}>
      <div className="space-y-3 pb-2">
        <Field label={t("adm2.weapons.st.reason")} hint={t("adm2.weapons.st.reasonHint")}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={191} data-autofocus /></Field>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}
