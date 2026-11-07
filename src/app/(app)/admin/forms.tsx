"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, Check, Copy, Crosshair, Home, Megaphone, RefreshCw, RotateCcw, Target } from "lucide-react";
import { regenerateJoinCodeAction, setModuleEnabledAction, updateTenantAction } from "@/modules/core/tenant-actions";
import { removeTenantLogoAction, resetBrandColorsAction, updateBrandColorsAction, uploadTenantLogoAction } from "@/modules/core/branding-actions";
import { BRAND_PRESETS, DEFAULT_ACCENT, brandColors, contrastRatio, contrastReport, normalizeHex, type BrandMode } from "@/lib/brand";
import { ImageUploader } from "@/components/image-uploader";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Spinner, SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { Switch } from "@/components/ui/controls";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/locales";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";

/** Zwischenablage mit Fallback (http, fehlende Berechtigung). */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function JoinCodeCard({ locale, code, link }: { locale: Locale; code: string; link: string }) {
  const t = getT(locale);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const copy = async () => {
    const text = link.startsWith("http") ? link : `${window.location.origin}${link}`;
    if (!(await writeClipboard(text))) {
      toast.error(t("adm1.join.copyFailed"), { description: t("adm1.join.copyFailedHint") });
      return;
    }
    setCopied(true);
    toast.success(t("adm1.join.copied"));
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-ink-3">{t("adm1.join.code")}</div>
          <div className="font-mono text-2xl tracking-[0.3em] font-semibold">{code}</div>
        </div>
        <button type="button" onClick={copy} className="press h-11 shrink-0 px-3 rounded-control border border-line inline-flex items-center gap-2 text-sm font-medium">{copied ? <><Check className="h-4 w-4 text-ok" /> {t("adm1.join.copiedShort")}</> : <><Copy className="h-4 w-4" /> {t("adm1.join.link")}</>}</button>
        <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: t("adm1.join.regenTitle"), message: t("adm1.join.regenMessage"), tone: "danger", confirmLabel: t("adm1.join.regenConfirm") }))) start(() => regenerateJoinCodeAction().then(() => undefined)); }} className="press h-11 w-11 shrink-0 rounded-control border border-line inline-flex items-center justify-center text-ink-3" aria-label={t("adm1.join.newCode")}><RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} /></button>
      </div>
      <p className="mt-2 text-xs text-ink-3">{t("adm1.join.hint")}</p>
    </Card>
  );
}

export function ModuleToggle({ locale, moduleKey, name, description, enabled, planned }: { locale: Locale; moduleKey: string; name: string; description: string; enabled: boolean; planned: boolean }) {
  const t = getT(locale);
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const toggle = (next: boolean) => {
    setOn(next);
    start(async () => {
      let ok = false;
      let error = t("adm1.common.tryAgain");
      try {
        const res = await setModuleEnabledAction(moduleKey, next);
        ok = res.ok;
        if (!res.ok) error = res.error;
      } catch {
        // Netzwerk- oder Berechtigungsfehler
      }
      if (!ok) {
        setOn(!next);
        toast.error(t(next ? "adm1.module.enableFailed" : "adm1.module.disableFailed", { name }), { description: error });
      }
    });
  };
  return (
    <Switch
      className="px-4 py-3"
      checked={on}
      onChange={toggle}
      disabled={pending}
      label={<span className="flex items-center gap-2">{name}{planned ? <Badge tone="outline">{t("adm1.module.soon")}</Badge> : null}</span>}
      description={<span className="text-xs">{description}</span>}
    />
  );
}

export function TenantSettingsForm({ locale, tenant }: { locale: Locale; tenant: { name: string; kind: string; city: string | null; canton: string | null; description: string | null; website: string | null; defaultLocale: string; replyToEmail: string | null } }) {
  const t = getT(locale);
  const [state, action, pending] = useActionState(updateTenantAction, null);
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label={t("adm1.tenant.name")}><Input name="name" defaultValue={tenant.name} required /></Field>
        <Field label={t("adm1.tenant.kind")}>
          <Select name="kind" defaultValue={tenant.kind}>
            <option value="CLUB">{t("adm1.tenant.kind.CLUB")}</option>
            <option value="RANGE">{t("adm1.tenant.kind.RANGE")}</option>
            <option value="PRIVATE">{t("adm1.tenant.kind.PRIVATE")}</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("adm1.tenant.city")} className="col-span-2"><Input name="city" defaultValue={tenant.city ?? ""} /></Field>
          <Field label={t("adm1.tenant.canton")}><Input name="canton" defaultValue={tenant.canton ?? ""} maxLength={2} className="uppercase" /></Field>
        </div>
        <Field label={t("adm1.tenant.description")} hint={t("adm1.tenant.descriptionHint")} error={state && !state.ok ? state.fieldErrors?.description : undefined}>
          <Textarea name="description" defaultValue={tenant.description ?? ""} maxLength={2000} rows={3} />
        </Field>
        <Field label={t("adm1.tenant.website")} hint={t("adm1.tenant.websiteHint")} error={state && !state.ok ? state.fieldErrors?.website : undefined}>
          <Input name="website" defaultValue={tenant.website ?? ""} inputMode="url" autoComplete="url" placeholder={t("adm1.tenant.websitePlaceholder")} />
        </Field>
        <Field label={t("adm1.tenant.locale")} hint={t("adm1.tenant.localeHint")} error={state && !state.ok ? state.fieldErrors?.defaultLocale : undefined}>
          <Select name="defaultLocale" defaultValue={LOCALES.includes(tenant.defaultLocale as (typeof LOCALES)[number]) ? tenant.defaultLocale : "de"}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
          </Select>
        </Field>
        <Field label={t("adm1.tenant.replyTo")} hint={t("adm1.tenant.replyToHint")} error={state && !state.ok ? state.fieldErrors?.replyToEmail : undefined}>
          <Input name="replyToEmail" type="email" defaultValue={tenant.replyToEmail ?? ""} inputMode="email" autoComplete="email" placeholder={t("adm1.tenant.replyToPlaceholder")} />
        </Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" pending={pending}>{t("adm1.common.save")}</SubmitButton>
      </form>
    </Card>
  );
}

