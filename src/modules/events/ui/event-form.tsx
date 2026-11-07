"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/time";
import { saveEventAction } from "../actions";
import { EVENT_KINDS, EVENT_KIND_META, MAX_RECURRENCE, recurrenceDates, type EventKind } from "../types";
import { KindIcon } from "./bits";
import { WritingAssistant, type WritingAvailability } from "@/modules/ai/content/ui/writing-assistant";
import { useLocale, useT } from "@/components/locale";
import { localizeMessage } from "@/modules/billing/ui/i18n";
import { kindLabel } from "./i18n";

export type EventFormDefaults = {
  id?: string;
  title: string;
  kind: EventKind;
  date: string;
  allDay: boolean;
  timeFrom: string;
  timeTo: string;
  endDate: string;
  location: string;
  description: string;
  rsvpEnabled: boolean;
  capacity: string;
  deadlineDate: string;
  deadlineTime: string;
};

function Toggle({ name, checked, onChange, title, text }: { name: string; checked: boolean; onChange: (v: boolean) => void; title: string; text?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--ink)]" />
      <span>
        <span className="block text-[15px] font-medium">{title}</span>
        {text ? <span className="block text-xs text-ink-3">{text}</span> : null}
      </span>
    </label>
  );
}

function Segmented<T extends string>({ name, value, onChange, options }: { name: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="grid gap-1 rounded-control bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <input type="hidden" name={name} value={value} />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn("press h-10 rounded-[0.6rem] px-2 text-sm font-medium", value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EventForm({ initial, mode, writing }: { initial: EventFormDefaults; mode: "create" | "edit" | "copy"; /** Schreibhilfe mit Claude (null = ausgeblendet) */ writing?: WritingAvailability | null }) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(saveEventAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [kind, setKind] = useState<EventKind>(initial.kind);
  const [date, setDate] = useState(initial.date);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [rsvp, setRsvp] = useState(initial.rsvpEnabled);
  const [repeat, setRepeat] = useState<"NONE" | "WEEKLY" | "BIWEEKLY">("NONE");
  const [repeatMode, setRepeatMode] = useState<"COUNT" | "UNTIL">("COUNT");
  const [repeatCount, setRepeatCount] = useState("8");
  const [repeatUntil, setRepeatUntil] = useState("");
  // Prüfmeldungen kommen Deutsch vom Server bzw. aus types.ts
  const fe: Record<string, string> = Object.fromEntries(Object.entries(state && !state.ok ? (state.fieldErrors ?? {}) : {}).map(([k, v]) => [k, localizeMessage(v, locale)]));
  const canRepeat = mode !== "edit";

  const preview = canRepeat && repeat !== "NONE" && date
    ? recurrenceDates({ date, repeat, repeatMode, repeatCount: Number(repeatCount) || undefined, repeatUntil: repeatUntil || undefined })
    : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="kind" value={kind} />

      {writing ? (
        <WritingAssistant
          kind="event"
          availability={writing}
          getCurrent={() => ({ title, text: description })}
          getFacts={() => {
            const fd = formRef.current ? new FormData(formRef.current) : null;
            const get = (k: string) => { const v = fd?.get(k); return typeof v === "string" ? v : ""; };
            return {
              kind: kindLabel(kind, locale),
              date: date ? fmtDay(date) : "",
              time: allDay ? "" : [get("timeFrom"), get("timeTo")].filter(Boolean).join("–"),
              location: get("location"),
            };
          }}
          onApply={(v) => { if (v.title) setTitle(v.title.slice(0, 120)); setDescription(v.text.slice(0, 5000)); }}
        />
      ) : null}

      <Card className="animate-rise p-4 space-y-4">
        <Field label={t("money.events.form.title")} error={fe.title}>
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder={t("money.events.form.titlePh")} autoFocus={mode === "create"} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">{t("money.events.form.kind")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EVENT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={cn("press flex h-12 items-center gap-2 rounded-control border px-3 text-sm font-medium",
                  kind === k ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", kind === k ? "bg-bg/15" : EVENT_KIND_META[k].chip)}><KindIcon kind={k} className="h-3.5 w-3.5" /></span>
                <span className="truncate">{kindLabel(k, locale)}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <Field label={allDay ? t("money.events.form.dateFirst") : t("money.events.form.date")} error={fe.date}>
          <Input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Toggle name="allDay" checked={allDay} onChange={setAllDay} title={t("money.events.form.allDay")} text={t("money.events.form.allDayText")} />
        {allDay ? (
          <Field label={t("money.events.form.endDate")} hint={t("money.events.form.endDateHint")} error={fe.endDate}>
            <Input name="endDate" type="date" defaultValue={initial.endDate} min={date || undefined} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("money.events.form.from")} error={fe.timeFrom}><Input name="timeFrom" type="time" defaultValue={initial.timeFrom} required step={300} /></Field>
            <Field label={t("money.events.form.to")} error={fe.timeTo}><Input name="timeTo" type="time" defaultValue={initial.timeTo} step={300} /></Field>
          </div>
        )}
        <Field label={t("money.events.form.location")} error={fe.location}>
          <Input name="location" defaultValue={initial.location} maxLength={160} placeholder={t("money.events.form.locationPh")} />
        </Field>
        <Field label={t("money.events.form.description")} hint={t("money.events.form.descriptionHint")} error={fe.description}>
          <Textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} className="min-h-28" placeholder={t("money.events.form.descriptionPh")} />
        </Field>
      </Card>

      <Card className="animate-rise p-4 space-y-4">
        <Toggle name="rsvpEnabled" checked={rsvp} onChange={setRsvp} title={t("money.events.form.rsvp")} text={t("money.events.form.rsvpText")} />
        {rsvp ? (
          <>
            <Field label={t("money.events.form.capacity")} hint={t("money.events.form.capacityHint")} error={fe.capacity}>
              <Input name="capacity" type="number" inputMode="numeric" min={1} max={10000} defaultValue={initial.capacity} placeholder={t("money.events.form.capacityPh")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("money.events.form.deadline")} error={fe.deadlineDate}><Input name="deadlineDate" type="date" defaultValue={initial.deadlineDate} max={date ? (allDay ? addDays(date, -1) : date) : undefined} /></Field>
              <Field label={t("money.events.form.deadlineTime")} error={fe.deadlineTime}><Input name="deadlineTime" type="time" defaultValue={initial.deadlineTime || "23:59"} /></Field>
            </div>
          </>
        ) : null}
      </Card>

      {canRepeat ? (
        <Card className="animate-rise p-4 space-y-4">
          <div>
            <p className="text-[15px] font-medium">{t("money.events.form.repeat")}</p>
            <p className="text-xs text-ink-3">{t("money.events.form.repeatText")}</p>
          </div>
          <Segmented name="repeat" value={repeat} onChange={setRepeat} options={(["NONE", "WEEKLY", "BIWEEKLY"] as const).map((v) => ({ value: v, label: t(`money.events.form.repeat.${v}`) }))} />
          {repeat !== "NONE" ? (
            <>
              <Segmented name="repeatMode" value={repeatMode} onChange={setRepeatMode} options={(["COUNT", "UNTIL"] as const).map((v) => ({ value: v, label: t(`money.events.form.repeatMode.${v}`) }))} />
              {repeatMode === "COUNT" ? (
                <Field label={t("money.events.form.repeatCount")} hint={t("money.events.form.repeatCountHint", { max: MAX_RECURRENCE })} error={fe.repeatCount}>
                  <Input name="repeatCount" type="number" inputMode="numeric" min={2} max={MAX_RECURRENCE} value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} />
                </Field>
              ) : (
                <Field label={t("money.events.form.repeatUntil")} error={fe.repeatUntil}>
                  <Input name="repeatUntil" type="date" min={date || undefined} value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
                </Field>
              )}
              {preview && Array.isArray(preview) ? (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  {t("money.events.form.preview", { n: preview.length, from: fmtDay(preview[0]!), to: fmtDay(preview[preview.length - 1]!) })}
                </p>
              ) : preview && !Array.isArray(preview) ? (
                <p className="text-sm text-warn">{localizeMessage(preview.error, locale)}</p>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}

      {state && !state.ok ? <Alert>{localizeMessage(state.error, locale)}</Alert> : null}
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <><Spinner /> {t("money.events.form.saving")}</> : mode === "edit" ? t("money.events.form.saveChanges") : repeat !== "NONE" && canRepeat ? t("money.events.form.createSeries") : t("money.events.form.create")}
      </Button>
    </form>
  );
}

function fmtDay(d: string) {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}
