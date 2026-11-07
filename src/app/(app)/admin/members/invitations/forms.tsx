"use client";

import { useActionState, useState, useTransition } from "react";
import { RotateCw, Send, Trash2 } from "lucide-react";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { CopyButton } from "@/components/ui/controls";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import { TENANT_ROLES } from "@/lib/permissions";
import { getT, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { inviteMemberAction, resendInvitationAction, revokeInvitationAction } from "@/modules/members/actions";

export function InviteForm({ locale, canInviteAdmin }: { locale: Locale; canInviteAdmin: boolean }) {
  const t = getT(locale);
  const [state, action, pending] = useActionState(inviteMemberAction, null);
  // Nach Erfolg leeres Formular: neuer key pro erfolgreichem Ergebnis
  const formKey = state?.ok ? state.data?.url ?? "ok" : "form";
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card className="animate-rise p-4">
      <form key={formKey} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label={t("adm1.common.email")} error={fe.email}><Input name="email" type="email" required placeholder={t("adm1.inv.emailPlaceholder")} autoComplete="off" /></Field>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label={t("adm1.inv.nameOptional")} error={fe.name}><Input name="name" maxLength={191} placeholder={t("adm1.inv.namePlaceholder")} /></Field>
          <Field label={t("adm1.members.role")} error={fe.role}>
            <Select name="role" defaultValue="MEMBER">
              {TENANT_ROLES.filter((r) => r !== "OWNER" && (canInviteAdmin || r !== "ADMIN")).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
            </Select>
          </Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        {state?.ok ? (
          <Alert tone="ok">
            {state.message}
            {state.data?.url ? (
              <span className="mt-2 flex items-center gap-2 text-ink-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{state.data.url}</span>
                <CopyButton text={state.data.url} label={t("adm1.inv.copyLink")} copiedMessage={t("adm1.inv.linkCopied")} />
              </span>
            ) : null}
          </Alert>
        ) : null}
        <SubmitButton pending={pending} pendingText={t("adm1.common.sending")}><Send className="h-4 w-4" /> {t("adm1.inv.send")}</SubmitButton>
      </form>
    </Card>
  );
}

export function InvitationRow({ locale, id, email, name, role, meta, expired }: { locale: Locale; id: string; email: string; name: string | null; role: string; meta: string; expired: boolean }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const resend = () => start(async () => {
    const res = await resendInvitationAction(id);
    if (res.ok) toast.success(res.message ?? t("adm1.inv.resent"));
    else toast.error(res.error);
  });
  const revoke = async () => {
    if (!(await confirmDialog({ title: t("adm1.inv.revokeTitle", { email }), message: t("adm1.inv.revokeMessage"), tone: "danger", confirmLabel: t("adm1.inv.revoke") }))) return;
    start(async () => {
      const res = await revokeInvitationAction(id);
      if (res.ok) {
        setGone(true);
        toast.success(res.message ?? t("adm1.inv.revoked"));
      } else toast.error(res.error);
    });
  };
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2", pending && "opacity-60")}>
      <div className="min-w-0 flex-1 py-1">
        <div className="truncate font-medium">{name || email}</div>
        <div className="truncate text-xs text-ink-3">{name ? `${email} · ` : ""}{meta}</div>
      </div>
      {expired ? <Badge tone="warn">{t("adm1.inv.expired")}</Badge> : <Badge>{role}</Badge>}
      {pending ? <Spinner /> : null}
      <button type="button" disabled={pending} onClick={resend} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={t("adm1.inv.resendTo", { email })} title={t("adm1.member.resend")}>
        <RotateCw className="h-4 w-4" />
      </button>
      <button type="button" disabled={pending} onClick={revoke} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger" aria-label={t("adm1.inv.revokeTo", { email })} title={t("adm1.inv.revoke")}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
