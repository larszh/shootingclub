"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addBlockAction, deleteBlockAction, deleteResourceAction, setResourceActiveAction } from "@/modules/bookings/actions";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";

export function BlockForm({ resources, today }: { resources: Array<{ id: string; name: string }>; today: string }) {
  const [state, action, pending] = useActionState(addBlockAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  // Nach erfolgreichem Anlegen auf die Vorgabewerte zurücksetzen; bei Fehlern bleiben die Eingaben stehen.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label="Betrifft"><Select name="resourceId" defaultValue=""><option value="">Alle Ressourcen</option>{resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von (Datum)"><Input name="date" type="date" defaultValue={today} required /></Field>
          <Field label="Von (Zeit)"><Input name="from" type="time" defaultValue="00:00" required /></Field>
          <Field label="Bis (Datum)" hint="leer = gleicher Tag"><Input name="toDate" type="date" /></Field>
          <Field label="Bis (Zeit)"><Input name="to" type="time" defaultValue="23:59" required /></Field>
        </div>
        <Field label="Grund (optional)"><Input name="reason" placeholder="z.B. Vereinsanlass, Unterhalt" /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm" pending={pending}>Sperrzeit anlegen</SubmitButton>
      </form>
    </Card>
  );
}

export function DeleteBlockButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => deleteBlockAction(id).then(() => undefined))} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>;
}

export function ResourceRowActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(() => setResourceActiveAction(id, !isActive).then(() => undefined))}>{isActive ? "Deaktivieren" : "Aktivieren"}</Button>
      <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: "Ressource löschen?", message: "Nur möglich ohne Buchungen.", tone: "danger", confirmLabel: "Löschen" }))) start(async () => { const r = await deleteResourceAction(id); if (!r.ok) toast.error(r.error); }); }} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
