"use client";

import { useActionState, useState, startTransition } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { saveAnnouncementAction } from "../actions";
import { WritingAssistant, type WritingAvailability } from "@/modules/ai/content/ui/writing-assistant";
import { useLocale, useT } from "@/components/locale";
import { localizeMessage } from "@/modules/billing/ui/i18n";

export type AnnouncementDefaults = { id?: string; title: string; body: string; pinned: boolean; expiresOn: string };

export function AnnouncementForm({ initial, minDate, writing }: { initial: AnnouncementDefaults; minDate: string; /** Schreibhilfe mit Claude (null = ausgeblendet) */ writing?: WritingAvailability | null }) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(saveAnnouncementAction, null);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  // Prüfmeldungen kommen Deutsch vom Server
  const fe: Record<string, string> = Object.fromEntries(Object.entries(state && !state.ok ? (state.fieldErrors ?? {}) : {}).map(([k, v]) => [k, localizeMessage(v, locale)]));
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {writing ? (
        <WritingAssistant
          kind="announcement"
          availability={writing}
          getCurrent={() => ({ title, text: body })}
          onApply={(v) => { if (v.title) setTitle(v.title.slice(0, 140)); setBody(v.text.slice(0, 5000)); }}
        />
      ) : null}
      <Card className="animate-rise p-4 space-y-4">
        <Field label={t("money.events.form.title")} error={fe.title}><Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required placeholder={t("money.events.form.annTitlePh")} /></Field>
        <Field label={t("money.events.form.annBody")} hint={t("money.events.form.annBodyHint")} error={fe.body}>
          <Textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required className="min-h-36" placeholder={t("money.events.form.annBodyPh")} />
        </Field>
      </Card>
      <Card className="animate-rise p-4 space-y-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="pinned" defaultChecked={initial.pinned} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--ink)]" />
          <span><span className="block text-[15px] font-medium">{t("money.events.form.annPinned")}</span><span className="block text-xs text-ink-3">{t("money.events.form.annPinnedText")}</span></span>
        </label>
        <Field label={t("money.events.form.annExpires")} hint={t("money.events.form.annExpiresHint")} error={fe.expiresOn}>
          <Input name="expiresOn" type="date" defaultValue={initial.expiresOn} min={minDate} />
        </Field>
      </Card>
      {state && !state.ok ? <Alert>{localizeMessage(state.error, locale)}</Alert> : null}
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <><Spinner /> {t("money.events.form.saving")}</> : initial.id ? t("money.events.form.saveChanges") : t("money.events.form.annPublish")}
      </Button>
    </form>
  );
}
