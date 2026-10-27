"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addBlockAction, deleteBlockAction, deleteResourceAction, setResourceActiveAction } from "@/modules/bookings/actions";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";

export function BlockForm({ resources, today }: { resources: Array<{ id: string; name: string }>; today: string }) {
  const [state, action] = useActionState(addBlockAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <Field label="Betrifft"><Select name="resourceId" defaultValue=""><option value="">Alle Ressourcen</option>{resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von (Datum)"><Input name="date" type="date" defaultValue={today} required /></Field>
          <Field label="Von (Zeit)"><Input name="from" type="time" defaultValue="00:00" required /></Field>
          <Field label="Bis (Datum)" hint="leer = gleicher Tag"><Input name="toDate" type="date" /></Field>
          <Field label="Bis (Zeit)"><Input name="to" type="time" defaultValue="23:59" required /></Field>
        </div>
        <Field label="Grund (optional)"><Input name="reason" placeholder="z.B. Vereinsanlass, Unterhalt" /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Sperrzeit anlegen</SubmitButton>
      </form>
    </Card>
  );
}

export function DeleteBlockButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => deleteBlockAction(id).then(() => undefined))} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>;
}

export function ResourceRowActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(() => setResourceActiveAction(id, !isActive).then(() => undefined))}>{isActive ? "Deaktivieren" : "Aktivieren"}</Button>
      <button type="button" disabled={pending} onClick={() => { if (confirm("Ressource löschen? Nur möglich ohne Buchungen.")) start(async () => { const r = await deleteResourceAction(id); if (!r.ok) alert(r.error); }); }} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