// --- Erscheinungsbild ------------------------------------------------------

const LIGHT_BASE = { bg: "#f4f2ee", surface: "#ffffff", "surface-2": "#ebe8e2", ink: "#151515", "ink-2": "#4a4a48", "ink-3": "#6b6965", line: "#e1ddd5" };
const DARK_BASE = { bg: "#111110", surface: "#1b1b1a", "surface-2": "#262625", ink: "#f3f1ec", "ink-2": "#c4c1ba", "ink-3": "#8f8c85", line: "#2e2d2b" };
const DEFAULT_LIGHT: BrandMode = { accent: "#d6232d", accentInk: "#ffffff", accentSoft: "#fbe4e5", accentText: "#c9212a", accent2: "#d6232d", accent2Ink: "#ffffff" };
const DEFAULT_DARK: BrandMode = { accent: "#ef3b45", accentInk: "#ffffff", accentSoft: "#3a1b1d", accentText: "#f25c65", accent2: "#ef3b45", accent2Ink: "#ffffff" };

/** Setzt Basis- und Tailwind-Variablen lokal, damit die Vorschau unabhängig vom aktuellen Theme ist. */
function previewStyle(mode: "light" | "dark", brand: BrandMode): React.CSSProperties {
  const base = mode === "light" ? LIGHT_BASE : DARK_BASE;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) { vars[`--${k}`] = v; vars[`--color-${k}`] = v; }
  const accent = { accent: brand.accent, "accent-ink": brand.accentInk, "accent-soft": brand.accentSoft, "accent-2": brand.accent2, "accent-2-ink": brand.accent2Ink };
  for (const [k, v] of Object.entries(accent)) { vars[`--${k}`] = v; vars[`--color-${k}`] = v; }
  vars["--accent-text"] = brand.accentText;
  vars["--text-color-accent"] = brand.accentText;
  return { ...vars, colorScheme: mode } as React.CSSProperties;
}

