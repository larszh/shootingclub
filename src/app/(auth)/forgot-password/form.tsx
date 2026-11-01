"use client";

import { useActionState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { useT } from "@/components/locale";
import { translateFieldErrors, translateServerMessage } from "@/components/server-messages";

export function ForgotPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  if (state?.ok) {
    return (
      <Card className="p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ok/10 text-ok">
          <MailCheck className="h-6 w-6" aria-hidden />
        </div>
        <p className="font-semibold">{t("shell.forgot.sent")}</p>
        <p className="mt-1 text-sm text-ink-3" role="status">{translateServerMessage(state.message, t)}</p>
      </Card>
    );
  }
  const fe = state && !state.ok ? translateFieldErrors(state.fieldErrors, t) : {};
  return (
    <Card className="p-5">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4">
        <Field label={t("shell.common.email")} error={fe.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus defaultValue={defaultEmail} placeholder={t("shell.common.emailPlaceholder")} aria-invalid={!!fe.email || undefined} />
        </Field>
        {state && !state.ok && !fe.email ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{translateServerMessage(state.error, t)}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pending={pending} pendingText={t("shell.forgot.sending")}>{t("shell.forgot.submit")}</SubmitButton>
      </form>
    </Card>
  );
}
