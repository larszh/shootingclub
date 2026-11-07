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
import { QUALIFICATION_KINDS, qualificationLabel } from "@/modules/qualifications/types";
import { useT } from "@/components/locale";

export type QualificationValues = {
  id?: string; userId: string; kind: string; label: string | null; number: string | null; validFrom: string | null; validUntil: string | null; note: string | null;
};

/** Knopf «Qualifikation erfassen» bzw. «Bearbeiten» mit Dialog. */
export function QualificationButton({ members, initial, defaultUserId }: { members: Array<{ userId: string; name: string }>; initial?: QualificationValues; defaultUserId?: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      {initial?.id ? (
        <Button variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label={t("adm2.qual.edit")} onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("adm2.qual.add")}</Button>
      )}
      {open ? <QualificationDialog members={members} initial={initial} defaultUserId={defaultUserId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QualificationDialog({ members, initial, defaultUserId, onClose }: { members: Array<{ userId: string; name: string }>; initial?: QualificationValues; defaultUserId?: string; onClose: () => void }) {
  const t = useT();
  const [state, action, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await saveQualificationAction(prev, fd);
    if (r.ok) {
      toast.success(r.message ?? t("adm2.common.saved"));
      onClose();
    }
    return r;
  }, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open onClose={onClose} title={initial?.id ? t("adm2.qual.dlg.edit") : t("adm2.qual.dlg.add")} description={t("adm2.qual.dlg.text")} size="lg">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3 pb-2">
        {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        <Field label={t("adm2.qual.dlg.member")} error={err?.userId}>
          <Select name="userId" defaultValue={initial?.userId ?? defaultUserId ?? ""} required>
            <option value="" disabled>{t("adm2.qual.dlg.choose")}</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label={t("adm2.qual.kind")} error={err?.kind}>
          <Select name="kind" defaultValue={initial?.kind ?? "SCHUETZENMEISTER"} required>
            {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{qualificationLabel(k.key, t)}</option>)}
          </Select>
        </Field>
        <Field label={t("adm2.qual.dlg.label")} hint={t("adm2.qual.dlg.labelHint")} error={err?.label}><Input name="label" defaultValue={initial?.label ?? ""} maxLength={191} /></Field>
        <Field label={t("adm2.qual.dlg.number")} hint={t("adm2.qual.dlg.numberHint")} error={err?.number}><Input name="number" defaultValue={initial?.number ?? ""} maxLength={191} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm2.qual.dlg.validFrom")} error={err?.validFrom}><Input type="date" name="validFrom" defaultValue={initial?.validFrom ?? ""} /></Field>
          <Field label={t("adm2.qual.dlg.validUntil")} hint={t("adm2.qual.dlg.untilHint")} error={err?.validUntil}><Input type="date" name="validUntil" defaultValue={initial?.validUntil ?? ""} /></Field>
        </div>
        <Field label={t("adm2.common.note")} error={err?.note}><Input name="note" defaultValue={initial?.note ?? ""} maxLength={191} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton pending={pending} className="w-full sm:w-auto">{initial?.id ? t("adm2.common.save") : t("adm2.qual.add")}</SubmitButton>
      </form>
    </Dialog>
  );
}

export function DeleteQualificationButton({ id, label }: { id: string; label: string }) {
  const t = useT();
  return (
    <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0 text-danger" aria-label={t("adm2.qual.del.aria", { label })} action={() => deleteQualificationAction(id)} refresh
      confirm={{ title: t("adm2.qual.del.q", { label }), message: t("adm2.qual.del.text"), confirmLabel: t("adm2.common.delete"), tone: "danger" }}>
      <Trash2 className="h-4 w-4" />
    </ActionButton>
  );
}