function BrandPreview({ t, mode, brand, tenantName, logoUrl }: { t: TFunction; mode: "light" | "dark"; brand: BrandMode; tenantName: string; logoUrl: string | null }) {
  return (
    <div style={previewStyle(mode, brand)} className="rounded-control border border-line bg-bg p-3 text-ink">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
        ) : null}
        <span className="truncate">{t(mode === "light" ? "adm1.brand.light" : "adm1.brand.dark")} · {tenantName}</span>
      </div>
      <div className="rounded-xl border border-line bg-surface p-3 space-y-3">
        <div className="h-1.5 rounded-full brand-gradient" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-control bg-accent px-3 text-sm font-medium text-accent-ink">{t("adm1.brand.sampleSignUp")}</span>
          <span className="inline-flex h-9 items-center rounded-control border border-line bg-surface px-3 text-sm font-medium">{t("adm1.brand.sampleLater")}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{t("adm1.brand.sampleNew")}</span>
          <span className="inline-flex items-center rounded-full bg-accent-2 px-2.5 py-0.5 text-xs font-medium text-accent-2-ink">{t("adm1.brand.secondColor")}</span>
          <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">{t("adm1.brand.sampleMember")}</span>
        </div>
        <div className="grid grid-cols-4 rounded-xl border border-line bg-surface pt-1.5 pb-1">
          {[{ i: Home, l: t("adm1.brand.navHome") }, { i: Crosshair, l: t("adm1.brand.navShoot"), a: true }, { i: Target, l: t("adm1.brand.navTargets") }, { i: Megaphone, l: t("adm1.brand.navEvents") }].map(({ i: Icon, l, a }) => (
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

function ColorPicker({ t, label, value, onChange, name, error }: { t: TFunction; label: string; value: string; onChange: (v: string) => void; name: string; error?: string }) {
  const valid = normalizeHex(value);
  return (
    <Field label={label} error={error ?? (value && !valid ? t("adm1.brand.hexFormat") : undefined)}>
      <div className="flex items-center gap-2">
        <label className="relative h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-control border border-line" style={{ background: valid ?? "transparent" }}>
          <span className="sr-only">{t("adm1.brand.pickColor")}</span>
          <input type="color" value={valid ?? "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <Input name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#d6232d" maxLength={7} spellCheck={false} autoCapitalize="off" className="font-mono uppercase" />
      </div>
    </Field>
  );
}

export function BrandingForm({ locale, tenantName, logoUrl, brandColor, brandColor2 }: { locale: Locale; tenantName: string; logoUrl: string | null; brandColor: string | null; brandColor2: string | null }) {
  const t = getT(locale);
  const [state, action, pending] = useActionState(updateBrandColorsAction, null);
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
  // Gleiche Regel wie auf der Startseite: Reicht accent-ink auf Farbe 2 nicht, bleibt die Startkachel einfarbig.
  const gradientUnreadable = !!(vars && c2) && [vars.light, vars.dark].some((m) => contrastRatio(m.accentInk, m.accent2) < Math.min(4.5, contrastRatio(m.accentInk, m.accent)));
  const isCustom = !!brandColor;

  const reset = async () => {
    if (!(await confirmDialog({ title: t("adm1.brand.resetTitle"), tone: "danger", confirmLabel: t("adm1.brand.resetConfirm") }))) return;
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
          title={t("adm1.brand.logo")}
          name={tenantName}
          currentUrl={logoUrl}
          uploadAction={uploadTenantLogoAction}
          removeAction={removeTenantLogoAction}
          hint={t("adm1.brand.logoHint")}
        />
      </Card>

      <Card className="animate-rise p-4">
        {/* Neues Speichern ersetzt die Meldung eines früheren Zurücksetzens. */}
        <form onSubmit={(e) => { setResetMsg(null); submitKeepingValues(action)(e); }} className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-ink-2">{t("adm1.brand.accent")}</div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12" role="radiogroup" aria-label={t("adm1.brand.presets")}>
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

          <ColorPicker t={t} label={t("adm1.brand.customColor")} name="brandColor" value={color} onChange={setColor} error={state && !state.ok ? state.fieldErrors?.brandColor : undefined} />

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={useSecond} onChange={(e) => setUseSecond(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            <span className="text-sm font-medium">{t("adm1.brand.useSecond")} <span className="font-normal text-ink-3">{t("adm1.brand.useSecondHint")}</span></span>
          </label>
          {useSecond ? (
            <ColorPicker t={t} label={t("adm1.brand.secondColor")} name="brandColor2" value={color2} onChange={setColor2} error={state && !state.ok ? state.fieldErrors?.brandColor2 : undefined} />
          ) : (
            <input type="hidden" name="brandColor2" value="" />
          )}

          <div>
            <div className="mb-2 text-sm font-medium text-ink-2">{t("adm1.brand.preview")}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <BrandPreview t={t} mode="light" brand={light} tenantName={tenantName} logoUrl={logoUrl} />
              <BrandPreview t={t} mode="dark" brand={dark} tenantName={tenantName} logoUrl={logoUrl} />
            </div>
          </div>

          {report?.lowTextContrast ? (
            <div className="flex gap-2 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("adm1.brand.lowContrast", { ratio: report.textOnAccent.toFixed(1) })}</span>
            </div>
          ) : null}
          {report && !report.lowTextContrast && (report.adjustedLight || report.adjustedDark) ? (
            <p className="text-xs text-ink-3">{t(report.adjustedLight && report.adjustedDark ? "adm1.brand.adjustedBoth" : report.adjustedLight ? "adm1.brand.adjustedLight" : "adm1.brand.adjustedDark")}</p>
          ) : report && !report.lowTextContrast && report.textAdjusted ? (
            <p className="text-xs text-ink-3">{t("adm1.brand.textAdjusted")}</p>
          ) : null}
          {report2?.lowTextContrast ? (
            <p className="text-xs text-warn">{t("adm1.brand.lowContrast2", { ratio: report2.textOnAccent.toFixed(1) })}</p>
          ) : null}
          {gradientUnreadable ? (
            <p className="text-xs text-warn">{t("adm1.brand.gradientUnreadable")}</p>
          ) : null}

          {/* resetMsg ist nur gesetzt, wenn das Zurücksetzen nach dem letzten Speichern kam. */}
          {resetMsg ? <Alert tone="ok">{resetMsg}</Alert> : state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}

          <div className="flex flex-wrap gap-2">
            <SubmitButton pending={pending}>{t("adm1.brand.save")}</SubmitButton>
            {isCustom ? (
              <Button type="button" variant="ghost" onClick={reset} disabled={resetting}>
                {resetting ? <Spinner /> : <RotateCcw className="h-4 w-4" />} {t("adm1.brand.default")}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
