"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { registerAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { Hint, PasswordInput, useOnlineStatus } from "@/components/ui/controls";

function passwordStrength(pw: string) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 8) return { label: `Noch ${8 - pw.length} Zeichen`, tone: "text-accent", width: "25%" };
  if (score <= 2) return { label: "Okay", tone: "text-warn", width: "55%" };
  return { label: "Stark", tone: "text-ok", width: "100%" };
}

export function RegisterForm({ joinCode, joinTenantName }: { joinCode?: string; joinTenantName?: string }) {
  const [state, action] = useActionState(registerAction, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  // Kontrollierte Felder bleiben nach einem Fehler erhalten.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(joinCode ?? "");
  const online = useOnlineStatus();
  const strength = passwordStrength(password);
  const codeLocked = !!joinTenantName && code === joinCode;

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        <Field label="Name" error={fe.name}>
          <Input name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required placeholder="Vorname Nachname" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fe.name || undefined} />
        </Field>
        <Field label="E-Mail" error={fe.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" required placeholder="name@beispiel.ch" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fe.email || undefined} />
        </Field>
        <div>
          <Field label="Passwort" error={fe.password}>
            <PasswordInput name="password" autoComplete="new-password" enterKeyHint="next" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fe.password || undefined} />
          </Field>
          {!fe.password ? (
            <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full bg-current transition-[width] duration-300 ${strength?.tone ?? "text-line"}`} style={{ width: strength?.width ?? "0%" }} />
              </div>
              <span className={`w-28 text-right text-xs ${strength?.tone ?? "text-ink-3"}`}>{strength?.label ?? "Mindestens 8 Zeichen"}</span>
            </div>
          ) : null}
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor="joinCode" className="text-sm font-medium text-ink-2">Beitrittscode (optional)</label>
            <Hint label="Was ist der Beitrittscode?">
              Jeder Verein hat einen kurzen Code (z.B. 7KQ2PX9M). Du bekommst ihn vom Vorstand oder per Einladungslink. Ohne Code kannst du später beitreten oder selbst einen Verein anlegen.
            </Hint>
          </div>
          <Input
            id="joinCode"
            name="joinCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            placeholder="z.B. 7KQ2PX"
            className="uppercase font-mono tracking-widest"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!fe.joinCode || undefined}
          />
          {fe.joinCode ? (
            <p className="mt-1 text-sm text-accent">{fe.joinCode} – bitte prüfe den Code oder lass das Feld leer.</p>
          ) : codeLocked ? (
            <p className="mt-1 text-xs text-ok">Passt: Du trittst «{joinTenantName}» als Mitglied bei.</p>
          ) : (
            <p className="mt-1 text-xs text-ink-3">Vom Verein erhalten? Dann hier eingeben, sonst später.</p>
          )}
        </div>
        {state && !state.ok ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
        {!online ? <Alert tone="warn">Keine Verbindung. Zum Registrieren brauchst du Internet.</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText="Konto wird erstellt…">
          {codeLocked ? "Konto erstellen & beitreten" : "Konto erstellen"}
        </SubmitButton>
      </form>
    </Card>
  );
}
