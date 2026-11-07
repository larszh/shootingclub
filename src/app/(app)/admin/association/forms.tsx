"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestAssociationJoinAction, leaveAssociationAction, setAssociationShareNamesAction } from "@/modules/association/actions";
import { CONSENT_POINTS } from "@/modules/association/access";
import { Alert, Card, Field, Input } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Switch } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { useT } from "@/components/locale";

export function ConsentText() {
  const t = useT();
  return (
    <div className="text-sm text-ink-2 space-y-2">
      <p className="font-medium text-ink">{t("adm2.assoc.consent.title")}</p>
      <ul className="list-disc pl-5 space-y-1">
        {CONSENT_POINTS.map((p, i) => <li key={p}>{t(`adm2.assoc.consent.${i}`)}</li>)}
      </ul>
      <p>{t("adm2.assoc.neverShared")}</p>
      <p>{t("adm2.assoc.consent.leave")}</p>
    </div>
  );
}

export function JoinAssociationForm() {
  const [state, action] = useActionState(requestAssociationJoinAction, null);
  const router = useRouter();
  const t = useT();
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? t("adm2.assoc.join.sent"));
      // Die Seite übergibt einen neuen key, sobald sich die Verbindungen ändern: das Formular startet dann leer.
      router.refresh();
    }
  }, [state, router, t]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-4">
        <Field label={t("adm2.assoc.join.code")} hint={t("adm2.assoc.join.codeHint")} error={err?.code}>
          <Input name="code" required maxLength={12} autoComplete="off" autoCapitalize="characters" className="font-mono uppercase tracking-[0.2em]" />
        </Field>
        <ConsentText />
        <label className="flex items-start gap-3 min-h-11 cursor-pointer">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-sm">{t("adm2.assoc.join.agree")}</span>
        </label>
        {err?.consent ? <p className="text-sm text-danger">{err.consent}</p> : null}
        <Switch name="shareNames" label={t("adm2.assoc.join.shareNames")} description={t("adm2.assoc.join.shareNamesHint")} />
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton disabled={!consent}>{t("adm2.assoc.join.submit")}</SubmitButton>
      </form>
    </Card>
  );
}

export function ShareNamesSwitch({ linkId, shareNames, disabled }: { linkId: string; shareNames: boolean; disabled?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(shareNames);
  function change(v: boolean) {
    setOn(v);
    start(async () => {
      const res = await setAssociationShareNamesAction(linkId, v);
      if (res.ok) {
        toast.success(res.message ?? t("adm2.common.saved"));
        router.refresh();
      } else {
        setOn(!v);
        toast.error(res.error);
      }
    });
  }
  return (
    <Switch
      checked={on}
      onChange={change}
      disabled={disabled || pending}
      label={t("adm2.assoc.join.shareNames")}
      description={t("adm2.assoc.join.shareNamesShort")}
    />
  );
}

export function LeaveButton({ linkId, name, pending }: { linkId: string; name: string; pending: boolean }) {
  const t = useT();
  return (
    <ActionButton
      variant={pending ? "secondary" : "danger"}
      action={() => leaveAssociationAction(linkId)}
      confirm={
        pending
          ? { title: t("adm2.assoc.leave.withdrawQ"), confirmLabel: t("adm2.assoc.leave.withdrawConfirm") }
          : { title: t("adm2.assoc.leave.q", { name }), message: t("adm2.assoc.leave.text"), tone: "danger", confirmLabel: t("adm2.assoc.leave.confirm") }
      }
      refresh
    >
      {pending ? t("adm2.assoc.leave.withdraw") : t("adm2.assoc.leave.confirm")}
    </ActionButton>
  );
}
