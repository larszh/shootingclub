"use client";

import { useActionState } from "react";
import { registerAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function RegisterForm({ joinCode }: { joinCode?: string }) {
  const [state, action] = useActionState(registerAction, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <Field label="Name" error={fe.name}>
          <Input name="name" autoComplete="name" required placeholder="Vorname Nachname" />
        </Field>
        <Field label="E-Mail" error={fe.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Passwort" error={fe.password} hint="Mindestens 8 Zeichen">
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Beitrittscode (optional)" error={fe.joinCode} hint="Vom Verein erhalten? Dann hier eingeben, sonst später.">
          <Input name="joinCode" defaultValue={joinCode} placeholder="z.B. 7KQ2PX" className="uppercase font-mono tracking-widest" autoCapitalize="characters" />
        </Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText="Konto wird erstellt…">Konto erstellen</SubmitButton>
      </form>
    </Card>
  );
}
