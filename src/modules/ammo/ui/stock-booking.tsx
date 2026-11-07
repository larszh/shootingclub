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
import { useLocale, useT } from "@/components/locale";
import { roundsT } from "./labels";

export type BookingProduct = { id: string; name: string; caliber: string; unitLabel: string; roundsPerUnit: number; stockUnits: number | null; fundingLabel: string };
export type BookingRangeDay = { id: string; dayKey: string; label: string };

const KINDS: ManualKind[] = ["RECEIPT", "ISSUE", "RETURN", "CORRECTION"];

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
  const t = useT();
  const locale = useLocale();
  const rounds = (n: number) => roundsT(n, locale, t);

  const product = products.find((p) => p.id === productId) ?? null;
  const daysOfDate = useMemo(() => rangeDays.filter((d) => d.dayKey === date), [rangeDays, date]);
  const qty = Number(quantity);
  const validQty = /^\d{1,7}$/.test(quantity) && qty > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!product) return setError(t("adm1.ammo.book.chooseProduct"));
    if (!validQty) return setError(t("adm1.ammo.qtyPositive"));
    if (kind === "RECEIPT" && !source.trim()) return setError(t("adm1.ammo.book.sourceRequired"));
    start(async () => {
      try {
        const r = await bookMovementAction({
          productId: product.id, kind, quantity: qty, direction: kind === "CORRECTION" ? (Number(direction) as 1 | -1) : 1, date,
          rangeDayId: kind === "ISSUE" && rangeDayId && daysOfDate.some((d) => d.id === rangeDayId) ? rangeDayId : null, source, note,
        });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm1.ammo.booked"));
        setQuantity("");
        setNote("");
        if (kind !== "ISSUE") setSource("");
        router.refresh();
      } catch {
        setError(t("adm1.ammo.noConnection"));
      }
    });
  }

  if (!products.length) return null;

  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-semibold">{t("adm1.ammo.book.title")}</h2>
        <Segmented<ManualKind> label={t("adm1.ammo.book.kind")} value={kind} onChange={(v) => { setKind(v); setError(null); }} options={KINDS.map((k) => ({ value: k, label: t(`adm1.ammo.kindShort.${k}`) }))} />
        <Field label={t("adm1.ammo.product")}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.caliber} · {p.name} ({p.fundingLabel})</option>)}
          </Select>
        </Field>
        {product ? (
          <p className="-mt-1 text-xs text-ink-3">
            {t("adm1.ammo.book.stock")} {product.stockUnits === null ? t("adm1.ammo.book.notTracked") : `${product.stockUnits} ${product.unitLabel} = ${rounds(product.stockUnits * product.roundsPerUnit)}`}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("adm1.ammo.book.qty", { unit: product?.unitLabel ?? t("adm1.ammo.book.units") })} hint={validQty && product ? `= ${rounds(qty * product.roundsPerUnit)}` : undefined}>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" placeholder="0" className="text-lg" />
          </Field>
          <Field label={t("adm1.common.date")}><Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {kind === "CORRECTION" ? (
          <Segmented<"1" | "-1"> label={t("adm1.ammo.book.direction")} value={direction} onChange={setDirection} options={[{ value: "-1", label: t("adm1.ammo.minusOut") }, { value: "1", label: t("adm1.ammo.plusIn") }]} />
        ) : null}
        {kind === "ISSUE" ? (
          <Field label={t("adm1.ammo.book.rangeDay")} hint={daysOfDate.length ? t("adm1.ammo.book.rangeDayHint") : t("adm1.ammo.book.noRangeDay")}>
            <Select value={rangeDayId} onChange={(e) => setRangeDayId(e.target.value)} disabled={!daysOfDate.length}>
              <option value="">{t("adm1.ammo.book.withoutRangeDay")}</option>
              {daysOfDate.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
          </Field>
        ) : null}
        <Field label={kind === "RECEIPT" ? t("adm1.ammo.book.sourceReceipt") : t("adm1.ammo.book.sourceOther")}>
          <Input value={source} onChange={(e) => setSource(e.target.value)} maxLength={191} placeholder={t(`adm1.ammo.book.placeholder.${kind}`)} />
        </Field>
        <Field label={t("adm1.ammo.remark")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} /></Field>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" disabled={pending}>{pending ? <Spinner /> : <PackageCheck className="h-4 w-4" />} {t("adm1.ammo.book")}</Button>
      </form>
    </Card>
  );
}
