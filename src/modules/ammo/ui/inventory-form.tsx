"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { toast } from "@/lib/ui-feedback";
import { inventoryAction } from "@/modules/ammo/stock-actions";

export type InventoryProduct = { id: string; name: string; caliber: string; unitLabel: string; roundsPerUnit: number; stockUnits: number | null; fundingLabel: string; isActive: boolean };

/** Inventur: gezählte Einheiten pro Produkt eingeben. Leere Felder werden nicht gebucht. */
export function InventoryForm({ products }: { products: InventoryProduct[] }) {
  const router = useRouter();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lines = products
    .filter((p) => /^\d{1,7}$/.test(counted[p.id] ?? ""))
    .map((p) => ({ productId: p.id, loaded: p.stockUnits, counted: Number(counted[p.id]) }));
  const diffs = lines.filter((l) => l.counted !== (l.loaded ?? 0)).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lines.length) return setError("Bitte mindestens ein Produkt zählen.");
    const okGo = await confirmDialog({
      title: "Inventur buchen?",
      message: `${lines.length} ${lines.length === 1 ? "Produkt" : "Produkte"} gezählt, ${diffs} mit Differenz. Der Bestand wird auf die gezählten Mengen gesetzt.`,
      confirmLabel: "Buchen",
    });
    if (!okGo) return;
    start(async () => {
      try {
        const r = await inventoryAction({ lines, note });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Inventur gebucht.");
        setCounted({});
        setNote("");
        router.push(`/admin/ammo/stock/inventory?done=${r.data?.at ?? ""}`);
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
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
                <div className="truncate font-medium">{p.name}{!p.isActive ? <span className="text-ink-3"> (ausgeblendet)</span> : null}</div>
                <div className="text-xs text-ink-3">{p.caliber} · {p.fundingLabel} · Buchbestand {p.stockUnits ?? "–"} {p.unitLabel}</div>
                {diff !== null ? (
                  <div className={`text-xs font-medium ${diff === 0 ? "text-ok" : "text-warn"}`}>
                    {diff === 0 ? "stimmt" : `Differenz ${diff > 0 ? "+" : ""}${diff} ${p.unitLabel} (${diff * p.roundsPerUnit} Schuss)`}
                  </div>
                ) : null}
              </div>
              <Input
                value={raw}
                onChange={(e) => setCounted((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
                inputMode="numeric"
                placeholder="gezählt"
                aria-label={`${p.name}: gezählte ${p.unitLabel}`}
                className="w-28 text-right text-lg"
              />
            </div>
          );
        })}
      </Card>
      <Field label="Bemerkung (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} placeholder="z.B. Inventur Jahresende, gezählt von …" /></Field>
      {error ? <Alert>{error}</Alert> : null}
      <Button type="submit" disabled={pending || !lines.length} className="w-full sm:w-auto">
        {pending ? <Spinner /> : <ClipboardCheck className="h-4 w-4" />} Inventur buchen{lines.length ? ` (${lines.length})` : ""}
      </Button>
    </form>
  );
}
