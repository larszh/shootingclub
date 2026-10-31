"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, PackagePlus, Pencil, Trash2, X } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, Textarea } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { adjustStockAction, deleteProductAction, saveProductAction, setProductActiveAction } from "@/modules/ammo/actions";
import { CALIBER_SUGGESTIONS, groupByCaliber, UNIT_SUGGESTIONS } from "@/modules/ammo/types";
import { FUNDING, FUNDING_TYPES, fundingInfo } from "@/modules/ammo/stock";

export type AdminProduct = {
  id: string; name: string; caliber: string; manufacturer: string | null; description: string | null; unitLabel: string;
  roundsPerUnit: number; priceCents: number; stockUnits: number | null; isActive: boolean; sortOrder: number; reserved: number;
  fundingType: string;
};

export function ProductManager({ products, currency }: { products: AdminProduct[]; currency: string }) {
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [state, action, saving] = useActionState(async (prev: Awaited<ReturnType<typeof saveProductAction>> | null, fd: FormData) => {
    const r = await saveProductAction(prev, fd);
    // Nach erfolgreichem Bearbeiten zurück zum Formular «Neues Produkt».
    if (r.ok && fd.get("id")) setEditing(null);
    return r;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const caliberList = useId();
  const unitList = useId();
  const calibers = [...new Set([...CALIBER_SUGGESTIONS, ...products.map((p) => p.caliber)])];

  useEffect(() => {
    if (state?.ok && !editing) formRef.current?.reset();
  }, [state, editing]);

  const err = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form ref={formRef} key={editing?.id ?? "new"} onSubmit={submitKeepingValues(action)} className="space-y-3">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          {editing ? <input type="hidden" name="stockUnitsLoaded" value={editing.stockUnits ?? ""} /> : null}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editing ? `«${editing.name}» bearbeiten` : "Neues Produkt"}</h2>
            {editing ? (
              <button type="button" onClick={() => setEditing(null)} className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Bearbeiten beenden">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={err?.name}><Input name="name" defaultValue={editing?.name ?? ""} required maxLength={191} placeholder="z.B. GP 11 Ordonnanz" /></Field>
            <Field label="Kaliber" error={err?.caliber}><Input name="caliber" list={caliberList} defaultValue={editing?.caliber ?? ""} required maxLength={191} placeholder="z.B. 7.5 × 55 GP 11" /></Field>
            <Field label="Hersteller (optional)" error={err?.manufacturer}><Input name="manufacturer" defaultValue={editing?.manufacturer ?? ""} maxLength={191} /></Field>
            <Field label="Verkaufseinheit" error={err?.unitLabel}><Input name="unitLabel" list={unitList} defaultValue={editing?.unitLabel ?? "Schachtel"} required maxLength={40} /></Field>
          </div>
          <datalist id={caliberList}>{calibers.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id={unitList}>{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Schuss pro Einheit" error={err?.roundsPerUnit}><Input name="roundsPerUnit" inputMode="numeric" defaultValue={editing?.roundsPerUnit ?? 50} required /></Field>
            <Field label={`Preis pro Einheit (${currency})`} error={err?.price}><Input name="price" inputMode="decimal" defaultValue={editing ? (editing.priceCents / 100).toFixed(2) : ""} required placeholder="0.00" /></Field>
            <Field label="Bestand (optional)" hint="Leer = nicht geführt" error={err?.stockUnits}><Input name="stockUnits" inputMode="numeric" defaultValue={editing?.stockUnits ?? ""} /></Field>
            <Field label="Reihenfolge" error={err?.sortOrder}><Input name="sortOrder" inputMode="numeric" defaultValue={editing?.sortOrder ?? 0} /></Field>
          </div>
          <Field label="Finanzierung" hint="Für die Jahresübersicht der Munitionskontrolle (Bund gratis, subventioniert, kommerziell)." error={err?.fundingType}>
            <Select name="fundingType" defaultValue={editing?.fundingType ?? "COMMERCIAL"}>
              {FUNDING_TYPES.map((f) => <option key={f} value={f}>{FUNDING[f].label}</option>)}
            </Select>
          </Field>
          <Field label="Beschreibung (optional)" error={err?.description}><Textarea name="description" defaultValue={editing?.description ?? ""} maxLength={2000} rows={2} /></Field>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="isActive" value="on" defaultChecked={editing?.isActive ?? true} className="h-5 w-5 accent-[var(--ink)]" />
            <span className="text-sm font-medium">Im Angebot (für Mitglieder sichtbar)</span>
          </label>
          <input type="hidden" name="isActive" value="off" />
          {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
          <SubmitButton pending={saving}>{editing ? "Speichern" : <><PackagePlus className="h-4 w-4" /> Anlegen</>}</SubmitButton>
        </form>
      </Card>

      {products.length === 0 ? (
        <EmptyState icon={<PackagePlus className="h-5 w-5" />} title="Noch keine Produkte" text="Lege oben die Munition an, die der Verein verkauft." />
      ) : (
        groupByCaliber(products).map((g) => (
          <section key={g.caliber}>
            <SectionTitle>{g.caliber}</SectionTitle>
            <Card className="animate-rise divide-y divide-line overflow-hidden">
              {g.items.map((p) => <ProductRow key={p.id} p={p} currency={currency} onEdit={() => { setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
            </Card>
          </section>
        ))
      )}
      {products.length ? <p className="text-xs text-ink-3">Zugang wird als Wareneingang, Abgang als Korrektur im Bestandsjournal gebucht. Wareneingänge mit Herkunft und Lieferschein, Abgaben am Stand und Inventur: unter «Bestand».</p> : null}
    </div>
  );
}

function ProductRow({ p, currency, onEdit }: { p: AdminProduct; currency: string; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const [delta, setDelta] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Das hat nicht geklappt.");
      else if (r.message) toast.success(r.message);
    });
  }

  function book(sign: 1 | -1) {
    const n = Math.floor(Number(delta));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Bitte eine Menge grösser als 0 eingeben.");
      return;
    }
    run(async () => {
      const r = await adjustStockAction(p.id, sign * n);
      if (r.ok) setDelta("");
      return r;
    });
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {p.name}
            {!p.isActive ? <Badge tone="outline">ausgeblendet</Badge> : null}
            {p.fundingType !== "COMMERCIAL" ? <Badge tone="accent">{fundingInfo(p.fundingType).short}</Badge> : null}
            {p.stockUnits !== null && p.stockUnits - p.reserved <= 0 ? <Badge tone="danger">ausverkauft</Badge> : null}
          </div>
          <div className="text-xs text-ink-3">
            {formatMoney(p.priceCents, currency)} pro {p.unitLabel} · {p.roundsPerUnit} Schuss{p.manufacturer ? ` · ${p.manufacturer}` : ""}
          </div>
          <div className="text-xs text-ink-3">
            {p.stockUnits === null ? "Bestand nicht geführt" : `Bestand ${p.stockUnits} ${p.unitLabel}`}
            {p.reserved ? ` · ${p.reserved} in offenen Bestellungen` : ""}
          </div>
        </div>
        <button type="button" onClick={onEdit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label={`${p.name} bearbeiten`}><Pencil className="h-4 w-4" /></button>
        <button type="button" disabled={pending} onClick={() => run(() => setProductActiveAction(p.id, !p.isActive))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label={p.isActive ? `${p.name} ausblenden` : `${p.name} wieder anbieten`}>
          {p.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (await confirmDialog({ title: `«${p.name}» löschen?`, message: "Kommt das Produkt in Bestellungen vor, wird es nur ausgeblendet.", tone: "danger", confirmLabel: "Löschen" })) run(() => deleteProductAction(p.id));
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-danger"
          aria-label={`${p.name} löschen`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" placeholder="Menge" aria-label={`Bestand ${p.name}: Menge`} className="w-24" />
        <Button type="button" size="sm" variant="secondary" className="h-11" disabled={pending} onClick={() => book(1)}>+ Zugang</Button>
        {p.stockUnits !== null ? <Button type="button" size="sm" variant="secondary" className="h-11" disabled={pending} onClick={() => book(-1)}>− Abgang</Button> : null}
      </div>
    </div>
  );
}
