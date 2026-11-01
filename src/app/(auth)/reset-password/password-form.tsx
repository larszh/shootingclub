"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Alert, Card, Field } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/controls";
import { useT } from "@/components/locale";
import { translateFieldErrors, translateServerMessage } from "@/components/server-messages";

/** Neues Passwort mit Bestätigung. Wird für «Passwort zurücksetzen» und «Passwort festlegen» verwendet. */
export function NewPasswordForm({
  token,
  email,
  action: serverAction,
  submitLabel,
  minLength,
}: {
  token: string;
  email: string;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  minLength: number;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(serverAction, null);
  const [pw, setPw] = useState("");
  const fe = state && !state.ok ? translateFieldErrors(state.fieldErrors, t) : {};
  const short = pw.length > 0 && pw.length < minLength;
  return (
    <Card className="p-5">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {/* Für Passwort-Manager: Konto zuordnen */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <Field label={t("shell.password.new")} error={fe.password} hint={short ? t("shell.password.remaining", { count: minLength - pw.length }) : t("shell.password.min", { count: minLength })}>
          <PasswordInput name="password" autoComplete="new-password" required minLength={minLength} autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!fe.password || undefined} />
        </Field>
        <Field label={t("shell.password.repeat")} error={fe.confirm}>
          <PasswordInput name="confirm" autoComplete="new-password" required minLength={minLength} aria-invalid={!!fe.confirm || undefined} />
        </Field>
        {state && !state.ok && !fe.password && !fe.confirm ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{translateServerMessage(state.error, t)}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pending={pending} pendingText={t("shell.password.saving")}>{submitLabel}</SubmitButton>
      </form>
    </Card>
  );
}
