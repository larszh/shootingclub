"use client";

import { useActionState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";

export function ForgotPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  if (state?.ok) {
    return (
      <Card className="p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ok/10 text-ok">
          <MailCheck className="h-6 w-6" aria-hidden />
        </div>
        <p className="font-semibold">Mail ist unterwegs</p>
        <p className="mt-1 text-sm text-ink-3" role="status">{state.message}</p>
      </Card>
    );
  }
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <Card className="p-5">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4">
        <Field label="E-Mail" error={fe.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus defaultValue={defaultEmail} placeholder="name@beispiel.ch" aria-invalid={!!fe.email || undefined} />
        </Field>
        {state && !state.ok && !fe.email ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pending={pending} pendingText="Wird gesendet…">Link senden</SubmitButton>
      </form>
    </Card>
  );
}
