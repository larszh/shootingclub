"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, Check, Copy, Crosshair, Home, Megaphone, RefreshCw, RotateCcw, Target } from "lucide-react";
import { regenerateJoinCodeAction, setModuleEnabledAction, updateTenantAction } from "@/modules/core/tenant-actions";
import { removeTenantLogoAction, resetBrandColorsAction, updateBrandColorsAction, uploadTenantLogoAction } from "@/modules/core/branding-actions";
import { BRAND_PRESETS, DEFAULT_ACCENT, brandColors, contrastReport, normalizeHex, type BrandMode } from "@/lib/brand";
import { ImageUploader } from "@/components/image-uploader";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Spinner, SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function JoinCodeCard({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const copy = async () => {
    const text = link.startsWith("http") ? link : `${window.location.origin}${link}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-ink-3">Beitrittscode</div>
          <div className="font-mono text-2xl tracking-[0.3em] font-semibold">{code}</div>
        </div>
        <button type="button" onClick={copy} className="press h-10 px-3 rounded-control border border-line inline-flex items-center gap-2 text-sm font-medium">{copied ? <><Check className="h-4 w-4 text-ok" /> Kopiert</> : <><Copy className="h-4 w-4" /> Link</>}</button>
        <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: "Neuen Code erzeugen? Der alte wird ungültig.", tone: "danger" }))) start(() => regenerateJoinCodeAction().then(() => undefined)); }} className="press h-10 w-10 rounded-control border border-line inline-flex items-center justify-center text-ink-3" aria-label="Neuer Code"><RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} /></button>
      </div>
      <p className="mt-2 text-xs text-ink-3">Mitglieder geben den Code bei der Registrierung oder unter «Mehr» ein.</p>
    </Card>
  );
}

export function ModuleToggle({ moduleKey, name, description, enabled, planned }: { moduleKey: string; name: string; description: string; enabled: boolean; planned: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium flex items-center gap-2">{name}{planned ? <Badge tone="outline">bald</Badge> : null}</div>
        <div className="text-xs text-ink-3">{description}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={pending} onClick={() => { const next = !on; setOn(next); start(() => setModuleEnabledAction(moduleKey, next).then(() => undefined)); }}
        className={cn("relative h-7 w-12 rounded-full transition-colors", on ? "bg-ink" : "bg-line")}>
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function TenantSettingsForm({ tenant }: { tenant: { name: string; kind: string; city: string | null; canton: string | null; description: string | null; website: string | null } }) {
  const [state, action] = useActionState(updateTenantAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <Field label="Name"><Input name="name" defaultValue={tenant.name} required /></Field>
        <Field label="Art">
          <Select name="kind" defaultValue={tenant.kind}>
            <option value="CLUB">Verein</option>
            <option value="RANGE">Schiessanlage / Indoor-Stand</option>
            <option value="PRIVATE">Privat / Gruppe</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ort" className="col-span-2"><Input name="city" defaultValue={tenant.city ?? ""} /></Field>
          <Field label="Kanton"><Input name="canton" defaultValue={tenant.canton ?? ""} maxLength={2} className="uppercase" /></Field>
        </div>
        <Field label="Kurzbeschreibung" hint="Erscheint im Mitgliederverzeichnis, z.B. Gründungsjahr, Schiessstand, Trainingszeiten." error={state && !state.ok ? state.fieldErrors?.description : undefined}>
          <Textarea name="description" defaultValue={tenant.description ?? ""} maxLength={2000} rows={3} />
        </Field>
        <Field label="Webseite" hint="z.B. www.sv-beispiel.ch" error={state && !state.ok ? state.fieldErrors?.website : undefined}>
          <Input name="website" defaultValue={tenant.website ?? ""} inputMode="url" autoComplete="url" placeholder="www.verein.ch" />
        </Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Speichern</SubmitButton>
      </form>
    </Card>
  );
}

// --- Erscheinungsbild ------------------------------------------------------

const LIGHT_BASE = { bg: "#f4f2ee", surface: "#ffffff", "surface-2": "#ebe8e2", ink: "#151515", "ink-2": "#4a4a48", "ink-3": "#8a8884", line: "#e1ddd5" };
const DARK_BASE = { bg: "#111110", surface: "#1b1b1a", "surface-2": "#262625", ink: "#f3f1ec", "ink-2": "#c4c1ba", "ink-3": "#85827b", line: "#2e2d2b" };
const DEFAULT_LIGHT: BrandMode = { accent: "#d6232d", accentInk: "#ffffff", accentSoft: "#fbe4e5", accent2: "#d6232d", accent2Ink: "#ffffff" };
const DEFAULT_DARK: BrandMode = { accent: "#ef3b45", accentInk: "#ffffff", accentSoft: "#3a1b1d", accent2: "#ef3b45", accent2Ink: "#ffffff" };

/** Setzt Basis- und Tailwind-Variablen lokal, damit die Vorschau unabhängig vom aktuellen Theme ist. */
function previewStyle(mode: "light" | "dark", brand: BrandMode): React.CSSProperties {
  const base = mode === "light" ? LIGHT_BASE : DARK_BASE;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) { vars[`--${k}`] = v; vars[`--color-${k}`] = v; }
  const accent = { accent: brand.accent, "accent-ink": brand.accentInk, "accent-soft": brand.accentSoft, "accent-2": brand.accent2, "accent-2-ink": brand.accent2Ink };
  for (const [k, v] of Object.entries(accent)) { vars[`--${k}`] = v; vars[`--color-${k}`] = v; }
  return { ...vars, colorScheme: mode } as React.CSSProperties;
}

function BrandPreview({ mode, brand, tenantName, logoUrl }: { mode: "light" | "dark"; brand: BrandMode; tenantName: string; logoUrl: string | null }) {
  return (
    <div style={previewStyle(mode, brand)} className="rounded-control border border-line bg-bg p-3 text-ink">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
        ) : null}
        <span className="truncate">{mode === "light" ? "Hell" : "Dunkel"} · {tenantName}</span>
      </div>
      <div className="rounded-xl border border-line bg-surface p-3 space-y-3">
        <div className="h-1.5 rounded-full brand-gradient" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-control bg-accent px-3 text-sm font-medium text-accent-ink">Anmelden</span>
          <span className="inline-flex h-9 items-center rounded-control border border-line bg-surface px-3 text-sm font-medium">Später</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">Neu</span>
          <span className="inline-flex items-center rounded-full bg-accent-2 px-2.5 py-0.5 text-xs font-medium text-accent-2-ink">Zweitfarbe</span>
          <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">Mitglied</span>
        </div>
        <div className="grid grid-cols-4 rounded-xl border border-line bg-surface pt-1.5 pb-1">
          {[{ i: Home, l: "Start" }, { i: Crosshair, l: "Schiessen", a: true }, { i: Target, l: "Scheiben" }, { i: Megaphone, l: "Anlässe" }].map(({ i: Icon, l, a }) => (
            <span key={l} className="flex flex-col items-center gap-0.5 text-[10px] font-medium">
              <span className={cn("flex h-7 w-11 items-center justify-center rounded-full", a ? "bg-accent text-accent-ink" : "text-ink-3")}><Icon className="h-4 w-4" /></span>
              <span className={a ? "text-ink" : "text-ink-3"}>{l}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange, name, error }: { label: string; value: string; onChange: (v: string) => void; name: string; error?: string }) {
  const valid = normalizeHex(value);
  return (
    <Field label={label} error={error ?? (value && !valid ? "Format #RRGGBB, z.B. #1d64c8" : undefined)}>
      <div className="flex items-center gap-2">
        <label className="relative h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-control border border-line" style={{ background: valid ?? "transparent" }}>
          <span className="sr-only">Farbe wählen</span>
          <input type="color" value={valid ?? "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <Input name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#d6232d" maxLength={7} spellCheck={false} autoCapitalize="off" className="font-mono uppercase" />
      </div>
    </Field>
  );
}

export function BrandingForm({ tenantName, logoUrl, brandColor, brandColor2 }: { tenantName: string; logoUrl: string | null; brandColor: string | null; brandColor2: string | null }) {
  const [state, action] = useActionState(updateBrandColorsAction, null);
  const [color, setColor] = useState(brandColor ?? DEFAULT_ACCENT);
  const [useSecond, setUseSecond] = useState(!!brandColor2);
  const [color2, setColor2] = useState(brandColor2 ?? "#1b2f5e");
  const [resetting, startReset] = useTransition();
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const c1 = normalizeHex(color);
  const c2 = useSecond ? normalizeHex(color2) : null;
  const vars = c1 ? brandColors(c1, c2) : null;
  const light = vars?.light ?? DEFAULT_LIGHT;
  const dark = vars?.dark ?? DEFAULT_DARK;
  const report = c1 ? contrastReport(c1) : null;
  const report2 = c2 ? contrastReport(c2) : null;
  const isCustom = !!brandColor;

  const reset = async () => {
    if (!(await confirmDialog({ title: "Farben auf das Standard-Design zurücksetzen?", tone: "danger" }))) return;
    startReset(async () => {
      const res = await resetBrandColorsAction();
      if (res.ok) {
        setColor(DEFAULT_ACCENT);
        setUseSecond(false);
        setResetMsg(res.message ?? null);
      }
    });
  };

  return (
    <div className="space-y-2.5">
      <Card className="animate-rise p-4">
        <ImageUploader
          kind="logo"
          title="Vereinslogo"
          name={tenantName}
          currentUrl={logoUrl}
          uploadAction={uploadTenantLogoAction}
          removeAction={removeTenantLogoAction}
          hint="Erscheint in der Navigation, im Vereinswechsel und im Mitgliederverzeichnis."
        />
      </Card>

      <Card className="animate-rise p-4">
        <form action={action} className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-ink-2">Akzentfarbe</div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12" role="radiogroup" aria-label="Vorlagen">
              {BRAND_PRESETS.map((p) => {
                const active = c1 === p.hex;
                return (
                  <button key={p.hex} type="button" role="radio" aria-checked={active} aria-label={p.name} title={p.name} onClick={() => setColor(p.hex)}
                    className={cn("press relative aspect-square w-full min-h-11 rounded-full border-2 transition-transform", active ? "border-ink scale-105" : "border-transparent")}
                    style={{ background: p.hex }}>
                    {active ? <Check className="absolute inset-0 m-auto h-4 w-4" style={{ color: contrastReport(p.hex)?.textColor }} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <ColorPicker label="Eigene Farbe" name="brandColor" value={color} onChange={setColor} error={state && !state.ok ? state.fieldErrors?.brandColor : undefined} />

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={useSecond} onChange={(e) => setUseSecond(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            <span className="text-sm font-medium">Zweitfarbe verwenden <span className="font-normal text-ink-3">(für Verläufe und Hervorhebungen)</span></span>
          </label>
          {useSecond ? (
            <ColorPicker label="Zweitfarbe" name="brandColor2" value={color2} onChange={setColor2} error={state && !state.ok ? state.fieldErrors?.brandColor2 : undefined} />
          ) : (
            <input type="hidden" name="brandColor2" value="" />
          )}

          <div>
            <div className="mb-2 text-sm font-medium text-ink-2">Vorschau</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <BrandPreview mode="light" brand={light} tenantName={tenantName} logoUrl={logoUrl} />
              <BrandPreview mode="dark" brand={dark} tenantName={tenantName} logoUrl={logoUrl} />
            </div>
          </div>

          {report?.lowTextContrast ? (
            <div className="flex gap-2 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Schrift auf dieser Farbe ist schlecht lesbar (Kontrast {report.textOnAccent.toFixed(1)}:1, empfohlen mindestens 4.5:1). Wähle eine dunklere oder kräftigere Farbe.</span>
            </div>
          ) : null}
          {report && !report.lowTextContrast && (report.adjustedLight || report.adjustedDark) ? (
            <p className="text-xs text-ink-3">Hinweis: Für gute Lesbarkeit wird die Farbe im {report.adjustedLight && report.adjustedDark ? "hellen und dunklen" : report.adjustedLight ? "hellen" : "dunklen"} Modus leicht angepasst.</p>
          ) : null}
          {report2?.lowTextContrast ? (
            <p className="text-xs text-warn">Auch die Zweitfarbe hat wenig Kontrast zur Schrift ({report2.textOnAccent.toFixed(1)}:1).</p>
          ) : null}

          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : resetMsg ? <Alert tone="ok">{resetMsg}</Alert> : null}

          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm">Farben speichern</SubmitButton>
            {isCustom ? (
              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={resetting}>
                {resetting ? <Spinner /> : <RotateCcw className="h-4 w-4" />} Standard
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
