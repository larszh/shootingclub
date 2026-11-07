"use client";

import { useActionState, useMemo, useState } from "react";
import { Ruler, Upload } from "lucide-react";
import { saveTargetAction } from "@/modules/targets/actions";
import { renderTarget } from "@/modules/targets/svg";
import {
  PAPER_SIZES,
  PARAM_INFO,
  TARGET_CATEGORIES,
  TARGET_SUBJECTS,
  subjectFields,
  subjectMeta,
  type FieldDef,
  type PaperSize,
  type TargetParams,
  type TargetSubject,
} from "@/modules/targets/types";
import { Alert, Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { targetFileUrl } from "@/modules/targets/file-url";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/components/locale";
import type { TFunction } from "@/lib/i18n/core";
import { targetCategoryText, targetSubjectText } from "@/modules/scores/ui/labels";
import { targetTextTranslator } from "@/modules/targets/target-i18n";

type Props = {
  scope: "mine" | "tenant" | "global";
  initial?: { id: string; name: string; description: string | null; subject: string; paperSizes: PaperSize[]; params: TargetParams; sharedWithTenant: boolean; filePath: string | null };
};

const DISTANCE_KEYS = new Set(["originalDistanceM", "shotDistanceM"]);

export function TargetForm({ scope, initial }: Props) {
  const t = useT();
  const locale = useLocale();
  const tx = useMemo(() => targetTextTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(saveTargetAction, null);
  const [subject, setSubject] = useState<TargetSubject>(
    subjectMeta(initial?.subject ?? "") ? (initial!.subject as TargetSubject) : "RINGS_10",
  );
  const [params, setParams] = useState<TargetParams>(initial?.params ?? {});
  const [sizes, setSizes] = useState<PaperSize[]>(initial?.paperSizes ?? ["A4", "A5", "A6"]);
  const [preview, setPreview] = useState<PaperSize>(initial?.paperSizes[0] ?? "A5");
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const meta = subjectMeta(subject);
  const fields = useMemo(() => subjectFields(subject), [subject]);
  const mainFields = fields.filter((f) => !DISTANCE_KEYS.has(f.key) || !meta?.scalable);
  const distanceFields = meta?.scalable ? fields.filter((f) => DISTANCE_KEYS.has(f.key)) : [];
  // Vorschau nur mit den Feldern, die für dieses Sujet auch gespeichert werden
  const rendered = useMemo(() => {
    if (subject === "UPLOAD") return null;
    const relevant: Record<string, unknown> = {};
    for (const f of fields) if (params[f.key] !== undefined) relevant[f.key] = params[f.key];
    return renderTarget(subject, preview, relevant as TargetParams, locale);
  }, [subject, preview, params, fields, locale]);
  const set = (patch: Partial<TargetParams>) => setParams((p) => ({ ...p, ...patch }));

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-5">
      <input type="hidden" name="scope" value={scope} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <Card className="animate-rise p-4 space-y-4">
            <Field label={t("adm2.targets.f.name")}><Input name="name" defaultValue={initial?.name} required placeholder={t("adm2.targets.f.namePh")} /></Field>
            <Field label={t("adm2.targets.f.subject")}>
              <Select name="subject" value={subject} onChange={(e) => setSubject(e.target.value as TargetSubject)}>
                {TARGET_CATEGORIES.map((c) => {
                  const list = TARGET_SUBJECTS.filter((s) => s.category === c.key);
                  if (!list.length) return null;
                  return (
                    <optgroup key={c.key} label={targetCategoryText(t, c.key)}>
                      {list.map((s) => <option key={s.key} value={s.key}>{targetSubjectText(t, s.key)}{"isNew" in s && s.isNew ? t("adm2.targets.f.new") : ""}</option>)}
                    </optgroup>
                  );
                })}
              </Select>
              <p className="mt-1 text-xs text-ink-3">{meta ? tx(meta.description) : null}</p>
            </Field>
            <Field label={t("adm2.targets.f.description")}><Textarea name="description" defaultValue={initial?.description ?? ""} className="min-h-16" /></Field>
            <Field label={t("adm2.targets.f.sizes")} hint={t("adm2.targets.f.sizesHint")}>
              <div className="flex gap-2">
                {PAPER_SIZES.map((s) => {
                  const on = sizes.includes(s);
                  return (
                    <label key={s} className={cn("press flex-1 h-11 rounded-control border flex items-center justify-center text-sm font-medium cursor-pointer select-none", on ? "bg-ink text-bg border-ink" : "border-line text-ink-2")}>
                      <input type="checkbox" name="paperSizes" value={s} checked={on} onChange={() => setSizes((x) => (on ? x.filter((y) => y !== s) : [...x, s]))} className="sr-only" />
                      {s}
                    </label>
                  );
                })}
              </div>
            </Field>
          </Card>

          {subject === "UPLOAD" ? (
            <Card className="animate-rise p-4 space-y-3">
              <Field label={initial?.filePath ? t("adm2.targets.f.replaceFile") : t("adm2.targets.f.file")} hint={t("adm2.targets.f.fileHint")}>
                <label className="flex h-28 cursor-pointer items-center justify-center rounded-control border border-dashed border-line hover:border-ink text-ink-3 gap-2">
                  <Upload className="h-5 w-5" /> <span className="text-sm">{fileUrl ? t("adm2.targets.f.fileChosen") : t("adm2.targets.f.chooseFile")}</span>
                  <input type="file" name="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; setFileUrl(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : f ? "pdf" : null); }} />
                </label>
              </Field>
            </Card>
          ) : (
            <>
              <Card className="animate-rise p-4 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t("adm2.targets.f.settings")}</h3>
                {mainFields.length === 0 ? <p className="text-sm text-ink-3">{t("adm2.targets.f.noSettings")}</p> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {mainFields.map((f) => <ParamField key={`${subject}-${f.key}`} field={f} params={params} set={set} t={t} tx={tx} />)}
                </div>
              </Card>
              {distanceFields.length ? (
                <Card className="animate-rise p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-ink-3" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t("adm2.targets.f.scaleTitle")}</h3>
                  </div>
                  <p className="text-sm text-ink-2">{t("adm2.targets.f.scaleText")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {distanceFields.map((f) => <ParamField key={`${subject}-${f.key}`} field={f} params={params} set={set} t={t} tx={tx} />)}
                  </div>
                </Card>
              ) : null}
            </>
          )}

          {scope === "mine" ? (
            <Card className="animate-rise p-4">
              <label className="flex items-center gap-3 min-h-11">
                <input type="checkbox" name="sharedWithTenant" defaultChecked={initial?.sharedWithTenant} className="h-5 w-5 accent-[var(--ink)]" />
                <span><span className="block text-sm font-medium">{t("adm2.targets.f.share")}</span><span className="block text-xs text-ink-3">{t("adm2.targets.f.shareHint")}</span></span>
              </label>
            </Card>
          ) : null}
        </div>

        <div className="animate-rise [animation-delay:120ms] md:sticky md:top-4 self-start">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{t("adm2.targets.f.preview")}</span>
            <div className="flex gap-1">
              {PAPER_SIZES.map((s) => <button key={s} type="button" onClick={() => setPreview(s)} className={cn("h-8 px-2.5 rounded-md text-xs font-medium", preview === s ? "bg-ink text-bg" : "text-ink-3")}>{s}</button>)}
            </div>
          </div>
          <div className="rounded-card border border-line bg-white overflow-hidden shadow-sm aspect-[210/297] max-w-xs mx-auto">
            {subject === "UPLOAD" ? (
              fileUrl && fileUrl !== "pdf" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt="" className="h-full w-full object-contain" />
              ) : initial?.filePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={targetFileUrl(initial)} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-500 text-sm">{fileUrl === "pdf" ? t("adm2.targets.f.pdfChosen") : t("adm2.targets.f.noFile")}</div>
              )
            ) : (
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: rendered?.svg ?? "" }} />
            )}
          </div>
          {rendered?.note ? (
            <div className="mt-2 max-w-xs mx-auto"><Badge tone="outline" className="whitespace-normal">{rendered.note}</Badge></div>
          ) : null}
          {!sizes.includes(preview) ? <p className="mt-2 text-xs text-warn max-w-xs mx-auto">{t("adm2.targets.f.sizeNotChosen", { size: preview })}</p> : null}
        </div>
      </div>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" pending={pending} disabled={sizes.length === 0} pendingText={t("adm2.targets.f.saving")}>{initial ? t("adm2.targets.f.saveChanges") : t("adm2.targets.f.create")}</SubmitButton>
      </div>
    </form>
  );
}

