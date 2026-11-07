"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound, PlugZap, Save, Trash2 } from "lucide-react";
import { Alert, Button, Card, Field, Select, Input } from "@/components/ui";
import { PasswordInput, Segmented, Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";
import { AI_MODELS, PLATFORM_FEATURES, TENANT_FEATURES, TENANT_FEATURE_MIN_ROLE, type AiModel, type MemberAccess, type TenantFeature } from "@/lib/ai/types";
import {
  removeClubKeyAction, removePlatformKeyAction, saveClubKeyAction, saveClubSettingsAction, savePlatformKeyAction,
  savePlatformSettingsAction, setClubEnabledAction, setPlatformFlagAction, testClubKeyAction, testPlatformKeyAction, withdrawClubConsentAction,
} from "../actions";
import { aiT } from "../i18n";
import { fmtChf, fmtInt } from "../format";
import { parseBudget } from "../validation";
import { chfForTokens } from "../../usage/logic";

/**
 * Wer eine Vereins-Funktion tatsächlich nutzen kann (Hinweis in der Liste). Grundlage ist die
 * Mindestrolle; wo die Funktion strengere Rechte verlangt, steht das strengere Recht:
 * Inhalts-Übersetzung braucht das Bearbeitungsrecht des Inhalts.
 */
const FEATURE_ACCESS_OVERRIDE: Partial<Record<TenantFeature, string>> = {
  contentTranslation: "aiSet.minRole.editors",
};

function featureAccessKey(f: TenantFeature): string {
  return FEATURE_ACCESS_OVERRIDE[f] ?? `aiSet.minRole.${TENANT_FEATURE_MIN_ROLE[f]}`;
}

type Scope = "platform" | "tenant";

function report(res: ActionResult<unknown>, fallback: string): boolean {
  if (res.ok) {
    if (res.message) toast.success(res.message);
    return true;
  }
  toast.error(res.error || fallback);
  return false;
}

// ---------------------------------------------------------------------------
// Plattform-Schalter

export function PlatformSwitches({ enabled, allowClubs, locale }: { enabled: boolean; allowClubs: boolean; locale: string }) {
  const t = aiT(locale);
  const [on, setOn] = useState(enabled);
  const [clubs, setClubs] = useState(allowClubs);
  const [pending, start] = useTransition();

  function toggle(flag: "enabled" | "allowClubs", value: boolean) {
    const set = flag === "enabled" ? setOn : setClubs;
    const prev = flag === "enabled" ? on : clubs;
    set(value);
    start(async () => {
      try {
        if (!report(await setPlatformFlagAction(flag, value), t("ai.error.unknown"))) set(prev);
      } catch {
        set(prev);
        toast.error(t("aiSet.failed"));
      }
    });
  }

  return (
    <Card className="animate-rise divide-y divide-line">
      <Switch className="p-4" label={t("aiSet.platform.enabled")} description={t("aiSet.platform.enabledHint")} checked={on} disabled={pending} onChange={(v) => toggle("enabled", v)} />
      <Switch className="p-4" label={t("aiSet.platform.allowClubs")} description={t("aiSet.platform.allowClubsHint")} checked={clubs} disabled={pending} onChange={(v) => toggle("allowClubs", v)} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// API-Schlüssel (nur schreiben, testen, entfernen)

export function ApiKeyCard({ scope, hasKey, keyHint, locale }: { scope: Scope; hasKey: boolean; keyHint: string | null; locale: string }) {
  const t = aiT(locale);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [, start] = useTransition();

  function run(kind: "save" | "test" | "remove", fn: () => Promise<ActionResult<unknown>>, after?: (okay: boolean) => void) {
    setBusy(kind);
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) setError(res.fieldErrors?.apiKey);
        else setError(undefined);
        after?.(report(res, t("ai.error.unknown")));
      } catch {
        toast.error(t("aiSet.failed"));
      } finally {
        setBusy(null);
      }
    });
  }

  const save = () => run("save", () => (scope === "platform" ? savePlatformKeyAction(key) : saveClubKeyAction(key)), (okay) => okay && setKey(""));
  const test = () => run("test", () => (scope === "platform" ? testPlatformKeyAction(key || undefined) : testClubKeyAction(key || undefined)));
  async function remove() {
    const yes = await confirmDialog({ title: t("aiSet.key.removeConfirm"), message: t("aiSet.key.removeText"), tone: "danger", confirmLabel: t("aiSet.key.remove") });
    if (yes) run("remove", () => (scope === "platform" ? removePlatformKeyAction() : removeClubKeyAction()));
  }

  return (
    <Card className="animate-rise space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm">
        <KeyRound className="h-4 w-4 text-ink-3" aria-hidden />
        {hasKey && keyHint ? <span className="font-medium">{t("aiSet.key.stored", { hint: keyHint })}</span> : <span className="text-ink-3">{t("aiSet.key.none")}</span>}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-3"
      >
        <Field label={hasKey ? t("aiSet.key.labelNew") : t("aiSet.key.label")} hint={`${t("aiSet.key.writeOnly")} ${t("aiSet.key.where")}`} error={error}>
          <PasswordInput name="apiKey" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" maxLength={300} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!key.trim() || busy !== null}>
            {busy === "save" ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />} {t("aiSet.key.save")}
          </Button>
          <Button type="button" variant="secondary" disabled={busy !== null || (!hasKey && !key.trim())} onClick={test}>
            {busy === "test" ? <Spinner /> : <PlugZap className="h-4 w-4" aria-hidden />} {t("aiSet.key.test")}
          </Button>
          {hasKey ? (
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />} {t("aiSet.key.remove")}
            </Button>
          ) : null}
        </div>
      </form>
      <p className="text-xs text-ink-3">{t("aiSet.key.testHint")}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Modell, Funktionen, Zugang, Budget

