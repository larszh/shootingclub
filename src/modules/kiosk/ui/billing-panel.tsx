"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, isNavigationError, toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { billKioskAction } from "@/modules/kiosk/actions";

export type KioskBillingCandidate = { userId: string; name: string; count: number; totalCents: number; billable: boolean; range: string };

/** Vorschau «Konsumationen verrechnen» mit Auswahl und Bestätigung; pro Mitglied eine Rechnung. */
export function KioskBillingPanel({ from, to, label, categoryName, candidates, blocker, currency }: {
  from: string; to: string; label: string; categoryName: string; candidates: KioskBillingCandidate[]; blocker: string | null; currency: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.billable).map((c) => c.userId)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = useMemo(() => candidates.filter((c) => c.billable && picked.has(c.userId)), [candidates, picked]);
  const total = chosen.reduce((s, c) => s + c.totalCents, 0);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bill() {
    setError(null);
    const okToGo = await confirmDialog({
      title: `${chosen.length} ${chosen.length === 1 ? "Rechnung" : "Rechnungen"} erstellen?`,
      message: `«${categoryName}», total ${formatMoney(total, currency)}. Die Mitglieder werden benachrichtigt und sehen die Rechnung unter «Zahlungen». Verrechnete Einträge werden nie ein zweites Mal verrechnet.`,
      confirmLabel: "Rechnungen erstellen",
    });
    if (!okToGo) return;
    start(async () => {
      try {
        const r = await billKioskAction({ from, to, userIds: chosen.map((c) => c.userId) });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Rechnungen erstellt.");
        router.refresh();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  if (!candidates.length) {
    return <Alert tone="ok">Keine offenen Konsumationen für {label}: alles verrechnet oder bar bezahlt.</Alert>;
  }

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="border-b border-line p-4">
        <h3 className="font-semibold">Vorschau «{categoryName}»</h3>
        <p className="text-sm text-ink-3">Ausgewählt: {chosen.length} · total {formatMoney(total, currency)}. Abwählen, wer (noch) nicht verrechnet werden soll.</p>
      </div>
      <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
        {candidates.map((c) => (
          <li key={c.userId}>
            <label className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-2">
              <input type="checkbox" checked={c.billable && picked.has(c.userId)} disabled={!c.billable} onChange={() => toggle(c.userId)} className="h-5 w-5 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{c.name}</span>
                  {!c.billable ? <Badge tone="outline">Konto gelöscht</Badge> : null}
                </span>
                <span className="block text-xs text-ink-3">{c.count} {c.count === 1 ? "Eintrag" : "Einträge"} · {c.range}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(c.totalCents, currency)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-line p-4">
        {blocker ? <Alert tone="warn">{blocker}</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}
        <Button onClick={bill} disabled={pending || !chosen.length || !!blocker} className="w-full sm:w-auto">
          {pending ? <Spinner /> : <Receipt className="h-4 w-4" />} Konsumationen verrechnen
        </Button>
      </div>
    </Card>
  );
}
