"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, KeyRound, LogOut, Smartphone } from "lucide-react";
import {
  changePasswordSecureAction,
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  startTwoFactorAction,
  terminateOtherSessionsAction,
  terminateSessionAction,
  type EnrollmentData,
} from "./actions";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { CopyButton, PasswordInput } from "@/components/ui/controls";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import { useT } from "@/components/locale";

const MIN = 8;

export function PasswordCard({ email }: { email: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(changePasswordSecureAction, null);
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState<typeof state>(null);
  // Nach Erfolg Formular leeren (neuer key), ohne setState in einem Effekt.
  if (state?.ok && state !== lastOk) {
    setLastOk(state);
    setFormKey((k) => k + 1);
  }
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <Card className="animate-rise p-4">
      <form key={formKey} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <Field label={t("shell.security.currentPassword")} error={fe.current}>
          <PasswordInput name="current" autoComplete="current-password" required aria-invalid={!!fe.current || undefined} />
        </Field>
        <Field label={t("shell.password.new")} error={fe.next} hint={t("shell.password.min", { count: MIN })}>
          <PasswordInput name="next" autoComplete="new-password" required minLength={MIN} aria-invalid={!!fe.next || undefined} />
        </Field>
        <Field label={t("shell.security.repeatNew")} error={fe.confirm}>
          <PasswordInput name="confirm" autoComplete="new-password" required minLength={MIN} aria-invalid={!!fe.confirm || undefined} />
        </Field>
        {state && !state.ok && !Object.keys(fe).length ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} pendingText={t("shell.image.saving")}>{t("shell.security.changePassword")}</SubmitButton>
        <p className="text-xs text-ink-3">{t("shell.security.changeHint")}</p>
      </form>
    </Card>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useT();
  const text = codes.join("\n");
  function download() {
    const blob = new Blob([`${t("shell.security.codesFileTitle")}\n${t("shell.security.codesFileOnce")}\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("shell.security.codesFileName")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-3">
      <Alert tone="warn" title={t("shell.security.codesSaveTitle")}>
        {t("shell.security.codesSaveText")}
      </Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-control bg-surface-2 p-3 font-mono text-[15px] tracking-wider" aria-label={t("shell.security.recoveryCodes")}>
        {codes.map((c) => <li key={c} className="text-center">{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label={t("shell.ui.copy")} copiedMessage={t("shell.security.codesCopied")} className="h-11" />
        <Button type="button" variant="secondary" onClick={download}><Download className="h-4 w-4" aria-hidden /> {t("shell.security.asFile")}</Button>
        <Button type="button" onClick={onDone}>{t("shell.security.savedDone")}</Button>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const router = useRouter();
  const t = useT();
  // Neue Codes oberhalb des Umschalters halten: Ein Neuladen der Seite (enabled wird true)
  // darf sie nicht verwerfen, bevor sie gesichert wurden.
  const [codes, setCodes] = useState<string[] | null>(null);
  const [, startDone] = useTransition();
  if (codes) {
    return (
      <Card className="animate-rise p-4">
        <p className="mb-3 font-semibold text-ok">{t("shell.security.twofaActive")}</p>
        {/* Neu laden und Codes ausblenden in einem Übergang, damit nicht kurz das Einrichten-Formular erscheint. */}
        <RecoveryCodes codes={codes} onDone={() => startDone(() => { router.refresh(); setCodes(null); })} />
      </Card>
    );
  }
  return enabled ? <TwoFactorEnabled recoveryLeft={recoveryLeft} /> : <TwoFactorSetup onEnabled={setCodes} />;
}

function TwoFactorSetup({ onEnabled }: { onEnabled: (codes: string[]) => void }) {
  const t = useT();
  const [enroll, setEnroll] = useState<EnrollmentData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!enroll) {
    return (
      <Card className="animate-rise p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
          <p className="text-sm text-ink-2">
            {t("shell.security.setupIntro")}
          </p>
        </div>
        {error ? <Alert className="mt-3" icon={<AlertCircle className="h-4 w-4" />}>{error}</Alert> : null}
        <Button
          type="button"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await startTwoFactorAction();
              if (res.ok && res.data) setEnroll(res.data);
              else if (!res.ok) setError(res.error);
            })
          }
        >
          {pending ? <Spinner /> : null} {t("shell.security.setup")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="animate-rise p-4">
      <ol className="space-y-4 text-sm">
        <li>
          <p className="font-medium">{t("shell.security.step1")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL, kein optimierbares Bild */}
          <img src={enroll.qrDataUrl} alt={t("shell.security.qrAlt")} width={200} height={200} className="mx-auto mt-2 rounded-lg border border-line bg-white p-2" />
          <details className="mt-2">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-ink-2 underline underline-offset-4">{t("shell.security.manualKey")}</summary>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-control bg-surface-2 px-3 py-2 font-mono text-[13px] tracking-wider">{enroll.secret}</code>
              <CopyButton text={enroll.secret.replace(/\s/g, "")} iconOnly label={t("shell.security.copyKey")} copiedMessage={t("shell.security.keyCopied")} />
            </div>
            <p className="mt-1 text-xs text-ink-3">{t("shell.security.keyInfo")}</p>
          </details>
        </li>
        <li>
          <p className="mb-2 font-medium">{t("shell.security.step2")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                setError(null);
                const res = await confirmTwoFactorAction(enroll.ticket, code);
                if (res.ok && res.data) {
                  onEnabled(res.data.codes);
                  toast.success(t("shell.security.enabledToast"));
                } else if (!res.ok) setError(res.error);
              });
            }}
            className="flex gap-2"
          >
            <Input
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              aria-label={t("shell.twofa.appCode")}
              className="flex-1 text-center font-mono text-xl tracking-[0.3em]"
              required
            />
            <Button type="submit" disabled={pending || code.replace(/\s/g, "").length !== 6}>{pending ? <Spinner /> : null} {t("shell.ui.confirm")}</Button>
          </form>
        </li>
      </ol>
      {error ? <Alert className="mt-3" icon={<AlertCircle className="h-4 w-4" />}>{error}</Alert> : null}
      <Button type="button" variant="ghost" className="mt-2" onClick={() => { setEnroll(null); setCode(""); setError(null); }}>{t("shell.common.cancel")}</Button>
    </Card>
  );
}

function TwoFactorEnabled({ recoveryLeft }: { recoveryLeft: number }) {
  const router = useRouter();
  const t = useT();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [regenCode, setRegenCode] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, disableAction, disabling] = useActionState(disableTwoFactorAction, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (codes) {
    return (
      <Card className="animate-rise p-4">
        <p className="mb-3 font-semibold">{t("shell.security.newCodes")}</p>
        <RecoveryCodes codes={codes} onDone={() => { setCodes(null); router.refresh(); }} />
      </Card>
    );
  }

  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <KeyRound className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("shell.security.recoveryCodes")}</p>
          <p className="text-sm text-ink-3">
            {recoveryLeft <= 2 ? t("shell.security.codesLeftLow", { count: recoveryLeft, total: 8 }) : t("shell.security.codesLeft", { count: recoveryLeft, total: 8 })}
          </p>
        </div>
        {recoveryLeft <= 2 ? <Badge tone="warn">{t("shell.security.few")}</Badge> : null}
      </div>
      <div className="p-4">
        {showRegen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                setError(null);
                const res = await regenerateRecoveryCodesAction(regenCode);
                if (res.ok && res.data) { setCodes(res.data.codes); setRegenCode(""); setShowRegen(false); }
                else if (!res.ok) setError(res.error);
              });
            }}
            className="space-y-2"
          >
            <p className="text-sm text-ink-2">{t("shell.security.regenHint")}</p>
            <div className="flex gap-2">
              <Input value={regenCode} onChange={(e) => setRegenCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label={t("shell.twofa.appCode")} className="flex-1 text-center font-mono tracking-[0.3em]" />
              <Button type="submit" disabled={pending}>{pending ? <Spinner /> : null} {t("shell.security.generate")}</Button>
            </div>
            {error ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{error}</Alert> : null}
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setShowRegen(true)}>{t("shell.security.generateNew")}</Button>
        )}
      </div>
      <div className="p-4">
        {showDisable ? (
          <form onSubmit={submitKeepingValues(disableAction)} className="space-y-3">
            <p className="text-sm text-ink-2">{t("shell.security.disableHint")}</p>
            <Field label={t("shell.common.password")} error={fe.password}>
              <PasswordInput name="password" autoComplete="current-password" required aria-invalid={!!fe.password || undefined} />
            </Field>
            <Field label={t("shell.security.code")} error={fe.code}>
              <Input name="code" autoComplete="one-time-code" required placeholder="123456" aria-invalid={!!fe.code || undefined} />
            </Field>
            {state && !state.ok && !Object.keys(fe).length ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <SubmitButton variant="danger" pending={disabling} pendingText={t("shell.security.disabling")}>{t("shell.security.disable")}</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setShowDisable(false)}>{t("shell.common.cancel")}</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="ghost" className="text-danger" onClick={() => setShowDisable(true)}>{t("shell.security.disableTwofa")}</Button>
        )}
      </div>
    </Card>
  );
}

type SessionRow = { id: string; current: boolean; since: string; until: string; device: string | null; ip: string | null };

export function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;
  // Bezeichnung aus Browser und System (beim Anmelden festgehalten); ohne Angabe «Anderes Gerät».
  // Keine laufenden Nummern: Sie verschieben sich, sobald sich ein Gerät abmeldet.
  const label = (s: SessionRow) => s.device ?? (s.current ? t("shell.security.thisDevice") : t("shell.security.otherDevice"));

  function terminate(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await terminateSessionAction(id);
      if (res.ok) toast.success(res.message ?? t("shell.security.loggedOut"));
      else toast.error(res.error);
      setBusyId(null);
    });
  }

  async function terminateAll() {
    const okay = await confirmDialog({ title: t("shell.security.logoutAllConfirm"), message: t("shell.security.logoutAllText"), confirmLabel: t("shell.me.logout"), tone: "danger" });
    if (!okay) return;
    start(async () => {
      const res = await terminateOtherSessionsAction();
      if (res.ok) toast.success(res.message ?? t("shell.security.loggedOut"));
      else toast.error(res.error);
    });
  }

  return (
    <>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <Smartphone className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{label(s)}</span>
                {s.current ? <Badge tone="ok">{s.device ? t("shell.security.thisDevice") : t("shell.security.current")}</Badge> : null}
              </p>
              <p className="text-xs text-ink-3">{t("shell.security.since", { date: s.since })}{s.ip ? ` · IP ${s.ip}` : ""} · {t("shell.security.until", { date: s.until })}</p>
            </div>
            {!s.current ? (
              <Button type="button" variant="secondary" size="sm" className="h-11" disabled={pending} onClick={() => terminate(s.id)} aria-label={t("shell.security.logoutDeviceAria", { device: label(s), date: s.since })}>
                {busyId === s.id ? <Spinner /> : <LogOut className="h-4 w-4" aria-hidden />} {t("shell.me.logout")}
              </Button>
            ) : null}
          </div>
        ))}
      </Card>
      {others > 0 ? (
        <Button type="button" variant="secondary" className="mt-2.5" disabled={pending} onClick={terminateAll}>
          {t("shell.security.logoutAll")}
        </Button>
      ) : (
        <p className="mt-2 text-xs text-ink-3">{t("shell.security.onlyThis")}</p>
      )}
    </>
  );
}
