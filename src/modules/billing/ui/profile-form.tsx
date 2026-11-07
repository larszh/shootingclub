"use client";

import { useActionState, useState } from "react";
import { Info } from "lucide-react";
import { saveBillingProfileAction } from "@/modules/billing/actions";
import type { BillingProfileView } from "@/modules/billing/profile";
import { compactCode, formatIban, isQrIban } from "@/lib/qr-reference";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

export function BillingProfileForm({ profile }: { profile: BillingProfileView }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveBillingProfileAction, null);
  const [iban, setIban] = useState(profile.iban ? formatIban(profile.iban) : "");
  const compact = compactCode(iban);
  const qr = isQrIban(compact);
  const plausible = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact);
  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form onSubmit={submitKeepingValues(action)} className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">{t("adm1.profile.payee")}</h3>{profile.qrReady ? <Badge tone="ok">{t("adm1.profile.qrReady")}</Badge> : <Badge tone="warn">{t("adm1.profile.incomplete")}</Badge>}</div>
          <p className="text-xs text-ink-3">{t("adm1.profile.hint")}</p>
          <Field label={t("adm1.common.name")}><Input name="payeeName" defaultValue={profile.payeeName ?? ""} placeholder={t("adm1.profile.namePlaceholder")} /></Field>
          <Field label={t("adm1.member.street")}><Input name="payeeStreet" defaultValue={profile.payeeStreet ?? ""} placeholder={t("adm1.profile.streetPlaceholder")} /></Field>
          <div className="grid grid-cols-[100px_1fr] gap-3 sm:grid-cols-[120px_1fr]">
            <Field label={t("adm1.member.zip")}><Input name="payeeZip" defaultValue={profile.payeeZip ?? ""} inputMode="numeric" /></Field>
            <Field label={t("adm1.tenant.city")}><Input name="payeeCity" defaultValue={profile.payeeCity ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
            <Field label={t("adm1.profile.iban")}>
              <Input name="iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="CH93 0076 2011 6238 5295 7" className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label={t("adm1.profile.currency")}><Select name="currency" defaultValue={profile.currency}><option value="CHF">CHF</option><option value="EUR">EUR</option></Select></Field>
          </div>
          {compact ? (
            <div className={cn("rounded-control px-3 py-2 text-sm", qr ? "bg-ok/10 text-ok" : plausible ? "bg-surface-2 text-ink-2" : "bg-warn/10 text-warn")}>
              {t(qr ? "adm1.profile.qrDetected" : plausible ? "adm1.profile.normalIban" : "adm1.profile.ibanIncomplete")}
            </div>
          ) : null}
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton pending={pending}>{t("adm1.common.save")}</SubmitButton>
        </form>
      </Card>

      <Card className="animate-rise p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-ink-2" /> {t("adm1.profile.whichTitle")}</div>
        <div className="flex items-center gap-2 text-xs"><span className="text-ink-3">{t("adm1.profile.mode")}</span>{profile.iban ? (profile.qrIban ? <Badge tone="ok">{t("adm1.profile.modeQr")}</Badge> : <Badge>{t("adm1.profile.modeIban")}</Badge>) : <Badge tone="warn">{t("adm1.profile.modeNone")}</Badge>}</div>
        <p className="text-ink-2"><span className="font-medium">{t("adm1.profile.normalTitle")}</span> {t("adm1.profile.normalText")}</p>
        <p className="text-ink-2"><span className="font-medium">QR-IBAN</span> {t("adm1.profile.qrText")}</p>
        <p className="text-xs text-ink-3">{t("adm1.profile.switchNote")}</p>
      </Card>
    </div>
  );
}
