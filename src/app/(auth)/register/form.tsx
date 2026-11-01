"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { registerAction } from "@/modules/core/auth-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { Hint, PasswordInput, useOnlineStatus } from "@/components/ui/controls";
import { useT } from "@/components/locale";
import { translateFieldErrors, translateServerMessage } from "@/components/server-messages";
import type { TFunction } from "@/lib/i18n/core";

function passwordStrength(pw: string, t: TFunction) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 8) return { label: t("shell.password.remaining", { count: 8 - pw.length }), tone: "text-accent", width: "25%" };
  if (score <= 2) return { label: t("shell.password.okay"), tone: "text-warn", width: "55%" };
  return { label: t("shell.password.strong"), tone: "text-ok", width: "100%" };
}

export function RegisterForm({ joinCode, joinTenantName, next, invite, defaultEmail, defaultName, submitLabel }: {
  joinCode?: string;
  joinTenantName?: string;
  /** Ziel nach der Registrierung (z.B. /invite/…) */
  next?: string;
  /** Einladungs-Token: bei passender E-Mail wird direkt beigetreten, Beitrittscode entfällt. */
  invite?: string;
  defaultEmail?: string;
  defaultName?: string;
  submitLabel?: string;
}) {
  const t = useT();
  const [state, action] = useActionState(registerAction, null);
  const fe = state && !state.ok ? translateFieldErrors(state.fieldErrors, t) : {};
  // Kontrollierte Felder bleiben nach einem Fehler erhalten.
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(joinCode ?? "");
  const online = useOnlineStatus();
  const strength = passwordStrength(password, t);
  const codeLocked = !!joinTenantName && code === joinCode;

  return (
    <Card className="p-5">
      <form action={action} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {invite ? <input type="hidden" name="invite" value={invite} /> : null}
        <Field label={t("shell.common.name")} error={fe.name}>
          <Input name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required placeholder={t("shell.register.namePlaceholder")} autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fe.name || undefined} />
        </Field>
        <Field label={t("shell.common.email")} error={fe.email}>
          <Input name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" required placeholder={t("shell.common.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fe.email || undefined} />
        </Field>
        <div>
          <Field label={t("shell.common.password")} error={fe.password}>
            <PasswordInput name="password" autoComplete="new-password" enterKeyHint="next" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fe.password || undefined} />
          </Field>
          {!fe.password ? (
            <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full bg-current transition-[width] duration-300 ${strength?.tone ?? "text-line"}`} style={{ width: strength?.width ?? "0%" }} />
              </div>
              <span className={`w-28 text-right text-xs ${strength?.tone ?? "text-ink-3"}`}>{strength?.label ?? t("shell.password.min", { count: 8 })}</span>
            </div>
          ) : null}
        </div>
        {invite ? null : <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor="joinCode" className="text-sm font-medium text-ink-2">{t("shell.register.joinCode")}</label>
            <Hint label={t("shell.register.joinCodeWhat")}>
              {t("shell.register.joinCodeHint")}
            </Hint>
          </div>
          <Input
            id="joinCode"
            name="joinCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            placeholder={t("shell.register.joinCodePlaceholder")}
            className="uppercase font-mono tracking-widest"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!fe.joinCode || undefined}
          />
          {fe.joinCode ? (
            <p className="mt-1 text-sm text-accent">{t("shell.register.joinCodeError", { error: fe.joinCode })}</p>
          ) : codeLocked ? (
            <p className="mt-1 text-xs text-ok">{t("shell.register.joinCodeOk", { club: joinTenantName ?? "" })}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-3">{t("shell.register.joinCodeLater")}</p>
          )}
        </div>}
        {state && !state.ok ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{translateServerMessage(state.error, t)}</Alert> : null}
        {!online ? <Alert tone="warn">{t("shell.register.offline")}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText={t("shell.register.pending")}>
          {submitLabel ?? (codeLocked ? t("shell.register.submitJoin") : t("shell.register.submit"))}
        </SubmitButton>
      </form>
    </Card>
  );
}
