"use client";

import { useState, useTransition } from "react";
import { Button, Card, Field, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { updateClosedDayAction } from "@/modules/range/actions";
import type { HalfDayFlags } from "@/modules/range/logic";
import { callAction } from "./action-call";

/** Halbtage und Notizen eines abgeschlossenen Tages korrigieren (range.manage, wird protokolliert). */
export function DayCorrection({ dayId, flags, notes }: { dayId: string; flags: HalfDayFlags; notes: string | null }) {
  const [f, setF] = useState(flags);
  const [text, setText] = useState(notes ?? "");
  const [pending, start] = useTransition();
  const dirty = f.usedAm !== flags.usedAm || f.usedPm !== flags.usedPm || f.usedEvening !== flags.usedEvening || text !== (notes ?? "");
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">Halbtage korrigieren</h2>
      <Switch checked={f.usedAm} onChange={(v) => setF((x) => ({ ...x, usedAm: v }))} label="Vormittag" description="vor 12:00" />
      <Switch checked={f.usedPm} onChange={(v) => setF((x) => ({ ...x, usedPm: v }))} label="Nachmittag" description="12:00–18:00" />
      <Switch checked={f.usedEvening} onChange={(v) => setF((x) => ({ ...x, usedEvening: v }))} label="Abend" description="ab 18:00" />
      <Field label="Notizen"><Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} rows={3} /></Field>
      <div className="flex justify-end">
        <Button disabled={!dirty || pending} onClick={() => start(async () => { await callAction(() => updateClosedDayAction(dayId, { ...f, notes: text })); })}>
          {pending ? <Spinner /> : null} Korrektur speichern
        </Button>
      </div>
      <p className="text-xs text-ink-3">Änderungen werden im Protokoll festgehalten.</p>
    </Card>
  );
}
