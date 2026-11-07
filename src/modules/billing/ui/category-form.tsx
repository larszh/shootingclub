"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteCategoryAction, saveCategoryAction } from "@/modules/billing/actions";
import { Alert, Badge, Card, Field, Input } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { useT } from "@/components/locale";

type Cat = { id: string; name: string; amountCents: number; description: string | null; isActive: boolean; _count: { memberships: number } };

export function CategoryManager({ categories, currency }: { categories: Cat[]; currency: string }) {
  const t = useT();
  const [editing, setEditing] = useState<Cat | null>(null);
  const [state, action, saving] = useActionState(saveCategoryAction, null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // Nach erfolgreichem Anlegen das Formular leeren (beim Bearbeiten die gespeicherten Werte stehen lassen).
  useEffect(() => {
    if (state?.ok && !editing) formRef.current?.reset();
  }, [state, editing]);
  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form ref={formRef} key={editing?.id ?? "new"} onSubmit={submitKeepingValues(action)} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div className="flex items-center justify-between"><h3 className="font-semibold">{editing ? t("adm1.cat.editTitle", { name: editing.name }) : t("adm1.cat.new")}</h3>{editing ? <button type="button" onClick={() => setEditing(null)} className="-my-2 -mr-2 h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={t("adm1.cat.stopEditing")}><X className="h-4 w-4" /></button> : null}</div>
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <Field label={t("adm1.common.name")}><Input name="name" defaultValue={editing?.name ?? ""} required placeholder={t("adm1.cat.namePlaceholder")} /></Field>
            <Field label={t("adm1.cat.amount", { currency })}><Input name="amount" inputMode="decimal" defaultValue={editing ? (editing.amountCents / 100).toFixed(2) : ""} placeholder="0.00" /></Field>
          </div>
          <Field label={t("adm1.cat.description")}><Input name="description" defaultValue={editing?.description ?? ""} placeholder={t("adm1.cat.descriptionPlaceholder")} maxLength={191} /></Field>
          <label className="flex items-center gap-3"><input type="checkbox" name="isActive" value="on" defaultChecked={editing?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" /><span className="text-sm font-medium">{t("adm1.cat.active")}</span></label>
          <input type="hidden" name="isActive" value="off" />
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton size="sm" pending={saving}>{editing ? t("adm1.common.save") : t("adm1.cat.create")}</SubmitButton>
        </form>
      </Card>
      {categories.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium flex items-center gap-2">{c.name}{!c.isActive ? <Badge tone="warn">{t("adm1.member.inactiveSuffix")}</Badge> : null}</div>
                <div className="text-xs text-ink-3">{c.amountCents ? formatMoney(c.amountCents, currency) : t("adm1.cat.free")} · {t(c._count.memberships === 1 ? "adm1.hh.members.one" : "adm1.hh.members.other", { n: c._count.memberships })}{c.description ? ` · ${c.description}` : ""}</div>
              </div>
              <button type="button" onClick={() => setEditing(c)} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:bg-surface-2" aria-label={t("adm1.common.edit")}><Pencil className="h-4 w-4" /></button>
              <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: t("adm1.cat.deleteTitle", { name: c.name }), tone: "danger", confirmLabel: t("adm1.common.delete") }))) start(async () => { const r = await deleteCategoryAction(c.id); if (!r.ok) toast.error(r.error); }); }} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label={t("adm1.common.delete")}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
