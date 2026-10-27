"use client";

import { useActionState, useState } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { saveProgramAction } from "@/modules/scores/actions";
import { DISCIPLINES, POSITIONS, SCORING_MODES, programTotals, type Stage } from "@/modules/scores/types";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

type Props = {
  scope: "tenant" | "global";
  initial?: { id: string; name: string; description: string | null; discipline: string; weaponNote: string | null; scoringMode: string; stages: Stage[] };
};

const emptyStage = (i: number, prev?: Stage): Stage => ({
  name: `Serie ${i + 1}`,
  distanceM: prev?.distanceM ?? 25,
  shots: prev?.shots ?? 5,
  maxPerShot: prev?.maxPerShot ?? 10,
  timeLimitSec: prev?.timeLimitSec,
  position: prev?.position ?? "",
  targetName: prev?.targetName ?? "",
  note: "",
});

export function ProgramForm({ scope, initial }: Props) {
  const [state, action] = useActionState(saveProgramAction, null);
  const [stages, setStages] = useState<Stage[]>(initial?.stages ?? [emptyStage(0)]);
  const [scoringMode, setScoringMode] = useState(initial?.scoringMode ?? "RINGS_INT");
  const totals = programTotals(stages);

  const update = (i: number, patch: Partial<Stage>) => setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const remove = (i: number) => setStages((s) => s.filter((_, idx) => idx !== i));
  const duplicate = (i: number) => setStages((s) => [...s.slice(0, i + 1), { ...s[i]!, name: `${s[i]!.name} (Kopie)` }, ...s.slice(i + 1)]);
  const add = () => setStages((s) => [...s, emptyStage(s.length, s[s.length - 1])]);
  const move = (i: number, dir: -1 | 1) =>
    setStages((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  const isHits = scoringMode === "HITS";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="scope" value={scope} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="stagesJson" value={JSON.stringify(stages.map((s) => ({ ...s, maxPerShot: isHits ? 1 : s.maxPerShot })))} />

      <Card className="animate-rise p-4 space-y-4">
        <Field label="Name"><Input name="name" defaultValue={initial?.name} required placeholder="z.B. Pistole 25 m Präzision" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Waffe">
            <Select name="discipline" defaultValue={initial?.discipline ?? "PISTOL"}>
              {DISCIPLINES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </Select>
          </Field>
          <Field label="Wertung">
            <Select name="scoringMode" value={scoringMode} onChange={(e) => setScoringMode(e.target.value)}>
              {SCORING_MODES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Waffe genauer (optional)"><Input name="weaponNote" defaultValue={initial?.weaponNote ?? ""} placeholder="z.B. Sportpistole .22, Ordonnanz" /></Field>
        <Field label="Beschreibung (optional)"><Textarea name="description" defaultValue={initial?.description ?? ""} placeholder="Ablauf, Regeln, Hinweise" /></Field>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Serien / Stationen</h2>
          <span className="text-xs text-ink-3 tabular-nums">{totals.shots} Schuss · max. {totals.max} {isHits ? "Treffer" : "Punkte"}</span>
        </div>
        <div className="space-y-3">
          {stages.map((s, i) => (
            <Card key={i} className="animate-rise p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex flex-col text-ink-3">
                  <button type="button" onClick={() => move(i, -1)} className="h-4 leading-none hover:text-ink" aria-label="Nach oben">▲</button>
                  <button type="button" onClick={() => move(i, 1)} className="h-4 leading-none hover:text-ink" aria-label="Nach unten">▼</button>
                </div>
                <GripVertical className="h-4 w-4 text-ink-3 hidden" />
                <Input value={s.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1 font-medium" placeholder={`Serie ${i + 1}`} />
                <button type="button" onClick={() => duplicate(i)} className="press h-9 w-9 rounded-full hover:bg-surface-2 text-ink-3 flex items-center justify-center" aria-label="Duplizieren"><Copy className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(i)} disabled={stages.length === 1} className="press h-9 w-9 rounded-full hover:bg-accent-soft text-ink-3 hover:text-accent disabled:opacity-30 flex items-center justify-center" aria-label="Entfernen"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Distanz (m)"><Input type="number" inputMode="decimal" step="0.5" min={0.5} value={s.distanceM} onChange={(e) => update(i, { distanceM: Number(e.target.value) })} /></Field>
                <Field label="Schüsse"><Input type="number" inputMode="numeric" min={1} max={200} value={s.shots} onChange={(e) => update(i, { shots: Number(e.target.value) })} /></Field>
                {isHits ? (
                  <Field label="Zeit (s)"><Input type="number" inputMode="numeric" min={0} value={s.timeLimitSec ?? ""} onChange={(e) => update(i, { timeLimitSec: e.target.value ? Number(e.target.value) : undefined })} placeholder="–" /></Field>
                ) : (
                  <Field label="Max. Ring"><Input type="number" inputMode="numeric" min={1} max={100} value={s.maxPerShot} onChange={(e) => update(i, { maxPerShot: Number(e.target.value) })} /></Field>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Anschlag">
                  <Select value={s.position ?? ""} onChange={(e) => update(i, { position: e.target.value })}>
                    {POSITIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </Select>
                </Field>
                {isHits ? (
                  <Field label="Scheibe / Ziel"><Input value={s.targetName ?? ""} onChange={(e) => update(i, { targetName: e.target.value })} placeholder="z.B. Stahlplatte" /></Field>
                ) : (
                  <Field label="Zeit (s, optional)"><Input type="number" inputMode="numeric" min={0} value={s.timeLimitSec ?? ""} onChange={(e) => update(i, { timeLimitSec: e.target.value ? Number(e.target.value) : undefined })} placeholder="–" /></Field>
                )}
              </div>
              {!isHits ? (
                <div className="mt-3"><Field label="Scheibe (optional)"><Input value={s.targetName ?? ""} onChange={(e) => update(i, { targetName: e.target.value })} placeholder="z.B. Präzisionsscheibe 25 m" /></Field></div>
              ) : null}
              <div className="mt-3"><Field label="Hinweis (optional)"><Input value={s.note ?? ""} onChange={(e) => update(i, { note: e.target.value })} placeholder="z.B. hinter Deckung, Magazinwechsel" /></Field></div>
            </Card>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={add} className="mt-3 w-full"><Plus className="h-4 w-4" /> Serie hinzufügen</Button>
      </div>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" pendingText="Speichern…">{initial ? "Änderungen speichern" : "Programm anlegen"}</SubmitButton>
      </div>
    </form>
  );
}
