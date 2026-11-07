"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Field, Input, SectionTitle } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { deleteProductAction, saveProductAction, setProductActiveAction } from "@/modules/kiosk/actions";
import { groupByCategory } from "@/modules/kiosk/logic";
import { CATEGORY_SUGGESTIONS } from "@/modules/kiosk/types";
import { useT } from "@/components/locale";

export type AdminKioskProduct = { id: string; name: string; category: string | null; priceCents: number; isActive: boolean; sortOrder: number };

export function KioskProductManager({ products, currency }: { products: AdminKioskProduct[]; currency: string }) {
  const t = useT();
  const [editing, setEditing] = useState<AdminKioskProduct | null>(null);
  const [state, action, saving] = useActionState(async (prev: Awaited<ReturnType<typeof saveProductAction>> | null, fd: FormData) => {
    const r = await saveProductAction(prev, fd);
    if (r.ok && fd.get("id")) setEditing(null);
    return r;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const catList = useId();
  const categories = [...new Set([...CATEGORY_SUGGESTIONS, ...products.map((p) => p.category).filter((c): c is string => !!c)])];

  useEffect(() => {
    if (state?.ok && !editing) formRef.current?.reset();
  }, [state, editing]);

  const err = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form ref={formRef} key={editing?.id ?? "new"} onSubmit={submitKeepingValues(action)} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editing ? t("adm1.cat.editTitle", { name: editing.name }) : t("adm1.prod.new")}</h2>
            {editing ? (
              <button type="button" onClick={() => setEditing(null)} className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={t("adm1.cat.stopEditing")}>
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("adm1.common.name")} error={err?.name}><Input name="name" defaultValue={editing?.name ?? ""} required maxLength={191} placeholder={t("adm1.prod.namePlaceholder")} /></Field>
            <Field label={t("adm1.members.col.category")} hint={t("adm1.prod.categoryHint")} error={err?.category}><Input name="category" list={catList} defaultValue={editing?.category ?? ""} maxLength={191} placeholder={t("adm1.prod.categoryPlaceholder")} /></Field>
          </div>
          <datalist id={catList}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("adm1.prod.price", { currency })} error={err?.price}><Input name="price" inputMode="decimal" defaultValue={editing ? (editing.priceCents / 100).toFixed(2) : ""} required placeholder="0.00" /></Field>
            <Field label={t("adm1.prod.sortOrder")} error={err?.sortOrder}><Input name="sortOrder" inputMode="numeric" defaultValue={editing?.sortOrder ?? 0} /></Field>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="isActive" value="on" defaultChecked={editing?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" />
            <span className="text-sm font-medium">{t("adm1.prod.active")}</span>
          </label>
          <input type="hidden" name="isActive" value="off" />
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton pending={saving}>{editing ? t("adm1.common.save") : <><Plus className="h-4 w-4" /> {t("adm1.cat.create")}</>}</SubmitButton>
        </form>
      </Card>

      {products.length === 0 ? (
        <EmptyState icon={<Plus className="h-5 w-5" />} title={t("adm1.prod.emptyTitle")} text={t("adm1.prod.emptyText")} />
      ) : (
        groupByCategory(products).map((g) => (
          <section key={g.category}>
            <SectionTitle>{g.category === "Weitere" ? t("adm1.prod.otherCategory") : g.category}</SectionTitle>
            <Card className="animate-rise divide-y divide-line overflow-hidden">
              {g.items.map((p) => <ProductRow key={p.id} p={p} currency={currency} onEdit={() => { setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
            </Card>
          </section>
        ))
      )}
      {products.length ? <p className="text-xs text-ink-3">{t("adm1.prod.priceNote")}</p> : null}
    </div>
  );
}

function ProductRow({ p, currency, onEdit }: { p: AdminKioskProduct; currency: string; onEdit: () => void }) {
  const t = useT();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? t("adm1.common.failed"));
        else if (r.message) toast.success(r.message);
      } catch {
        toast.error(t("adm1.common.offline"));
      }
    });
  }

  return (
    <div className="flex min-h-14 items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {p.name}
          {!p.isActive ? <Badge tone="outline">{t("adm1.prod.hidden")}</Badge> : null}
        </div>
        <div className="text-xs text-ink-3">{formatMoney(p.priceCents, currency)} · {t("adm1.prod.sortOrder")} {p.sortOrder}</div>
      </div>
      <button type="button" onClick={onEdit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label={t("adm1.prod.editLabel", { name: p.name })}><Pencil className="h-4 w-4" /></button>
      <button type="button" disabled={pending} onClick={() => run(() => setProductActiveAction(p.id, !p.isActive))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label={t(p.isActive ? "adm1.prod.hideLabel" : "adm1.prod.showLabel", { name: p.name })}>
        {p.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const okay = await confirmDialog({ title: t("adm1.prod.deleteTitle", { name: p.name }), message: t("adm1.prod.deleteMessage"), tone: "danger", confirmLabel: t("adm1.common.delete") });
          if (okay) run(() => deleteProductAction(p.id));
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-danger/10 hover:text-danger"
        aria-label={t("adm1.prod.deleteLabel", { name: p.name })}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
