"use client";

import { useActionState, useEffect, useRef } from "react";
import { Handshake, Pause, Play, Trash2 } from "lucide-react";
import { Alert, Badge, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { Switch } from "@/components/ui/controls";
import { ActionButton } from "@/components/ui/action-button";
import { useT } from "@/components/locale";
import { revokeResourceShareAction, saveResourceShareAction, setShareCanBookAction } from "@/modules/sharing/actions";
import { PRICE_FACTOR_MAX, PRICE_FACTOR_MIN, partnerRateLabel } from "@/modules/sharing/logic";

/** Formular «Mit Partnerverein teilen» (gleicher Partner nochmals = Freigabe aktualisieren). */
export function ShareForm({ resourceId }: { resourceId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveResourceShareAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <input type="hidden" name="resourceId" value={resourceId} />
        <Field label={t("misc.share.form.partner")} hint={t("misc.share.form.partnerHint")}>
          <Input name="partner" required minLength={2} maxLength={64} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t("misc.share.form.partnerPlaceholder")} />
        </Field>
        <Field label={t("misc.share.form.factor")} hint={t("misc.share.form.factorHint")}>
          <Input name="priceFactorPercent" type="number" inputMode="numeric" min={PRICE_FACTOR_MIN} max={PRICE_FACTOR_MAX} step={1} defaultValue={100} required />
        </Field>
        <Field label={t("misc.share.form.note")} hint={t("misc.share.form.noteHint")}>
          <Input name="note" maxLength={191} />
        </Field>
        <Switch name="canBook" defaultChecked label={t("misc.share.form.canBook")} description={t("misc.share.form.canBookHint")} />
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} className="w-full"><Handshake className="h-4 w-4" /> {t("misc.share.form.submit")}</SubmitButton>
      </form>
    </Card>
  );
}

export type ShareRowDto = { id: string; partnerName: string; partnerSlug: string; city: string | null; canBook: boolean; priceFactorPercent: number; note: string | null; deleted: boolean };

export function ShareList({ shares }: { shares: ShareRowDto[] }) {
  const t = useT();
  if (!shares.length) return <p className="text-sm text-ink-3">{t("misc.share.list.empty")}</p>;
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {shares.map((s) => (
        <div key={s.id} className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium flex flex-wrap items-center gap-1.5">
                <span className="truncate">{s.partnerName}</span>
                {s.deleted ? <Badge tone="warn">{t("misc.share.list.deleted")}</Badge> : s.canBook ? <Badge tone="ok">{t("misc.share.list.bookable")}</Badge> : <Badge tone="outline">{t("misc.share.list.paused")}</Badge>}
              </div>
              <div className="text-xs text-ink-3">
                <span className="font-mono">{s.partnerSlug}</span>{s.city ? ` · ${s.city}` : ""} · {s.priceFactorPercent === 100 ? t("misc.share.list.samePrices") : partnerRateLabel(s.priceFactorPercent, t)}
              </div>
              {s.note ? <div className="text-xs text-ink-3 italic mt-0.5">«{s.note}»</div> : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton size="sm" variant="secondary" action={() => setShareCanBookAction(s.id, !s.canBook)}>
              {s.canBook ? <><Pause className="h-4 w-4" /> {t("misc.share.list.pause")}</> : <><Play className="h-4 w-4" /> {t("misc.share.list.allow")}</>}
            </ActionButton>
            <ActionButton size="sm" variant="ghost" className="text-ink-3"
              confirm={{ title: t("misc.share.list.removeTitle", { partner: s.partnerName }), message: t("misc.share.list.removeText"), tone: "danger", confirmLabel: t("misc.share.list.remove") }}
              action={() => revokeResourceShareAction(s.id)}>
              <Trash2 className="h-4 w-4" /> {t("misc.share.list.remove")}
            </ActionButton>
          </div>
        </div>
      ))}
    </Card>
  );
}
