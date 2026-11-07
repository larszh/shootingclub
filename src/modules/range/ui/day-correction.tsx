"use client";

import { useState, useTransition } from "react";
import { Button, Card, Field, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { updateClosedDayAction } from "@/modules/range/actions";
import type { HalfDayFlags } from "@/modules/range/logic";
import { callAction } from "./action-call";
import { useT } from "@/components/locale";

/** Halbtage und Notizen eines abgeschlossenen Tages korrigieren (range.manage, wird protokolliert). */
export function DayCorrection({ dayId, flags, notes }: { dayId: string; flags: HalfDayFlags; notes: string | null }) {
  const [f, setF] = useState(flags);
  const [text, setText] = useState(notes ?? "");
  const [pending, start] = useTransition();
  const t = useT();
  const dirty = f.usedAm !== flags.usedAm || f.usedPm !== flags.usedPm || f.usedEvening !== flags.usedEvening || text !== (notes ?? "");
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">{t("adm2.range.correct.title")}</h2>
      <Switch checked={f.usedAm} onChange={(v) => setF((x) => ({ ...x, usedAm: v }))} label={t("adm2.range.board.am")} description={t("adm2.range.board.amHint")} />
      <Switch checked={f.usedPm} onChange={(v) => setF((x) => ({ ...x, usedPm: v }))} label={t("adm2.range.board.pm")} description="12:00–18:00" />
      <Switch checked={f.usedEvening} onChange={(v) => setF((x) => ({ ...x, usedEvening: v }))} label={t("adm2.range.board.evening")} description={t("adm2.range.board.eveningHint")} />
      <Field label={t("adm2.common.notes")}><Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} rows={3} /></Field>
      <div className="flex justify-end">
        <Button disabled={!dirty || pending} onClick={() => start(async () => { await callAction(() => updateClosedDayAction(dayId, { ...f, notes: text })); })}>
          {pending ? <Spinner /> : null} {t("adm2.range.correct.save")}
        </Button>
      </div>
      <p className="text-xs text-ink-3">{t("adm2.common.auditHint")}</p>
    </Card>
  );
}
