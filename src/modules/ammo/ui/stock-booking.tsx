"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { bookMovementAction } from "@/modules/ammo/stock-actions";
import type { ManualKind } from "@/modules/ammo/stock";

export type BookingProduct = { id: string; name: string; caliber: string; unitLabel: string; roundsPerUnit: number; stockUnits: number | null; fundingLabel: string };
export type BookingRangeDay = { id: string; dayKey: string; label: string };

const KIND_OPTIONS: { value: ManualKind; label: string }[] = [
  { value: "RECEIPT", label: "Eingang" },
  { value: "ISSUE", label: "Abgabe" },
  { value: "RETURN", label: "Rücknahme" },
  { value: "CORRECTION", label: "Korrektur" },
];

const SOURCE_PLACEHOLDER: Record<ManualKind, string> = {
  RECEIPT: "z.B. Bund, Lieferschein 123",
  ISSUE: "z.B. Obligatorisch, Bahn 1–6",
  RETURN: "z.B. nicht verschossen",
  CORRECTION: "z.B. Schachtel beschädigt",
};

/** Bewegung buchen: Wareneingang, Abgabe am Stand (optional mit Standbuch), Rücknahme, Korrektur. */
export function StockBooking({ products, rangeDays, today }: { products: BookingProduct[]; rangeDays: BookingRangeDay[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<ManualKind>("RECEIPT");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"1" | "-1">("-1");
  const [date, setDate] = useState(today);
  const [rangeDayId, setRangeDayId] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? null;
  const daysOfDate = useMemo(() => rangeDays.filter((d) => d.dayKey === date), [rangeDays, date]);
  const qty = Number(quantity);
  const validQty = /^\d{1,7}$/.test(quantity) && qty > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!product) return setError("Bitte ein Produkt wählen.");
    if (!validQty) return setError("Bitte eine Menge grösser als 0 eingeben.");
    if (kind === "RECEIPT" && !source.trim()) return setError("Bitte die Herkunft angeben (z.B. «Bund, Lieferschein 123»).");
    start(async () => {
      try {
        const r = await bookMovementAction({
          productId: product.id, kind, quantity: qty, direction: kind === "CORRECTION" ? (Number(direction) as 1 | -1) : 1, date,
          rangeDayId: kind === "ISSUE" && rangeDayId && daysOfDate.some((d) => d.id === rangeDayId) ? rangeDayId : null, source, note,
        });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Gebucht.");
        setQuantity("");
        setNote("");
        if (kind !== "ISSUE") setSource("");
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  if (!products.length) return null;

  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-semibold">Bewegung buchen</h2>
        <Segmented<ManualKind> label="Art der Bewegung" value={kind} onChange={(v) => { setKind(v); setError(null); }} options={KIND_OPTIONS} />
        <Field label="Produkt">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.caliber} · {p.name} ({p.fundingLabel})</option>)}
          </Select>
        </Field>
        {product ? (
          <p className="-mt-1 text-xs text-ink-3">
            Bestand: {product.stockUnits === null ? "nicht geführt (ein Eingang setzt den Bestand)" : `${product.stockUnits} ${product.unitLabel} = ${product.stockUnits * product.roundsPerUnit} Schuss`}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Menge (${product?.unitLabel ?? "Einheiten"})`} hint={validQty && product ? `= ${qty * product.roundsPerUnit} Schuss` : undefined}>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" placeholder="0" className="text-lg" />
          </Field>
          <Field label="Datum"><Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {kind === "CORRECTION" ? (
          <Segmented<"1" | "-1"> label="Richtung" value={direction} onChange={setDirection} options={[{ value: "-1", label: "− Abgang" }, { value: "1", label: "+ Zugang" }]} />
        ) : null}
        {kind === "ISSUE" ? (
          <Field label="Standbuch (optional)" hint={daysOfDate.length ? "Abgabe dem Schiesstag zuordnen." : "Für dieses Datum gibt es kein Standbuch."}>
            <Select value={rangeDayId} onChange={(e) => setRangeDayId(e.target.value)} disabled={!daysOfDate.length}>
              <option value="">– ohne Standbuch –</option>
              {daysOfDate.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
          </Field>
        ) : null}
        <Field label={kind === "RECEIPT" ? "Herkunft / Lieferschein" : "Anlass / Herkunft (optional)"}>
          <Input value={source} onChange={(e) => setSource(e.target.value)} maxLength={191} placeholder={SOURCE_PLACEHOLDER[kind]} />
        </Field>
        <Field label="Bemerkung (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} /></Field>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" disabled={pending}>{pending ? <Spinner /> : <PackageCheck className="h-4 w-4" />} Buchen</Button>
      </form>
    </Card>
  );
}
