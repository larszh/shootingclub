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

const MIN = 8;

export function PasswordCard({ email }: { email: string }) {
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
        <Field label="Aktuelles Passwort" error={fe.current}>
          <PasswordInput name="current" autoComplete="current-password" required aria-invalid={!!fe.current || undefined} />
        </Field>
        <Field label="Neues Passwort" error={fe.next} hint={`Mindestens ${MIN} Zeichen`}>
          <PasswordInput name="next" autoComplete="new-password" required minLength={MIN} aria-invalid={!!fe.next || undefined} />
        </Field>
        <Field label="Neues Passwort wiederholen" error={fe.confirm}>
          <PasswordInput name="confirm" autoComplete="new-password" required minLength={MIN} aria-invalid={!!fe.confirm || undefined} />
        </Field>
        {state && !state.ok && !Object.keys(fe).length ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} pendingText="Speichern…">Passwort ändern</SubmitButton>
        <p className="text-xs text-ink-3">Andere Geräte werden danach abgemeldet. Du bekommst zur Sicherheit eine Mail.</p>
      </form>
    </Card>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join("\n");
  function download() {
    const blob = new Blob([`Standchef – Wiederherstellungscodes\nJeder Code funktioniert nur einmal.\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "standchef-wiederherstellungscodes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-3">
      <Alert tone="warn" title="Jetzt sichern – sie werden nur einmal angezeigt">
        Mit diesen Codes kommst du ins Konto, falls du das Handy verlierst. Jeder Code funktioniert einmal. Am besten ausdrucken oder im Passwort-Manager speichern.
      </Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-control bg-surface-2 p-3 font-mono text-[15px] tracking-wider" aria-label="Wiederherstellungscodes">
        {codes.map((c) => <li key={c} className="text-center">{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="Kopieren" copiedMessage="Codes kopiert" className="h-11" />
        <Button type="button" variant="secondary" onClick={download}><Download className="h-4 w-4" aria-hidden /> Als Datei</Button>
        <Button type="button" onClick={onDone}>Gesichert, fertig</Button>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  return enabled ? <TwoFactorEnabled recoveryLeft={recoveryLeft} /> : <TwoFactorSetup />;
}

function TwoFactorSetup() {
  const router = useRouter();
  const [enroll, setEnroll] = useState<EnrollmentData | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (codes) {
    return (
      <Card className="animate-rise p-4">
        <p className="mb-3 font-semibold text-ok">Zwei-Faktor-Anmeldung ist aktiv.</p>
        <RecoveryCodes codes={codes} onDone={() => { setCodes(null); router.refresh(); }} />
      </Card>
    );
  }

  if (!enroll) {
    return (
      <Card className="animate-rise p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" aria-hidden />
          <p className="text-sm text-ink-2">
            Beim Anmelden gibst du zusätzlich einen 6-stelligen Code aus einer Authenticator-App ein (z.B. Google Authenticator, Microsoft Authenticator, 1Password).
            So kommt niemand ins Konto, selbst wenn das Passwort bekannt wird. Empfohlen für Vorstand und Kassier.
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
          {pending ? <Spinner /> : null} Einrichten
        </Button>
      </Card>
    );
  }

  return (
    <Card className="animate-rise p-4">
      <ol className="space-y-4 text-sm">
        <li>
          <p className="font-medium">1. QR-Code mit der Authenticator-App scannen</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL, kein optimierbares Bild */}
          <img src={enroll.qrDataUrl} alt="QR-Code für die Authenticator-App" width={200} height={200} className="mx-auto mt-2 rounded-lg border border-line bg-white p-2" />
          <details className="mt-2">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-ink-2 underline underline-offset-4">Scannen geht nicht? Schlüssel von Hand eingeben</summary>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-control bg-surface-2 px-3 py-2 font-mono text-[13px] tracking-wider">{enroll.secret}</code>
              <CopyButton text={enroll.secret.replace(/\s/g, "")} iconOnly label="Schlüssel kopieren" copiedMessage="Schlüssel kopiert" />
            </div>
            <p className="mt-1 text-xs text-ink-3">Konto: Standchef · zeitbasiert · 6 Ziffern</p>
          </details>
        </li>
        <li>
          <p className="mb-2 font-medium">2. Angezeigten Code eingeben</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                setError(null);
                const res = await confirmTwoFactorAction(enroll.ticket, code);
                if (res.ok && res.data) {
                  setCodes(res.data.codes);
                  toast.success("Zwei-Faktor-Anmeldung aktiviert");
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
              aria-label="Code aus der App"
              className="flex-1 text-center font-mono text-xl tracking-[0.3em]"
              required
            />
            <Button type="submit" disabled={pending || code.replace(/\s/g, "").length !== 6}>{pending ? <Spinner /> : null} Bestätigen</Button>
          </form>
        </li>
      </ol>
      {error ? <Alert className="mt-3" icon={<AlertCircle className="h-4 w-4" />}>{error}</Alert> : null}
      <Button type="button" variant="ghost" className="mt-2" onClick={() => { setEnroll(null); setCode(""); setError(null); }}>Abbrechen</Button>
    </Card>
  );
}

function TwoFactorEnabled({ recoveryLeft }: { recoveryLeft: number }) {
  const router = useRouter();
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
        <p className="mb-3 font-semibold">Neue Wiederherstellungscodes</p>
        <RecoveryCodes codes={codes} onDone={() => { setCodes(null); router.refresh(); }} />
      </Card>
    );
  }

  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <KeyRound className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Wiederherstellungscodes</p>
          <p className="text-sm text-ink-3">
            {recoveryLeft} von 8 übrig{recoveryLeft <= 2 ? " – bitte neue erzeugen." : "."}
          </p>
        </div>
        {recoveryLeft <= 2 ? <Badge tone="warn">Wenige</Badge> : null}
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
            <p className="text-sm text-ink-2">Bestätige mit dem aktuellen Code aus der App. Die alten Codes werden ungültig.</p>
            <div className="flex gap-2">
              <Input value={regenCode} onChange={(e) => setRegenCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Code aus der App" className="flex-1 text-center font-mono tracking-[0.3em]" />
              <Button type="submit" disabled={pending}>{pending ? <Spinner /> : null} Erzeugen</Button>
            </div>
            {error ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{error}</Alert> : null}
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setShowRegen(true)}>Neue Codes erzeugen</Button>
        )}
      </div>
      <div className="p-4">
        {showDisable ? (
          <form onSubmit={submitKeepingValues(disableAction)} className="space-y-3">
            <p className="text-sm text-ink-2">Zum Ausschalten brauchst du dein Passwort und einen Code aus der App (oder einen Wiederherstellungscode).</p>
            <Field label="Passwort" error={fe.password}>
              <PasswordInput name="password" autoComplete="current-password" required aria-invalid={!!fe.password || undefined} />
            </Field>
            <Field label="Code" error={fe.code}>
              <Input name="code" autoComplete="one-time-code" required placeholder="123456" aria-invalid={!!fe.code || undefined} />
            </Field>
            {state && !state.ok && !Object.keys(fe).length ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <SubmitButton variant="danger" pending={disabling} pendingText="Ausschalten…">Ausschalten</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setShowDisable(false)}>Abbrechen</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="ghost" className="text-danger" onClick={() => setShowDisable(true)}>Zwei-Faktor-Anmeldung ausschalten</Button>
        )}
      </div>
    </Card>
  );
}

export function SessionsCard({ sessions }: { sessions: Array<{ id: string; current: boolean; since: string; until: string }> }) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.current).length;

  function terminate(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await terminateSessionAction(id);
      if (res.ok) toast.success(res.message ?? "Abgemeldet");
      else toast.error(res.error);
      setBusyId(null);
    });
  }

  async function terminateAll() {
    const okay = await confirmDialog({ title: "Alle anderen Geräte abmelden?", message: "Du bleibst auf diesem Gerät angemeldet.", confirmLabel: "Abmelden", tone: "danger" });
    if (!okay) return;
    start(async () => {
      const res = await terminateOtherSessionsAction();
      if (res.ok) toast.success(res.message ?? "Abgemeldet");
      else toast.error(res.error);
    });
  }

  return (
    <>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {sessions.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <Smartphone className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {s.current ? "Dieses Gerät" : `Anderes Gerät ${i + 1}`}
                {s.current ? <Badge tone="ok">Aktuell</Badge> : null}
              </p>
              <p className="text-xs text-ink-3">Angemeldet seit {s.since} · gültig bis {s.until}</p>
            </div>
            {!s.current ? (
              <Button type="button" variant="secondary" size="sm" className="h-11" disabled={pending} onClick={() => terminate(s.id)} aria-label="Dieses Gerät abmelden">
                {busyId === s.id ? <Spinner /> : <LogOut className="h-4 w-4" aria-hidden />} Abmelden
              </Button>
            ) : null}
          </div>
        ))}
      </Card>
      {others > 0 ? (
        <Button type="button" variant="secondary" className="mt-2.5" disabled={pending} onClick={terminateAll}>
          Alle anderen Geräte abmelden
        </Button>
      ) : (
        <p className="mt-2 text-xs text-ink-3">Nur dieses Gerät ist angemeldet.</p>
      )}
    </>
  );
}