export function AiSettingsForm({
  scope, locale, model, features, memberAccess, monthlyTokenLimit,
}: { scope: Scope; locale: string; model: AiModel; features: string[]; memberAccess?: MemberAccess; monthlyTokenLimit: number | null }) {
  const t = aiT(locale);
  const all: readonly string[] = scope === "platform" ? PLATFORM_FEATURES : TENANT_FEATURES;
  const [m, setM] = useState<string>(model);
  const [selected, setSelected] = useState<string[]>(features);
  const [access, setAccess] = useState<MemberAccess>(memberAccess ?? "ALL");
  const [unit, setUnit] = useState<"tokens" | "chf">("tokens");
  const [budget, setBudget] = useState(monthlyTokenLimit ? String(monthlyTokenLimit) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const preview = useMemo(() => {
    const p = parseBudget(budget, unit, m);
    if (!p.ok) return null;
    if (p.value == null) return t("aiSet.budget.none");
    return t("aiSet.budget.current", { tokens: fmtInt(p.value, locale), chf: fmtChf(chfForTokens(p.value, m), locale) });
  }, [budget, unit, m, t, locale]);

  function changeUnit(next: "tokens" | "chf") {
    // Wert umrechnen, damit derselbe Betrag stehen bleibt.
    const p = parseBudget(budget, unit, m);
    if (p.ok && p.value != null) setBudget(next === "chf" ? String(chfForTokens(p.value, m)) : String(p.value));
    setUnit(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { model: m, features: selected, budget, budgetUnit: unit, memberAccess: scope === "tenant" ? access : undefined };
    start(async () => {
      try {
        const res = scope === "platform" ? await savePlatformSettingsAction(input) : await saveClubSettingsAction(input);
        setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
        report(res, t("ai.error.unknown"));
      } catch {
        toast.error(t("aiSet.failed"));
      }
    });
  }

  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("aiSet.settings.model")} error={errors.model}>
          <Select name="model" value={m} onChange={(e) => setM(e.target.value)}>
            {AI_MODELS.map((id) => (
              <option key={id} value={id}>{t(`aiSet.model.${id}`)}</option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-2">{t("aiSet.settings.features")}</legend>
          <div className="divide-y divide-line">
            {all.map((f) => {
              const access = scope === "tenant" ? featureAccessKey(f as TenantFeature) : null;
              return (
                <Switch
                  key={f}
                  className="py-3"
                  label={t(`aiSet.feature.${f}`)}
                  description={`${t(`aiSet.feature.${f}.hint`)}${access ? ` · ${t(access)}` : ""}`}
                  checked={selected.includes(f)}
                  onChange={(v) => setSelected((cur) => (v ? [...cur.filter((x) => x !== f), f] : cur.filter((x) => x !== f)))}
                />
              );
            })}
          </div>
        </fieldset>

        {scope === "tenant" ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-2">{t("aiSet.access.label")}</p>
            <Segmented<MemberAccess>
              label={t("aiSet.access.label")}
              value={access}
              onChange={setAccess}
              options={[{ value: "ALL", label: t("aiSet.access.ALL") }, { value: "STAFF", label: t("aiSet.access.STAFF") }]}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Segmented<"tokens" | "chf">
            label={t("aiSet.budget.unit")}
            value={unit}
            onChange={changeUnit}
            options={[{ value: "tokens", label: t("aiSet.budget.unit.tokens") }, { value: "chf", label: t("aiSet.budget.unit.chf") }]}
          />
          <Field label={scope === "platform" ? t("aiSet.budget.label") : t("aiSet.budget.limitLabel")} hint={preview ?? undefined} error={errors.budget}>
            <Input name="budget" inputMode={unit === "chf" ? "decimal" : "numeric"} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={t("aiSet.budget.none")} autoComplete="off" maxLength={20} />
          </Field>
          <p className="text-xs text-ink-3">{t("aiSet.budget.hint")} {t("aiSet.usage.estimateNote")}</p>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />} {t("aiSet.settings.save")}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Verein: Datenschutz, Zustimmung, Schalter

export function ClubSwitchCard({
  locale, enabled, allowClubs, hasKey, consentGiven, consentText,
}: { locale: string; enabled: boolean; allowClubs: boolean; hasKey: boolean; consentGiven: boolean; consentText: string | null }) {
  const t = aiT(locale);
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  const canEnable = allowClubs && (consentGiven || checked);

  function setEnabled(value: boolean) {
    start(async () => {
      try {
        report(await setClubEnabledAction(value, checked), t("ai.error.unknown"));
      } catch {
        toast.error(t("aiSet.failed"));
      }
    });
  }

  async function withdraw() {
    const yes = await confirmDialog({ title: t("aiSet.privacy.withdrawConfirm"), message: t("aiSet.privacy.withdrawText"), tone: "danger", confirmLabel: t("aiSet.privacy.withdraw") });
    if (!yes) return;
    start(async () => {
      try {
        if (report(await withdrawClubConsentAction(), t("ai.error.unknown"))) setChecked(false);
      } catch {
        toast.error(t("aiSet.failed"));
      }
    });
  }

  return (
    <div className="space-y-3">
      {!allowClubs ? <Alert tone="warn">{t("aiSet.club.notAllowed")}</Alert> : null}

      <Card className="animate-rise space-y-2 p-4 text-sm text-ink-2">
        <h3 className="font-semibold text-ink">{t("aiSet.privacy.section")}</h3>
        <p>{t("aiSet.privacy.p1")}</p>
        <p>{t("aiSet.privacy.p2")}</p>
        <p>{t("aiSet.privacy.p3")}</p>
        <p>{t("aiSet.privacy.p4")}</p>
        {consentGiven ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-ok">{consentText}</p>
            <Button type="button" variant="ghost" size="sm" className="h-11" disabled={pending} onClick={withdraw}>{t("aiSet.privacy.withdraw")}</Button>
          </div>
        ) : (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 pt-1 text-ink">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={!allowClubs} />
            <span>{t("aiSet.privacy.consent")}</span>
          </label>
        )}
      </Card>

      <Card className="animate-rise p-4">
        <Switch
          label={t("aiSet.club.switch")}
          description={!hasKey && !enabled ? t("aiSet.club.needsKey") : t("aiSet.club.switchHint")}
          checked={enabled}
          disabled={pending || (!enabled && (!canEnable || !hasKey))}
          onChange={setEnabled}
        />
        {!enabled && allowClubs && !consentGiven && !checked ? <p className="mt-2 text-xs text-ink-3">{t("aiSet.club.needsConsent")}</p> : null}
      </Card>
    </div>
  );
}
