"use client";

import { useActionState, useState } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import { cancelTwoFactorLoginAction, verifyTwoFactorLoginAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { useT } from "@/components/locale";
import { translateServerMessage } from "@/components/server-messages";

export function TwoFactorForm() {
  const t = useT();
  const [state, action, pending] = useActionState(verifyTwoFactorLoginAction, null);
  const [recovery, setRecovery] = useState(false);
  const failed = state && !state.ok;

  return (
    <Card className="p-5">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4">
        {recovery ? (
          <Field label={t("shell.twofa.recoveryCode")} hint={t("shell.twofa.recoveryHint")}>
            <Input key="recovery" name="code" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus placeholder="xxxxx-xxxxx" className="font-mono tracking-wider" aria-invalid={failed || undefined} maxLength={20} />
          </Field>
        ) : (
          <Field label={t("shell.twofa.appCode")}>
            <Input
              key="totp"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              autoFocus
              placeholder="123456"
              className="text-center font-mono text-2xl tracking-[0.4em]"
              aria-invalid={failed || undefined}
            />
          </Field>
        )}
        {failed ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{translateServerMessage(state.error, t)}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pending={pending} pendingText={t("shell.twofa.checking")}>{t("shell.common.login")}</SubmitButton>
      </form>
      <div className="mt-3 flex flex-col items-center gap-1 text-sm">
        <button type="button" onClick={() => setRecovery((v) => !v)} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-ink-2 underline underline-offset-4 hover:text-ink">
          <KeyRound className="h-4 w-4" aria-hidden />
          {recovery ? t("shell.twofa.useApp") : t("shell.twofa.useRecovery")}
        </button>
        <form action={cancelTwoFactorLoginAction}>
          <button type="submit" className="inline-flex min-h-11 items-center px-2 text-ink-3 hover:text-ink">{t("shell.common.cancel")}</button>
        </form>
      </div>
    </Card>
  );
}
