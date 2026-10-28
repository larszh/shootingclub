"use client";

import { useActionState, useState } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { saveProgramAction } from "@/modules/scores/actions";
import { DEFAULT_ZONES, DISCIPLINES, POSITIONS, SCORING_MODES, programTotals, stageZones, type Stage } from "@/modules/scores/types";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { dominantZones, sameZones, ZoneLegend } from "./zone-legend";
import { draftError, fromDrafts, toDrafts, ZoneEditor, type ZoneDraft } from "./zone-editor";

type Props = {
  scope: "tenant" | "global";
  initial?: { id: string; name: string; description: string | null; discipline: string; weaponNote: string | null; scoringMode: string; stages: Stage[] };
  /** Anzahl offener Durchgänge mit diesem Programm (Hinweis beim Bearbeiten). */
  openMatches?: number;
};

/** Serie im Formular; `ownZones` gesetzt = eigene Zonen statt der Programm-Zonen. */
type FormStage = Omit<Stage, "zones"> & { ownZones?: ZoneDraft[] };

const emptyStage = (i: number, prev?: FormStage): FormStage => ({
  name: `Serie ${i + 1}`,
  distanceM: prev?.distanceM ?? 25,
  shots: prev?.shots ?? 5,
  maxPerShot: prev?.maxPerShot ?? 10,
  timeLimitSec: prev?.timeLimitSec,
  position: prev?.position ?? "",
  targetName: prev?.targetName ?? "",
  note: "",
});

/** Programm-Zonen (häufigste Zonenliste) und Serien mit Abweichungen aus gespeicherten Serien. */
function initialZoneState(initial: Props["initial"]): { programZones: ZoneDraft[]; stages: FormStage[] } {
  if (!initial) return { programZones: toDrafts(DEFAULT_ZONES), stages: [emptyStage(0)] };
  const isZones = initial.scoringMode === "ZONES";
  const programZones = (isZones ? dominantZones(initial.stages.map((s) => stageZones(s))) : null) ?? DEFAULT_ZONES;
  return {
    programZones: toDrafts(programZones),
    stages: initial.stages.map(({ zones, ...rest }) => {
      const own = isZones && zones && !sameZones(zones, programZones) ? toDrafts(zones) : undefined;
      return own ? { ...rest, ownZones: own } : rest;
    }),
  };
}

