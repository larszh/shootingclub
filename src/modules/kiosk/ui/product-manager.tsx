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

export type AdminKioskProduct = { id: string; name: string; category: string | null; priceCents: number; isActive: boolean; sortOrder: number };

export function KioskProductManager({ products, currency }: { products: AdminKioskProduct[]; currency: string }) {
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
            <h2 className="font-semibold">{editing ? `«${editing.name}» bearbeiten` : "Neues Produkt"}</h2>
            {editing ? (
              <button type="button" onClick={() => setEditing(null)} className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Bearbeiten beenden">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={err?.name}><Input name="name" defaultValue={editing?.name ?? ""} required maxLength={191} placeholder="z.B. Bier 3 dl" /></Field>
            <Field label="Kategorie" hint="Gruppiert die Kacheln an der Theke" error={err?.category}><Input name="category" list={catList} defaultValue={editing?.category ?? ""} maxLength={191} placeholder="z.B. Getränke" /></Field>
          </div>
          <datalist id={catList}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Preis (${currency})`} error={err?.price}><Input name="price" inputMode="decimal" defaultValue={editing ? (editing.priceCents / 100).toFixed(2) : ""} required placeholder="0.00" /></Field>
            <Field label="Reihenfolge" error={err?.sortOrder}><Input name="sortOrder" inputMode="numeric" defaultValue={editing?.sortOrder ?? 0} /></Field>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="isActive" value="on" defaultChecked={editing?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" />
            <span className="text-sm font-medium">Im Angebot (an der Theke sichtbar)</span>
          </label>
          <input type="hidden" name="isActive" value="off" />
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton pending={saving}>{editing ? "Speichern" : <><Plus className="h-4 w-4" /> Anlegen</>}</SubmitButton>
        </form>
      </Card>

      {products.length === 0 ? (
        <EmptyState icon={<Plus className="h-5 w-5" />} title="Noch keine Produkte" text="Lege oben Getränke, Essen und weitere Artikel der Schützenstube an." />
      ) : (
        groupByCategory(products).map((g) => (
          <section key={g.category}>
            <SectionTitle>{g.category}</SectionTitle>
            <Card className="animate-rise divide-y divide-line overflow-hidden">
              {g.items.map((p) => <ProductRow key={p.id} p={p} currency={currency} onEdit={() => { setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
            </Card>
          </section>
        ))
      )}
      {products.length ? <p className="text-xs text-ink-3">Preisänderungen gelten für neue Einträge. Bereits erfasste Konsumationen behalten Name und Preis, auch wenn ein Produkt gelöscht wird.</p> : null}
    </div>
  );
}

function ProductRow({ p, currency, onEdit }: { p: AdminKioskProduct; currency: string; onEdit: () => void }) {
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? "Das hat nicht geklappt.");
        else if (r.message) toast.success(r.message);
      } catch {
        toast.error("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  return (
    <div className="flex min-h-14 items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {p.name}
          {!p.isActive ? <Badge tone="outline">ausgeblendet</Badge> : null}
        </div>
        <div className="text-xs text-ink-3">{formatMoney(p.priceCents, currency)} · Reihenfolge {p.sortOrder}</div>
      </div>
      <button type="button" onClick={onEdit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label={`${p.name} bearbeiten`}><Pencil className="h-4 w-4" /></button>
      <button type="button" disabled={pending} onClick={() => run(() => setProductActiveAction(p.id, !p.isActive))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label={p.isActive ? `${p.name} ausblenden` : `${p.name} wieder anbieten`}>
        {p.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const okay = await confirmDialog({ title: `«${p.name}» löschen?`, message: "Bereits erfasste Konsumationen bleiben erhalten. Zum vorübergehenden Ausblenden lieber das Auge verwenden.", tone: "danger", confirmLabel: "Löschen" });
          if (okay) run(() => deleteProductAction(p.id));
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-danger/10 hover:text-danger"
        aria-label={`${p.name} löschen`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
