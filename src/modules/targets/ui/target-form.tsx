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
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Props = {
  scope: "mine" | "tenant" | "global";
  initial?: { id: string; name: string; description: string | null; subject: string; paperSizes: PaperSize[]; params: TargetParams; sharedWithTenant: boolean; filePath: string | null };
};

const DISTANCE_KEYS = new Set(["originalDistanceM", "shotDistanceM"]);

export function TargetForm({ scope, initial }: Props) {
  const [state, action] = useActionState(saveTargetAction, null);
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
    return renderTarget(subject, preview, relevant as TargetParams);
  }, [subject, preview, params, fields]);
  const set = (patch: Partial<TargetParams>) => setParams((p) => ({ ...p, ...patch }));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="scope" value={scope} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <Card className="animate-rise p-4 space-y-4">
            <Field label="Name"><Input name="name" defaultValue={initial?.name} required placeholder="z.B. 10-Ring Pistole" /></Field>
            <Field label="Sujet">
              <Select name="subject" value={subject} onChange={(e) => setSubject(e.target.value as TargetSubject)}>
                {TARGET_CATEGORIES.map((c) => {
                  const list = TARGET_SUBJECTS.filter((s) => s.category === c.key);
                  if (!list.length) return null;
                  return (
                    <optgroup key={c.key} label={c.label}>
                      {list.map((s) => <option key={s.key} value={s.key}>{s.label}{"isNew" in s && s.isNew ? " (neu)" : ""}</option>)}
                    </optgroup>
                  );
                })}
              </Select>
              <p className="mt-1 text-xs text-ink-3">{meta?.description}</p>
            </Field>
            <Field label="Beschreibung (optional)"><Textarea name="description" defaultValue={initial?.description ?? ""} className="min-h-16" /></Field>
            <Field label="Formate" hint="In diesen Grössen kann die Scheibe gedruckt werden.">
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
              <Field label={initial?.filePath ? "Datei ersetzen (optional)" : "Datei"} hint="PNG, JPG, SVG oder PDF, max. 8 MB. Am besten schwarz-weiss und im Seitenverhältnis des Formats.">
                <label className="flex h-28 cursor-pointer items-center justify-center rounded-control border border-dashed border-line hover:border-ink text-ink-3 gap-2">
                  <Upload className="h-5 w-5" /> <span className="text-sm">{fileUrl ? "Datei gewählt" : "Datei wählen"}</span>
                  <input type="file" name="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; setFileUrl(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : f ? "pdf" : null); }} />
                </label>
              </Field>
            </Card>
          ) : (
            <>
              <Card className="animate-rise p-4 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Einstellungen</h3>
                {mainFields.length === 0 ? <p className="text-sm text-ink-3">Keine weiteren Einstellungen nötig.</p> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {mainFields.map((f) => <ParamField key={`${subject}-${f.key}`} field={f} params={params} set={set} />)}
                </div>
              </Card>
              {distanceFields.length ? (
                <Card className="animate-rise p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-ink-3" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Auf Distanz skalieren (optional)</h3>
                  </div>
                  <p className="text-sm text-ink-2">Schiesst du z.B. eine 300-m-Scheibe auf 25 m, wird sie im Verhältnis 25/300 verkleinert. Passt sie nicht aufs Papier, wird sie verkleinert und das steht oben links auf dem Blatt.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {distanceFields.map((f) => <ParamField key={`${subject}-${f.key}`} field={f} params={params} set={set} />)}
                  </div>
                </Card>
              ) : null}
            </>
          )}

          {scope === "mine" ? (
            <Card className="animate-rise p-4">
              <label className="flex items-center gap-3 min-h-11">
                <input type="checkbox" name="sharedWithTenant" defaultChecked={initial?.sharedWithTenant} className="h-5 w-5 accent-[var(--ink)]" />
                <span><span className="block text-sm font-medium">Mit dem Verein teilen</span><span className="block text-xs text-ink-3">Andere Mitglieder können die Scheibe sehen und drucken.</span></span>
              </label>
            </Card>
          ) : null}
        </div>

        <div className="animate-rise [animation-delay:120ms] md:sticky md:top-4 self-start">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Vorschau</span>
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
                <img src={`/api/files/${initial.id}`} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-500 text-sm">{fileUrl === "pdf" ? "PDF gewählt" : "Keine Datei"}</div>
              )
            ) : (
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: rendered?.svg ?? "" }} />
            )}
          </div>
          {rendered?.note ? (
            <div className="mt-2 max-w-xs mx-auto"><Badge tone="outline" className="whitespace-normal">{rendered.note}</Badge></div>
          ) : null}
          {!sizes.includes(preview) ? <p className="mt-2 text-xs text-warn max-w-xs mx-auto">{preview} ist nicht als Format gewählt.</p> : null}
        </div>
      </div>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" disabled={sizes.length === 0} pendingText="Speichern…">{initial ? "Änderungen speichern" : "Scheibe anlegen"}</SubmitButton>
      </div>
    </form>
  );
}

function ParamField({ field, params, set }: { field: FieldDef; params: TargetParams; set: (p: Partial<TargetParams>) => void }) {
  const info = PARAM_INFO[field.key];
  const label = field.label ?? info.label;
  const hint = field.hint ?? info.hint;
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
              {o.label}
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
        placeholder={field.default !== undefined ? String(field.default) : "auto"}
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