function ParamField({ field, params, set, t, tx }: { field: FieldDef; params: TargetParams; set: (p: Partial<TargetParams>) => void; t: TFunction; tx: (de: string) => string }) {
  const info = PARAM_INFO[field.key];
  const label = tx(field.label ?? info.label);
  const rawHint = field.hint ?? info.hint;
  const hint = rawHint ? tx(rawHint) : undefined;
  const value = params[field.key];

  if (info.kind === "bool") {
    const checked = typeof value === "boolean" ? value : Boolean(field.default);
    return (
      <label className="flex items-center gap-3 min-h-11 sm:col-span-2">
        <input type="hidden" name={field.key} value="false" />
        <input type="checkbox" name={field.key} value="true" checked={checked} onChange={(e) => set({ [field.key]: e.target.checked })} className="h-5 w-5 accent-[var(--ink)]" />
        <span className="text-sm font-medium">{label}</span>
      </label>
    );
  }
  if (info.kind === "select" && field.options) {
    const current = typeof value === "string" && field.options.some((o) => o.value === value) ? value : String(field.default ?? field.options[0]?.value ?? "");
    return (
      <Field label={label} hint={hint} className="sm:col-span-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
          {field.options.map((o) => (
            <label key={o.value} className={cn("press min-h-11 px-3.5 rounded-control border flex items-center text-sm font-medium cursor-pointer select-none", current === o.value ? "bg-ink text-bg border-ink" : "border-line text-ink-2 bg-surface")}>
              <input type="radio" name={field.key} value={o.value} checked={current === o.value} onChange={() => set({ [field.key]: o.value })} className="sr-only" />
              {tx(o.label)}
            </label>
          ))}
        </div>
      </Field>
    );
  }
  const min = field.min ?? info.min;
  const max = field.max ?? info.max;
  const num = typeof value === "number" ? value : "";
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        name={field.key}
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={num}
        placeholder={field.default !== undefined ? String(field.default) : t("adm2.targets.f.auto")}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return set({ [field.key]: undefined });
          const v = Number(raw);
          if (Number.isFinite(v)) set({ [field.key]: v });
        }}
      />
    </Field>
  );
}
