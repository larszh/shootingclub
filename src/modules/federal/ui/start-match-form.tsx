"use client";

import { useActionState } from "react";
import { Play } from "lucide-react";
import { Alert, Field, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { startFederalMatchAction } from "@/modules/federal/actions";
import { useT } from "@/components/locale";

type Props = {
  events: Array<{ id: string; label: string; yesCount: number }>;
  programs: Array<{ id: string; name: string; kindLabel: string; isOp?: boolean }>;
  defaultEventId?: string;
};

/** «Durchgang für Anlass starten»: Durchgang mit Anlass verknüpfen und Angemeldete übernehmen. */
export function StartFederalMatchForm({ events, programs, defaultEventId }: Props) {
  const [state, action, pending] = useActionState(startFederalMatchAction, null);
  const t = useT();
  if (!events.length) return <p className="text-sm text-ink-3">{t("adm2.federal.start.noEvents")}</p>;
  if (!programs.length) return <p className="text-sm text-ink-3">{t("adm2.federal.start.noPrograms")}</p>;
  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("adm2.federal.start.event")}>
          <Select name="eventId" defaultValue={defaultEventId ?? events[0]!.id} className="h-11">
            {events.map((e) => <option key={e.id} value={e.id}>{e.label}{e.yesCount ? t("adm2.federal.start.registered", { n: e.yesCount }) : ""}</option>)}
          </Select>
        </Field>
        <Field label={t("adm2.federal.start.program")}>
          <Select name="programId" defaultValue={programs.find((p) => p.isOp ?? p.kindLabel === "Obligatorisch")?.id ?? programs[0]!.id} className="h-11">
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kindLabel})</option>)}
          </Select>
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="takeRsvps" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
        {t("adm2.federal.start.takeRsvps")}
      </label>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="h-11" pendingText={t("adm2.federal.start.starting")}><Play className="h-4 w-4" aria-hidden /> {t("adm2.federal.start.submit")}</SubmitButton>
    </form>
  );
}
