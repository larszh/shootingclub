"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteCategoryAction, saveCategoryAction } from "@/modules/billing/actions";
import { Alert, Badge, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";

type Cat = { id: string; name: string; amountCents: number; description: string | null; isActive: boolean; _count: { memberships: number } };

export function CategoryManager({ categories, currency }: { categories: Cat[]; currency: string }) {
  const [editing, setEditing] = useState<Cat | null>(null);
  const [state, action] = useActionState(saveCategoryAction, null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form key={editing?.id ?? "new"} action={action} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div className="flex items-center justify-between"><h3 className="font-semibold">{editing ? `«${editing.name}» bearbeiten` : "Neue Kategorie"}</h3>{editing ? <button type="button" onClick={() => setEditing(null)} className="text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button> : null}</div>
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <Field label="Name"><Input name="name" defaultValue={editing?.name ?? ""} required placeholder="z.B. Aktivmitglied" /></Field>
            <Field label={`Beitrag (${currency})`}><Input name="amount" inputMode="decimal" defaultValue={editing ? (editing.amountCents / 100).toFixed(2) : ""} placeholder="0.00" /></Field>
          </div>
          <Field label="Beschreibung (optional)"><Input name="description" defaultValue={editing?.description ?? ""} placeholder="z.B. inkl. Verbandsbeitrag" /></Field>
          <label className="flex items-center gap-3"><input type="checkbox" name="isActive" value="on" defaultChecked={editing?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" /><span className="text-sm font-medium">Aktiv (zuweisbar)</span></label>
          <input type="hidden" name="isActive" value="off" />
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton size="sm">{editing ? "Speichern" : "Anlegen"}</SubmitButton>
        </form>
      </Card>
      {categories.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium flex items-center gap-2">{c.name}{!c.isActive ? <Badge tone="warn">inaktiv</Badge> : null}</div>
                <div className="text-xs text-ink-3">{c.amountCents ? formatMoney(c.amountCents, currency) : "beitragsfrei"} · {c._count.memberships} {c._count.memberships === 1 ? "Mitglied" : "Mitglieder"}{c.description ? ` · ${c.description}` : ""}</div>
              </div>
              <button type="button" onClick={() => setEditing(c)} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:bg-surface-2" aria-label="Bearbeiten"><Pencil className="h-4 w-4" /></button>
              <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: `Kategorie «${c.name}» löschen?`, tone: "danger" }))) start(async () => { const r = await deleteCategoryAction(c.id); if (!r.ok) alert(r.error); }); }} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:text-accent" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
