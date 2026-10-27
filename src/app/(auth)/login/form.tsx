"use client";

import { useActionState } from "react";
import { loginAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <Field label="E-Mail">
          <Input name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
        </Field>
        <Field label="Passwort">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText="Anmelden…">Anmelden</SubmitButton>
      </form>
    </Card>
  );
}
