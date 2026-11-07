"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { inventoryAction } from "@/modules/ammo/stock-actions";
import { useLocale, useT } from "@/components/locale";
import { roundsT } from "./labels";

export type InventoryProduct = { id: string; name: string; caliber: string; unitLabel: string; roundsPerUnit: number; stockUnits: number | null; fundingLabel: string; isActive: boolean };

/** Inventur: gezählte Einheiten pro Produkt eingeben. Leere Felder werden nicht gebucht. */
export function InventoryForm({ products }: { products: InventoryProduct[] }) {
  const router = useRouter();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  const locale = useLocale();

  const lines = products
    .filter((p) => /^\d{1,7}$/.test(counted[p.id] ?? ""))
    .map((p) => ({ productId: p.id, loaded: p.stockUnits, counted: Number(counted[p.id]) }));
  const diffs = lines.filter((l) => l.counted !== (l.loaded ?? 0)).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lines.length) return setError(t("adm1.ammo.inv.countOne"));
    const okGo = await confirmDialog({
      title: t("adm1.ammo.inv.confirmTitle"),
      message: t(lines.length === 1 ? "adm1.ammo.inv.confirmMessage.one" : "adm1.ammo.inv.confirmMessage.other", { n: lines.length, diffs }),
      confirmLabel: t("adm1.ammo.book"),
    });
    if (!okGo) return;
    start(async () => {
      try {
        const r = await inventoryAction({ lines, note });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm1.ammo.inv.booked"));
        setCounted({});
        setNote("");
        router.push(`/admin/ammo/stock/inventory?done=${r.data?.at ?? ""}`);
        router.refresh();
      } catch {
        setError(t("adm1.ammo.noConnection"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {products.map((p) => {
          const raw = counted[p.id] ?? "";
          const n = /^\d{1,7}$/.test(raw) ? Number(raw) : null;
          const diff = n === null ? null : n - (p.stockUnits ?? 0);
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}{!p.isActive ? <span className="text-ink-3"> ({t("adm1.ammo.prod.hidden")})</span> : null}</div>
                <div className="text-xs text-ink-3">{p.caliber} · {p.fundingLabel} · {t("adm1.ammo.inv.bookStock", { n: p.stockUnits ?? "–", unit: p.unitLabel })}</div>
                {diff !== null ? (
                  <div className={`text-xs font-medium ${diff === 0 ? "text-ok" : "text-warn"}`}>
                    {diff === 0 ? t("adm1.ammo.inv.matches") : t("adm1.ammo.inv.diff", { diff: `${diff > 0 ? "+" : ""}${diff}`, unit: p.unitLabel, rounds: roundsT(diff * p.roundsPerUnit, locale, t) })}
                  </div>
                ) : null}
              </div>
              <Input
                value={raw}
                onChange={(e) => setCounted((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
                inputMode="numeric"
                placeholder={t("adm1.ammo.inv.counted")}
                aria-label={t("adm1.ammo.inv.countedAria", { name: p.name, unit: p.unitLabel })}
                className="w-28 text-right text-lg"
              />
            </div>
          );
        })}
      </Card>
      <Field label={t("adm1.ammo.remark")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} placeholder={t("adm1.ammo.inv.notePlaceholder")} /></Field>
      {error ? <Alert>{error}</Alert> : null}
      <Button type="submit" disabled={pending || !lines.length} className="w-full sm:w-auto">
        {pending ? <Spinner /> : <ClipboardCheck className="h-4 w-4" />} {t("adm1.ammo.inv.submit")}{lines.length ? ` (${lines.length})` : ""}
      </Button>
    </form>
  );
}
