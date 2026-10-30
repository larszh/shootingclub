"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { billErsatzAction } from "@/modules/shifts/actions";

export type ErsatzCandidate = { userId: string; name: string; done: number; missing: number; amountCents: number };

/** Vorschau der Ersatzabgaben mit Auswahl und Bestätigung; erstellt pro Mitglied eine Rechnung. */
export function ErsatzPanel({ year, candidates, blocker }: { year: number; candidates: ErsatzCandidate[]; blocker: string | null }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((c) => c.userId)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = useMemo(() => candidates.filter((c) => picked.has(c.userId)), [candidates, picked]);
  const total = chosen.reduce((s, c) => s + c.amountCents, 0);
  const fmtH = (h: number) => new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(h);

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
      message: `Ersatzabgabe Arbeitsstunden ${year}, total ${formatMoney(total)}. Die Mitglieder werden benachrichtigt und sehen die Rechnung unter «Zahlungen». Pro Mitglied und Jahr wird höchstens eine Rechnung erstellt.`,
      confirmLabel: "Rechnungen erstellen",
    });
    if (!okToGo) return;
    start(async () => {
      try {
        const r = await billErsatzAction(year, chosen.map((c) => c.userId));
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Rechnungen erstellt.");
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  if (!candidates.length) {
    return <Alert tone="ok">Keine offenen Ersatzabgaben für {year}: alle haben ihr Soll erfüllt oder sind bereits verrechnet.</Alert>;
  }

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="border-b border-line p-4">
        <h3 className="font-semibold">Vorschau Ersatzabgabe {year}</h3>
        <p className="text-sm text-ink-3">Ausgewählt: {chosen.length} · total {formatMoney(total)}. Abwählen, wer nicht verrechnet werden soll (z.B. begründete Ausnahme).</p>
      </div>
      <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
        {candidates.map((c) => (
          <li key={c.userId}>
            <label className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-2">
              <input type="checkbox" checked={picked.has(c.userId)} onChange={() => toggle(c.userId)} className="h-5 w-5 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block text-xs text-ink-3">{fmtH(c.done)} h geleistet · {fmtH(c.missing)} h fehlen</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(c.amountCents)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-line p-4">
        {blocker ? <Alert tone="warn">{blocker}</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}
        <Button onClick={bill} disabled={pending || !chosen.length || !!blocker} className="w-full sm:w-auto">
          {pending ? <Spinner /> : <Receipt className="h-4 w-4" />} Ersatzabgabe verrechnen
        </Button>
      </div>
    </Card>
  );
}
