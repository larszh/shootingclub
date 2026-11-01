"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { loginAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { PasswordInput, useOnlineStatus } from "@/components/ui/controls";
import { useT } from "@/components/locale";
import { translateServerMessage } from "@/components/server-messages";

export function LoginForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const t = useT();
  const [state, action] = useActionState(loginAction, null);
  // Kontrolliert, damit die E-Mail nach einem Fehlversuch stehen bleibt.
  const [email, setEmail] = useState(defaultEmail ?? "");
  const online = useOnlineStatus();
  const failed = state && !state.ok;

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4" noValidate={false}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label={t("shell.common.email")}>
          <Input
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={failed || undefined}
            placeholder={t("shell.common.emailPlaceholder")}
          />
        </Field>
        <Field label={t("shell.common.password")}>
          <PasswordInput name="password" autoComplete="current-password" enterKeyHint="go" required aria-invalid={failed || undefined} />
        </Field>
        {failed ? (
          <Alert icon={<AlertCircle className="h-4 w-4" />}>
            {translateServerMessage(state.error, t)}
            {state.error.includes("stimmt nicht") ? <span className="block text-xs opacity-80 mt-0.5">{t("shell.login.caseTip")}</span> : null}
            {state.error.includes("stimmt nicht") || state.error.includes("kein Passwort") ? (
              <Link href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"} className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                {t("shell.login.forgot")}
              </Link>
            ) : null}
          </Alert>
        ) : null}
        {!online ? <Alert tone="warn">{t("shell.login.offline")}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText={t("shell.login.pending")}>{t("shell.common.login")}</SubmitButton>
      </form>
    </Card>
  );
}
