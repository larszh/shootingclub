"use client";

import { useActionState, useState, useTransition } from "react";
import { FilePlus2, Send, Trash2 } from "lucide-react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues, Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { createRulesDraftAction, deleteRulesDraftAction, publishRulesAction, saveRulesDraftAction } from "@/modules/range/actions";
import { normalizeRulesBody } from "@/modules/range/types";
import { RulesBody } from "./rules-body";
import { callAction } from "./action-call";

export function NewRulesDraftButton({ hasActive }: { hasActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button size="lg" className="h-14 w-full" disabled={pending} onClick={() => start(async () => { await callAction(() => createRulesDraftAction()); })}>
      {pending ? <Spinner /> : <FilePlus2 className="h-5 w-5" />} {hasActive ? "Neue Version erstellen" : "Standordnung erfassen"}
    </Button>
  );
}

/** Entwurf der Standordnung bearbeiten, Vorschau, veröffentlichen. */
export function RulesEditor({ draft }: { draft: { id: string; version: number; title: string; body: string } }) {
  const [state, action, saving] = useActionState(saveRulesDraftAction, null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [pending, start] = useTransition();
  const dirty = title.trim() !== draft.title || normalizeRulesBody(body) !== normalizeRulesBody(draft.body);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  async function publish() {
    if (dirty) {
      await confirmDialog({ title: "Zuerst speichern", message: "Bitte den Entwurf speichern, bevor du ihn veröffentlichst." });
      return;
    }
    if (!(await confirmDialog({ title: `Version ${draft.version} veröffentlichen?`, message: "Sie gilt sofort. Alle Mitglieder müssen sie beim nächsten Check-in bestätigen.", confirmLabel: "Veröffentlichen" }))) return;
    start(async () => { await callAction(() => publishRulesAction(draft.id)); });
  }

  async function remove() {
    if (!(await confirmDialog({ title: "Entwurf löschen?", tone: "danger", confirmLabel: "Löschen" }))) return;
    start(async () => { await callAction(() => deleteRulesDraftAction(draft.id)); });
  }

  return (
    <Card className="animate-rise space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Entwurf · Version {draft.version}</h2>
        <Segmented size="sm" className="max-w-56" label="Ansicht" value={mode} onChange={setMode} options={[{ value: "edit", label: "Bearbeiten" }, { value: "preview", label: "Vorschau" }]} />
      </div>
      {mode === "edit" ? (
        <form onSubmit={submitKeepingValues(action)} className="space-y-3">
          <input type="hidden" name="id" value={draft.id} />
          <Field label="Titel" error={err?.title}><Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={191} required /></Field>
          <Field label="Text" hint="# Überschrift, ## Unterüberschrift, - Aufzählung, 1. Nummerierung, **fett**. Leerzeile = neuer Absatz." error={err?.body}>
            <Textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={16} maxLength={30000} className="font-mono text-sm" required />
          </Field>
          {state && !state.ok && !state.fieldErrors ? <Alert>{state.error}</Alert> : state?.ok ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton pending={saving} variant="secondary" className="w-full sm:w-auto">Entwurf speichern</SubmitButton>
        </form>
      ) : (
        <div className="rounded-control border border-line bg-surface-2 p-4">
          <h3 className="mb-3 text-lg font-semibold">{title}</h3>
          <RulesBody body={body} />
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="text-danger" onClick={remove} disabled={pending}><Trash2 className="h-4 w-4" /> Entwurf löschen</Button>
        <Button onClick={publish} disabled={pending}>{pending ? <Spinner /> : <Send className="h-4 w-4" />} Veröffentlichen</Button>
      </div>
    </Card>
  );
}
