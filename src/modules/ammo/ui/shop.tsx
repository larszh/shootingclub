"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShoppingBag } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, SectionTitle } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { isNavigationError, toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { placeOrderAction } from "@/modules/ammo/actions";
import { groupByCaliber, type ShopProduct } from "@/modules/ammo/types";
import { formatRoundsT } from "@/modules/ammo/i18n";
import { getT, type Locale } from "@/lib/i18n/core";
import { QuantityStepper } from "./stepper";

export function AmmoShop({ products, currency, maxRounds, onSiteOnly, approvalRequired, locale = "de" }: { products: ShopProduct[]; currency: string; maxRounds: number | null; onSiteOnly: boolean; approvalRequired: boolean; locale?: Locale }) {
  const t = useMemo(() => getT(locale), [locale]);
  const formatRounds = (n: number) => formatRoundsT(n, locale, t);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [onSite, setOnSite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const groups = useMemo(() => groupByCaliber(products), [products]);

  const chosen = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const totalCents = chosen.reduce((a, p) => a + (qty[p.id] ?? 0) * p.priceCents, 0);
  const rounds = chosen.reduce((a, p) => a + (qty[p.id] ?? 0) * p.roundsPerUnit, 0);
  const overLimit = maxRounds !== null && rounds > maxRounds;
  const overStock = chosen.filter((p) => p.available !== null && (qty[p.id] ?? 0) > p.available);
  const canOrder = chosen.length > 0 && !overLimit && overStock.length === 0 && (!onSiteOnly || onSite) && !pending;

  function set(id: string, v: number) {
    setError(null);
    setQty((q) => ({ ...q, [id]: v }));
  }

  async function submit() {
    if (!canOrder) return;
    const okay = await confirmDialog({
      title: t("money.ammo.confirm.title"),
      message: t("money.ammo.confirm.message", { rounds: formatRounds(rounds), total: formatMoney(totalCents, currency) }),
      confirmLabel: t("money.ammo.confirm.ok"),
    });
    if (!okay) return;
    start(async () => {
      try {
        const res = await placeOrderAction({ lines: chosen.map((p) => ({ productId: p.id, quantity: qty[p.id] ?? 0 })), note, onSiteConfirmed: onSite });
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? t("money.ammo.ordered"));
        setQty({});
        setNote("");
        setOnSite(false);
        router.refresh();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setError(t("money.ammo.failed"));
      }
    });
  }

  return (
    <div>
      {onSiteOnly ? (
        <Card className="animate-rise mb-4 flex items-start gap-3 border-warn/40 bg-warn/10 p-4">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
          <div>
            <p className="font-semibold">{t("money.ammo.onSite.title")}</p>
            <p className="text-sm text-ink-2">{t("money.ammo.onSite.text")}</p>
          </div>
        </Card>
      ) : null}

      {groups.map((g) => (
        <section key={g.caliber}>
          <SectionTitle>{g.caliber}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {g.items.map((p) => {
              const q = qty[p.id] ?? 0;
              const soldOut = p.available !== null && p.available <= 0;
              return (
                <div key={p.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", q > 0 && "bg-accent-soft/30")}>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ink-3">
                      {t("money.ammo.perUnit", { price: formatMoney(p.priceCents, currency), unit: p.unitLabel })} · {formatRounds(p.roundsPerUnit)}{p.manufacturer ? ` · ${p.manufacturer}` : ""}
                    </div>
                    {p.description ? <div className="mt-0.5 text-xs text-ink-3">{p.description}</div> : null}
                    {p.available !== null ? (
                      <div className="mt-1">{soldOut ? <Badge tone="danger">{t("money.ammo.soldOut")}</Badge> : p.available <= 5 ? <Badge tone="warn">{t("money.ammo.left", { n: p.available, unit: p.unitLabel })}</Badge> : null}</div>
                    ) : null}
                  </div>
                  <QuantityStepper label={p.name} value={q} onChange={(v) => set(p.id, v)} max={p.available} />
                </div>
              );
            })}
          </Card>
        </section>
      ))}

      {chosen.length > 0 || onSiteOnly ? (
        <Card className="animate-rise mt-5 space-y-3 p-4">
          {chosen.length > 0 ? (
            <Field label={t("money.ammo.note.label")}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} placeholder={t("money.ammo.note.placeholder")} />
            </Field>
          ) : null}
          {onSiteOnly ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control bg-surface-2 px-3 py-2.5">
              <input type="checkbox" checked={onSite} onChange={(e) => setOnSite(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
              <span className="text-sm">{t("money.ammo.onSite.confirm")}</span>
            </label>
          ) : null}
        </Card>
      ) : null}

      <div className="sticky bottom-24 z-10 mt-4 md:bottom-4">
        <Card className="space-y-3 p-4 shadow-lg">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs text-ink-3">{t("money.ammo.total")}</div>
              <div className="text-2xl font-semibold tabular-nums" aria-live="polite">{formatMoney(totalCents, currency)}</div>
            </div>
            <div className="text-right">
              <div className={cn("text-sm font-medium tabular-nums", overLimit && "text-danger")}>{formatRounds(rounds)}</div>
              {maxRounds !== null ? <div className="text-xs text-ink-3">{t("money.ammo.maxPerOrder", { rounds: formatRounds(maxRounds) })}</div> : null}
            </div>
          </div>
          {overLimit ? <Alert>{t("money.ammo.overLimit", { rounds: formatRounds(maxRounds!) })}</Alert> : null}
          {overStock.length ? <Alert>{t("money.ammo.overStock", { names: overStock.map((p) => p.name).join(", ") })}</Alert> : null}
          {chosen.length > 0 && onSiteOnly && !onSite ? <p className="text-xs text-warn">{t("money.ammo.onSite.pleaseConfirm")}</p> : null}
          {error ? <Alert>{error}</Alert> : null}
          <Button type="button" size="lg" className="h-auto min-h-13 w-full py-2.5 text-center" disabled={!canOrder} onClick={submit} aria-busy={pending || undefined}>
            {pending ? <span className="inline-flex items-center gap-2"><Spinner /> {t("money.ammo.ordering")}</span> : <><ShoppingBag className="h-5 w-5 shrink-0" /><span className="min-w-0 whitespace-normal">{t("money.ammo.orderButton")}</span></>}
          </Button>
          <p className="text-center text-xs text-ink-3">
            {approvalRequired ? `${t("money.ammo.approvalFirst")} ` : ""}{t("money.ammo.invoiceOnIssue")}
          </p>
        </Card>
      </div>
    </div>
  );
}
