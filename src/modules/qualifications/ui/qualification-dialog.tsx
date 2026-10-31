"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";
import { deleteQualificationAction, saveQualificationAction } from "@/modules/qualifications/actions";
import { QUALIFICATION_KINDS } from "@/modules/qualifications/types";

export type QualificationValues = {
  id?: string; userId: string; kind: string; label: string | null; number: string | null; validFrom: string | null; validUntil: string | null; note: string | null;
};

/** Knopf «Qualifikation erfassen» bzw. «Bearbeiten» mit Dialog. */
export function QualificationButton({ members, initial, defaultUserId }: { members: Array<{ userId: string; name: string }>; initial?: QualificationValues; defaultUserId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {initial?.id ? (
        <Button variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Bearbeiten" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Erfassen</Button>
      )}
      {open ? <QualificationDialog members={members} initial={initial} defaultUserId={defaultUserId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QualificationDialog({ members, initial, defaultUserId, onClose }: { members: Array<{ userId: string; name: string }>; initial?: QualificationValues; defaultUserId?: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await saveQualificationAction(prev, fd);
    if (r.ok) {
      toast.success(r.message ?? "Gespeichert.");
      onClose();
    }
    return r;
  }, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open onClose={onClose} title={initial?.id ? "Qualifikation bearbeiten" : "Qualifikation erfassen"} description="Ausweis bzw. Bestätigung bitte im Original prüfen." size="lg">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3 pb-2">
        {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        <Field label="Mitglied" error={err?.userId}>
          <Select name="userId" defaultValue={initial?.userId ?? defaultUserId ?? ""} required>
            <option value="" disabled>Bitte wählen</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Art" error={err?.kind}>
          <Select name="kind" defaultValue={initial?.kind ?? "SCHUETZENMEISTER"} required>
            {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
        </Field>
        <Field label="Bezeichnung" hint="optional, z.B. «Pistole 25 m» oder Kursname" error={err?.label}><Input name="label" defaultValue={initial?.label ?? ""} maxLength={191} /></Field>
        <Field label="Ausweis-Nummer" hint="optional (keine AHV-Nummer erfassen)" error={err?.number}><Input name="number" defaultValue={initial?.number ?? ""} maxLength={191} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gültig ab" error={err?.validFrom}><Input type="date" name="validFrom" defaultValue={initial?.validFrom ?? ""} /></Field>
          <Field label="Gültig bis" hint="leer = unbefristet" error={err?.validUntil}><Input type="date" name="validUntil" defaultValue={initial?.validUntil ?? ""} /></Field>
        </div>
        <Field label="Notiz" error={err?.note}><Input name="note" defaultValue={initial?.note ?? ""} maxLength={191} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">{initial?.id ? "Speichern" : "Erfassen"}</SubmitButton>
      </form>
    </Dialog>
  );
}

export function DeleteQualificationButton({ id, label }: { id: string; label: string }) {
  return (
    <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0 text-danger" aria-label={`${label} löschen`} action={() => deleteQualificationAction(id)} refresh
      confirm={{ title: `${label} löschen?`, message: "Die Qualifikation wird entfernt (Protokoll bleibt).", confirmLabel: "Löschen", tone: "danger" }}>
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}
