"use client";

import { useActionState, useRef, useState } from "react";
import { Clock, Plus } from "lucide-react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";
import { addWorkLogForMemberAction, submitWorkLogAction } from "@/modules/shifts/actions";

/**
 * «Stunden erfassen»: Mitglied meldet geleistete Arbeit (muss bewilligt werden).
 * Mit `members` (Verwaltung): für ein Mitglied erfassen, gilt sofort als bewilligt.
 */
export function WorkLogForm({ today, members }: { today: string; members?: Array<{ userId: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const serverAction = members ? addWorkLogForMemberAction : submitWorkLogAction;
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await serverAction(prev, fd);
    if (r.ok) {
      toast.success(r.message ?? "Erfasst.");
      formRef.current?.reset();
    }
    return r;
  }, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  if (!open) {
    return <Button variant={members ? "secondary" : "primary"} onClick={() => setOpen(true)} className="w-full sm:w-auto"><Plus className="h-4 w-4" /> {members ? "Stunden für Mitglied erfassen" : "Stunden erfassen"}</Button>;
  }

  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <h3 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> {members ? "Stunden für Mitglied erfassen" : "Stunden erfassen"}</h3>
        {members ? (
          <Field label="Mitglied" error={err?.userId}>
            <Select name="userId" defaultValue="" required>
              <option value="" disabled>Bitte wählen</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum" error={err?.date}><Input type="date" name="date" defaultValue={today} max={today} required /></Field>
          <Field label="Stunden" error={err?.hours}><Input name="hours" inputMode="decimal" placeholder="z.B. 2.5" required /></Field>
        </div>
        <Field label="Was wurde gemacht?" error={err?.description}><Input name="description" maxLength={191} placeholder="z.B. Scheibenstand gestrichen" required /></Field>
        {!members ? <p className="text-xs text-ink-3">Die Stunden zählen, sobald der Vorstand sie bewilligt hat.</p> : <p className="text-xs text-ink-3">Gilt sofort als bewilligt.</p>}
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending}>Speichern</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Schliessen</Button>
        </div>
      </form>
    </Card>
  );
}