export function ProgramForm({ scope, initial, openMatches = 0 }: Props) {
  const [state, action, pending] = useActionState(saveProgramAction, null);
  const [init] = useState(() => initialZoneState(initial));
  const [stages, setStages] = useState<FormStage[]>(init.stages);
  const [programZones, setProgramZones] = useState<ZoneDraft[]>(init.programZones);
  const [scoringMode, setScoringMode] = useState(initial?.scoringMode ?? "RINGS_INT");
  /** Speichern wurde wegen ungültiger Zonen blockiert: ab dann den aktuellen Zonenfehler unten anzeigen. */
  const [zoneSubmitBlocked, setZoneSubmitBlocked] = useState(false);

  const isHits = scoringMode === "HITS";
  const isZones = scoringMode === "ZONES";
  const programZonesError = isZones ? draftError(programZones) : null;
  const zoneError = (() => {
    if (!isZones) return null;
    if (programZonesError) return `Programm-Zonen: ${programZonesError}`;
    for (const [i, st] of stages.entries()) {
      const err = st.ownZones ? draftError(st.ownZones) : null;
      if (err) return `${st.name || `Serie ${i + 1}`}: ${err}`;
    }
    return null;
  })();

  /** Serien so, wie sie gespeichert werden (Zonen aufgelöst, bei Treffer/Fehler maxPerShot = 1). */
  const resolvedStages: Stage[] = stages.map(({ ownZones, ...s }) => {
    if (isZones) {
      const zones = fromDrafts(ownZones ?? programZones);
      const valid = zones.filter((z) => Number.isFinite(z.points));
      return { ...s, zones, maxPerShot: Math.max(1, ...valid.map((z) => z.points)) };
    }
    return { ...s, maxPerShot: isHits ? 1 : s.maxPerShot };
  });
  const totals = programTotals(
    resolvedStages.map((s) => (s.zones ? { ...s, zones: s.zones.filter((z) => Number.isFinite(z.points)) } : s)),
    scoringMode,
  );

  const update = (i: number, patch: Partial<FormStage>) => setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
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

  const submit = submitKeepingValues(action);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (zoneError) {
      e.preventDefault();
      setZoneSubmitBlocked(true);
      return;
    }
    setZoneSubmitBlocked(false);
    submit(e);
  };

  // Live statt Momentaufnahme: verschwindet, sobald die Zonen korrigiert sind
  const clientError = zoneSubmitBlocked ? zoneError : null;
  const toggleOwnZones = (i: number, on: boolean) => update(i, { ownZones: on ? programZones.map((z) => ({ ...z })) : undefined });
  const simpleInputs = isHits || isZones;
  const mode = SCORING_MODES.find((m) => m.key === scoringMode);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="scope" value={scope} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="stagesJson" value={JSON.stringify(resolvedStages)} />
      {initial && openMatches > 0 ? (
        <Alert tone="warn" title="Programm wird gerade verwendet">
          {openMatches === 1 ? "1 offener Durchgang verwendet" : `${openMatches} offene Durchgänge verwenden`} dieses Programm. Bereits erfasste Schüsse bleiben erhalten; geänderte Zonen, Wertung oder Serien gelten aber ab sofort auch dort. Für grössere Änderungen besser das Programm kopieren.
        </Alert>
      ) : null}

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
        {mode ? <p className="-mt-2 text-xs text-ink-3">{mode.hint}</p> : null}
        <Field label="Waffe genauer (optional)"><Input name="weaponNote" defaultValue={initial?.weaponNote ?? ""} placeholder="z.B. Sportpistole .22, Ordonnanz" /></Field>
        <Field label="Beschreibung (optional)"><Textarea name="description" defaultValue={initial?.description ?? ""} placeholder="Ablauf, Regeln, Hinweise" /></Field>
      </Card>

      {isZones ? (
        <Card className="animate-rise p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Trefferzonen</h2>
            <p className="text-xs text-ink-3">Gelten für alle Serien. Einzelne Serien können eigene Zonen haben.</p>
          </div>
          <ZoneEditor idPrefix="program-zones" zones={programZones} onChange={setProgramZones} />
        </Card>
      ) : null}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Serien / Stationen</h2>
          <span className="text-xs text-ink-3 tabular-nums">{totals.shots} Schuss · max. {zoneError ? "–" : totals.max} {isHits ? "Treffer" : "Punkte"}</span>
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
                <button type="button" onClick={() => duplicate(i)} className="press h-11 w-11 shrink-0 rounded-full hover:bg-surface-2 text-ink-3 flex items-center justify-center" aria-label="Duplizieren"><Copy className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(i)} disabled={stages.length === 1} className="press h-11 w-11 shrink-0 rounded-full hover:bg-accent-soft text-ink-3 hover:text-accent disabled:opacity-30 flex items-center justify-center" aria-label="Entfernen"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Distanz (m)"><Input type="number" inputMode="decimal" step="0.5" min={0.5} value={s.distanceM} onChange={(e) => update(i, { distanceM: Number(e.target.value) })} /></Field>
                <Field label="Schüsse"><Input type="number" inputMode="numeric" min={1} max={200} value={s.shots} onChange={(e) => update(i, { shots: Number(e.target.value) })} /></Field>
                {simpleInputs ? (
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
                {simpleInputs ? (
                  <Field label="Scheibe / Ziel"><Input value={s.targetName ?? ""} onChange={(e) => update(i, { targetName: e.target.value })} placeholder="z.B. Stahlplatte" /></Field>
                ) : (
                  <Field label="Zeit (s, optional)"><Input type="number" inputMode="numeric" min={0} value={s.timeLimitSec ?? ""} onChange={(e) => update(i, { timeLimitSec: e.target.value ? Number(e.target.value) : undefined })} placeholder="–" /></Field>
                )}
              </div>
              {!simpleInputs ? (
                <div className="mt-3"><Field label="Scheibe (optional)"><Input value={s.targetName ?? ""} onChange={(e) => update(i, { targetName: e.target.value })} placeholder="z.B. Präzisionsscheibe 25 m" /></Field></div>
              ) : null}
              <div className="mt-3"><Field label="Hinweis (optional)"><Input value={s.note ?? ""} onChange={(e) => update(i, { note: e.target.value })} placeholder="z.B. hinter Deckung, Magazinwechsel" /></Field></div>
              {isZones ? (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  <Switch checked={!!s.ownZones} onChange={(on) => toggleOwnZones(i, on)} label="Eigene Zonen für diese Serie" description={s.ownZones ? undefined : "Sonst gelten die Trefferzonen des Programms."} />
                  {s.ownZones ? (
                    <ZoneEditor idPrefix={`stage-${i}-zones`} zones={s.ownZones} onChange={(next) => update(i, { ownZones: next })} />
                  ) : (
                    <ZoneLegend zones={fromDrafts(programZones).filter((z) => Number.isFinite(z.points))} compact />
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={add} className="mt-3 w-full"><Plus className="h-4 w-4" /> Serie hinzufügen</Button>
      </div>

      {clientError ? <Alert>{clientError}</Alert> : state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton pending={pending} size="lg" className="w-full shadow-lg" pendingText="Speichern…">{initial ? "Änderungen speichern" : "Programm anlegen"}</SubmitButton>
      </div>
    </form>
  );
}
