"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, UserMinus } from "lucide-react";
import {
  addAssociationAdminAction,
  regenerateAssociationCodeAction,
  removeAssociationAdminAction,
  setAssociationAdminRoleAction,
  setAssociationDeletedAction,
  updateAssociationAction,
} from "@/modules/association/actions";
import { ASSOCIATION_ADMIN_ROLES } from "@/modules/association/access";
import { useT } from "@/components/locale";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { CopyButton } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";

export function EditAssociationForm({ id, name, region }: { id: string; name: string; region: string | null }) {
  const [state, action] = useActionState(updateAssociationAction, null);
  const t = useT();
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? t("adm2.common.saved"));
  }, [state, t]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <Field label={t("adm2.common.name")} error={err?.name}><Input name="name" defaultValue={name} required maxLength={191} /></Field>
        <Field label={t("adm2.super.as.region")} error={err?.region}><Input name="region" defaultValue={region ?? ""} maxLength={191} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary">{t("adm2.common.save")}</SubmitButton>
      </form>
    </Card>
  );
}

export function CodeCard({ id, code }: { id: string; code: string }) {
  const t = useT();
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-3">{t("adm2.super.ad.codeForClubs")}</div>
          <div className="font-mono text-2xl tracking-[0.25em] font-semibold">{code}</div>
        </div>
        <CopyButton text={code} label={t("adm2.super.ad.copy")} copiedMessage={t("adm2.super.ad.copied")} iconOnly />
        <ActionButton
          variant="secondary"
         
          className="h-11 w-11 px-0"
          aria-label={t("adm2.super.ad.newCode")}
          action={() => regenerateAssociationCodeAction(id)}
          confirm={{ title: t("adm2.super.ad.newCodeQ"), message: t("adm2.super.ad.newCodeText"), tone: "danger", confirmLabel: t("adm2.super.ad.newCodeConfirm") }}
          refresh
        >
          <RefreshCw className="h-4 w-4" />
        </ActionButton>
      </div>
      <p className="mt-2 text-xs text-ink-3">{t("adm2.super.ad.codeHint")}</p>
    </Card>
  );
}

export function AddAdminForm({ associationId }: { associationId: string }) {
  const [state, action] = useActionState(addAssociationAdminAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? t("adm2.common.saved"));
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router, t]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="associationId" value={associationId} />
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label={t("adm2.super.ad.email")} error={err?.email}><Input name="email" type="email" required maxLength={191} autoComplete="off" inputMode="email" /></Field>
          <Field label={t("adm2.super.ad.role")} error={err?.role}>
            <Select name="role" defaultValue="ADMIN">
              {ASSOCIATION_ADMIN_ROLES.map((r) => <option key={r} value={r}>{t(`adm2.assoc.role.${r}`)}</option>)}
            </Select>
          </Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary">{t("adm2.super.ad.grant")}</SubmitButton>
      </form>
    </Card>
  );
}

export function AdminRow({ id, name, email, role, deleted }: { id: string; name: string; email: string; role: string; deleted: boolean }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  function change(next: string) {
    start(async () => {
      const res = await setAssociationAdminRoleAction(id, next);
      if (res.ok) {
        toast.success(res.message ?? t("adm2.common.saved"));
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">{name}{deleted ? <Badge tone="danger">{t("adm2.super.ad.accountDeleted")}</Badge> : null}</div>
        <div className="text-xs text-ink-3 truncate">{email}</div>
      </div>
      <Select aria-label={t("adm2.super.ad.roleOf", { name })} value={role} disabled={pending} onChange={(e) => change(e.target.value)} className="w-36 shrink-0">
        {ASSOCIATION_ADMIN_ROLES.map((r) => <option key={r} value={r}>{t(`adm2.assoc.role.${r}`)}</option>)}
      </Select>
      <ActionButton
        variant="ghost"
       
        className="h-11 w-11 px-0 shrink-0"
        aria-label={t("adm2.super.ad.removeAria", { name })}
        action={() => removeAssociationAdminAction(id)}
        confirm={{ title: t("adm2.super.ad.removeQ", { name }), tone: "danger", confirmLabel: t("adm2.common.remove") }}
        refresh
      >
        <UserMinus className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}

export function DeleteAssociationButton({ id, name, deleted }: { id: string; name: string; deleted: boolean }) {
  const t = useT();
  return deleted ? (
    <ActionButton variant="secondary" action={() => setAssociationDeletedAction(id, false)} refresh>{t("adm2.super.ad.restore")}</ActionButton>
  ) : (
    <ActionButton
      variant="danger"
      action={() => setAssociationDeletedAction(id, true)}
      confirm={{ title: t("adm2.super.ad.deleteQ", { name }), message: t("adm2.super.ad.deleteText"), tone: "danger", confirmLabel: t("adm2.common.delete") }}
      refresh
    >
      <Trash2 className="h-4 w-4" /> {t("adm2.super.ad.deleteBtn")}
    </ActionButton>
  );
}
