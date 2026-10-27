"use client";

import { useActionState, startTransition } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { saveAnnouncementAction } from "../actions";

export type AnnouncementDefaults = { id?: string; title: string; body: string; pinned: boolean; expiresOn: string };

export function AnnouncementForm({ initial, minDate }: { initial: AnnouncementDefaults; minDate: string }) {
  const [state, formAction, isPending] = useActionState(saveAnnouncementAction, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card className="animate-rise p-4 space-y-4">
        <Field label="Titel" error={fe.title}><Input name="title" defaultValue={initial.title} maxLength={140} required placeholder="z.B. Neue Öffnungszeiten im Winter" /></Field>
        <Field label="Mitteilung" hint="Zeilenumbrüche bleiben erhalten, Links werden klickbar." error={fe.body}>
          <Textarea name="body" defaultValue={initial.body} maxLength={5000} required className="min-h-36" placeholder="Was sollen alle wissen?" />
        </Field>
      </Card>
      <Card className="animate-rise p-4 space-y-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="pinned" defaultChecked={initial.pinned} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--ink)]" />
          <span><span className="block text-[15px] font-medium">Oben anheften</span><span className="block text-xs text-ink-3">Wichtige Mitteilungen bleiben zuoberst sichtbar.</span></span>
        </label>
        <Field label="Sichtbar bis (optional)" hint="Danach wird die Mitteilung automatisch ausgeblendet." error={fe.expiresOn}>
          <Input name="expiresOn" type="date" defaultValue={initial.expiresOn} min={minDate} />
        </Field>
      </Card>
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <><Spinner /> Speichern…</> : initial.id ? "Änderungen speichern" : "Mitteilung veröffentlichen"}
      </Button>
    </form>
  );
}
