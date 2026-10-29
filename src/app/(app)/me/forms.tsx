"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, CloudOff, HelpCircle, Monitor, Moon, Plus, Sun } from "lucide-react";
import { switchTenantAction } from "@/modules/core/tenant-actions";
import { removeAvatarAction, setThemePrefAction, updateProfileAction, uploadAvatarAction } from "@/modules/core/profile-actions";
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

export type ProfileValues = { name: string; phone: string | null; birthDate: string | null; street: string | null; zip: string | null; city: string | null };

export function ProfileForm({ profile, today }: { profile: ProfileValues; today: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label="Anzeigename" error={fe.name}><Input name="name" defaultValue={profile.name} required autoComplete="name" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon" hint="Sieht nur der Vorstand" error={fe.phone}><Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" inputMode="tel" placeholder="079 123 45 67" /></Field>
          <Field label="Geburtsdatum" hint="Für Alterskategorien (z.B. U21, Veteranen)" error={fe.birthDate}><Input name="birthDate" type="date" defaultValue={profile.birthDate ?? ""} max={today} min="1900-01-01" autoComplete="bday" /></Field>
        </div>
        <Field label="Strasse und Nr." hint="Für Rechnungen (Mitgliederbeitrag, Reservationen)" error={fe.street}><Input name="street" defaultValue={profile.street ?? ""} autoComplete="street-address" /></Field>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="PLZ" error={fe.zip}><Input name="zip" defaultValue={profile.zip ?? ""} autoComplete="postal-code" inputMode="numeric" /></Field>
          <Field label="Ort" error={fe.city}><Input name="city" defaultValue={profile.city ?? ""} autoComplete="address-level2" /></Field>
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
