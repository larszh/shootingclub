"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { loginAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { PasswordInput, useOnlineStatus } from "@/components/ui/controls";

export function LoginForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const [state, action] = useActionState(loginAction, null);
  // Kontrolliert, damit die E-Mail nach einem Fehlversuch stehen bleibt.
  const [email, setEmail] = useState(defaultEmail ?? "");
  const online = useOnlineStatus();
  const failed = state && !state.ok;

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4" noValidate={false}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="E-Mail">
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
            placeholder="name@beispiel.ch"
          />
        </Field>
        <Field label="Passwort">
          <PasswordInput name="password" autoComplete="current-password" enterKeyHint="go" required aria-invalid={failed || undefined} />
        </Field>
        {failed ? (
          <Alert icon={<AlertCircle className="h-4 w-4" />}>
            {state.error}
            {state.error.includes("stimmt nicht") ? <span className="block text-xs opacity-80 mt-0.5">Tipp: Gross-/Kleinschreibung beim Passwort beachten.</span> : null}
            {state.error.includes("stimmt nicht") || state.error.includes("kein Passwort") ? (
              <Link href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"} className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                Passwort vergessen?
              </Link>
            ) : null}
          </Alert>
        ) : null}
        {!online ? <Alert tone="warn">Keine Verbindung. Zum Anmelden brauchst du Internet.</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText="Anmelden…">Anmelden</SubmitButton>
      </form>
    </Card>
  );
}
