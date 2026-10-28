"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, CloudOff, Eye, EyeOff, HelpCircle, Monitor, Moon, Plus, Sun } from "lucide-react";
import { switchTenantAction, updateProfileAction } from "@/modules/core/tenant-actions";
import { changePasswordAction, removeAvatarAction, setThemePrefAction, uploadAvatarAction } from "@/modules/core/profile-actions";
import { ImageUploader } from "@/components/image-uploader";
import { TenantLogo } from "@/components/logo";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function TenantSwitcher({ activeId, tenants }: { activeId: string | null; tenants: Array<{ id: string; name: string; role: string; logoUrl?: string | null }> }) {
  const [pending, start] = useTransition();
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {tenants.map((t) => {
        const active = t.id === activeId;
        return (
          <button key={t.id} type="button" disabled={pending || active} onClick={() => start(() => switchTenantAction(t.id))}
            className={cn("flex w-full items-center gap-3 px-4 h-16 text-left transition-colors", active ? "bg-surface-2" : "hover:bg-surface-2")} aria-current={active ? "true" : undefined}>
            <span className="relative">
              <TenantLogo src={t.logoUrl} size={32} />
              {active ? (
                <span className="absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-ink">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{t.name}</span>
              <span className="block text-xs text-ink-3">{t.role}</span>
            </span>
            {pending && !active ? <Spinner /> : null}
          </button>
        );
      })}
      <Link href="/onboarding?force=1" className="flex items-center gap-3 px-4 h-13 text-ink-2 hover:bg-surface-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line"><Plus className="h-3.5 w-3.5" /></span>
        <span className="font-medium">Weiterem Verein beitreten / neu anlegen</span>
      </Link>
      <Link href="/help" className="flex items-center gap-3 px-4 h-13 text-ink-2 hover:bg-surface-2">
        <HelpCircle className="h-5 w-5" aria-hidden /><span className="font-medium">Hilfe & häufige Fragen</span>
      </Link>
      {/* Bewusst ein normaler Link, damit der Service Worker die Offline-Übersicht ausliefern kann. */}
      <a href="/offline" className="flex items-center gap-3 px-4 h-13 text-ink-2 hover:bg-surface-2">
        <CloudOff className="h-5 w-5" aria-hidden /><span className="font-medium">Offline-Modus & ausstehende Daten</span>
      </a>
    </Card>
  );
}

export function ProfileForm({ name, address }: { name: string; address: { street: string | null; zip: string | null; city: string | null } }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label="Anzeigename"><Input name="name" defaultValue={name} required /></Field>
        <Field label="Strasse und Nr." hint="Für Rechnungen (Mitgliederbeitrag, Reservationen)"><Input name="street" defaultValue={address.street ?? ""} autoComplete="street-address" /></Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="PLZ"><Input name="zip" defaultValue={address.zip ?? ""} autoComplete="postal-code" inputMode="numeric" /></Field>
          <Field label="Ort"><Input name="city" defaultValue={address.city ?? ""} autoComplete="address-level2" /></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" pending={pending}>Speichern</SubmitButton>
      </form>
    </Card>
  );
}

export function AvatarCard({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <Card className="animate-rise p-4">
      <ImageUploader kind="avatar" title="Profilbild" name={name} currentUrl={avatarUrl} uploadAction={uploadAvatarAction} removeAction={removeAvatarAction} />
    </Card>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
] as const;

/** Segmentierte Auswahl System / Hell / Dunkel. Wirkt sofort, wird im Profil gespeichert. */
export function ThemePicker({ value }: { value: string }) {
  const [current, setCurrent] = useState(value);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = (next: string) => {
    if (next === current) return;
    const prev = current;
    setCurrent(next);
    setError(null);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    start(async () => {
      const res = await setThemePrefAction(next);
      if (!res.ok) {
        setCurrent(prev);
        if (prev === "system") root.removeAttribute("data-theme");
        else root.setAttribute("data-theme", prev);
        setError(res.error);
      }
    });
  };

  return (
    <Card className="animate-rise p-4">
      <div className="grid grid-cols-3 gap-1 rounded-control bg-surface-2 p-1" role="radiogroup" aria-label="Darstellung">
        {THEME_OPTIONS.map(({ value: v, label, icon: Icon }) => {
          const active = current === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={active} onClick={() => choose(v)}
              className={cn("press flex h-11 items-center justify-center gap-2 rounded-[0.65rem] text-sm font-medium transition-colors", active ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2")}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
        {pending ? <Spinner className="h-3 w-3" /> : null}
        «System» folgt der Einstellung deines Geräts.
      </p>
      {error ? <div className="mt-2"><Alert>{error}</Alert></div> : null}
    </Card>
  );
}

function PasswordInput({ name, autoComplete, error }: { name: string; autoComplete: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={name === "current" ? 1 : 8} className="pr-12" aria-invalid={!!error} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink" aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  // Nach erfolgreichem Ändern Passwortfelder leeren; bei Fehlern bleiben die Eingaben erhalten.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label="Aktuelles Passwort"><PasswordInput name="current" autoComplete="current-password" error={fe.current} /></Field>
        <Field label="Neues Passwort" hint="Mindestens 8 Zeichen"><PasswordInput name="next" autoComplete="new-password" error={fe.next} /></Field>
        <Field label="Neues Passwort bestätigen"><PasswordInput name="confirm" autoComplete="new-password" error={fe.confirm} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" pending={pending} pendingText="Wird geändert…">Passwort ändern</SubmitButton>
        <p className="text-xs text-ink-3">Nach dem Ändern werden alle anderen Geräte abgemeldet.</p>
      </form>
    </Card>
  );
}
