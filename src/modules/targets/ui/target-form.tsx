"use client";

import { useActionState, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { saveTargetAction } from "@/modules/targets/actions";
import { renderTargetSvg } from "@/modules/targets/svg";
import { PAPER_SIZES, TARGET_SUBJECTS, type PaperSize, type TargetParams, type TargetSubject } from "@/modules/targets/types";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Props = {
  scope: "mine" | "tenant" | "global";
  initial?: { id: string; name: string; description: string | null; subject: string; paperSizes: PaperSize[]; params: TargetParams; sharedWithTenant: boolean; filePath: string | null };
};

export function TargetForm({ scope, initial }: Props) {
  const [state, action] = useActionState(saveTargetAction, null);
  const [subject, setSubject] = useState<TargetSubject>((initial?.subject as TargetSubject) ?? "RINGS_10");
  const [params, setParams] = useState<TargetParams>(initial?.params ?? {});
  const [sizes, setSizes] = useState<PaperSize[]>(initial?.paperSizes ?? ["A4", "A5", "A6"]);
  const [preview, setPreview] = useState<PaperSize>("A5");
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const svg = useMemo(() => (subject === "UPLOAD" ? "" : renderTargetSvg(subject, preview, params)), [subject, preview, params]);
  const set = (patch: Partial<TargetParams>) => setParams((p) => ({ ...p, ...patch }));
  const showRings = subject === "RINGS_10" || subject === "RINGS_5";
  const showGridOf = subject === "DOTS" || subject === "DIAMOND";

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
                {TARGET_SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
              <p className="mt-1 text-xs text-ink-3">{TARGET_SUBJECTS.find((s) => s.key === subject)?.description}</p>
            </Field>
            <Field label="Beschreibung (optional)"><Textarea name="description" defaultValue={initial?.description ?? ""} className="min-h-16" /></Field>
            <Field label="Formate">
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
            <Card className="animate-rise p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Einstellungen</h3>
              {showRings || showGridOf ? (
                <Field label="Durchmesser (mm)" hint="Leer = maximal für das Format">
                  <Input type="number" name="diameterMm" inputMode="numeric" min={10} max={300} value={params.diameterMm ?? ""} onChange={(e) => set({ diameterMm: e.target.value ? Number(e.target.value) : undefined })} placeholder="auto" />
                </Field>
              ) : null}
              {subject === "RINGS_10" ? (
                <Field label="Schwarzer Spiegel ab Ring">
                  <Input type="number" name="blackFrom" inputMode="numeric" min={1} max={10} value={params.blackFrom ?? 7} onChange={(e) => set({ blackFrom: Number(e.target.value) })} />
                </Field>
              ) : null}
              {showRings || subject === "DOTS" ? (
                <label className="flex items-center gap-3 h-11">
                  <input type="checkbox" name="numbers" checked={params.numbers ?? showRings} onChange={(e) => set({ numbers: e.target.checked })} className="h-5 w-5 accent-[var(--ink)]" />
                  <span className="text-sm font-medium">Ringzahlen anzeigen</span>
                </label>
              ) : null}
              {showGridOf ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Spalten"><Input type="number" name="columns" inputMode="numeric" min={1} max={6} value={params.columns ?? (subject === "DOTS" ? 3 : 2)} onChange={(e) => set({ columns: Number(e.target.value) })} /></Field>
                  <Field label="Reihen"><Input type="number" name="rows" inputMode="numeric" min={1} max={8} value={params.rows ?? (subject === "DOTS" ? 4 : 3)} onChange={(e) => set({ rows: Number(e.target.value) })} /></Field>
                </div>
              ) : null}
              {subject === "GRID" ? (
                <Field label="Rasterweite (mm)"><Input type="number" name="gridMm" inputMode="numeric" min={2} max={50} value={params.gridMm ?? 10} onChange={(e) => set({ gridMm: Number(e.target.value) })} /></Field>
              ) : null}
              {subject === "SILHOUETTE" ? <p className="text-sm text-ink-3">Keine weiteren Einstellungen.</p> : null}
            </Card>
          )}

          {scope === "mine" ? (
            <Card className="animate-rise p-4">
              <label className="flex items-center gap-3">
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
              {PAPER_SIZES.map((s) => <button key={s} type="button" onClick={() => setPreview(s)} className={cn("h-7 px-2 rounded-md text-xs font-medium", preview === s ? "bg-ink text-bg" : "text-ink-3")}>{s}</button>)}
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
                <div className="h-full flex items-center justify-center text-ink-3 text-sm">{fileUrl === "pdf" ? "PDF gewählt" : "Keine Datei"}</div>
              )
            ) : (
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
        </div>
      </div>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" disabled={sizes.length === 0} pendingText="Speichern…">{initial ? "Änderungen speichern" : "Scheibe anlegen"}</SubmitButton>
      </div>
    </form>
  );
}
