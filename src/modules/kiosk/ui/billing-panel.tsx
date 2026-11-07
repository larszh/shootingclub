"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, isNavigationError, toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { billKioskAction } from "@/modules/kiosk/actions";
import { useT } from "@/components/locale";

export type KioskBillingCandidate = { userId: string; name: string; count: number; totalCents: number; billable: boolean; range: string };

/** Vorschau «Konsumationen verrechnen» mit Auswahl und Bestätigung; pro Mitglied eine Rechnung. */
export function KioskBillingPanel({ from, to, label, categoryName, candidates, blocker, currency }: {
  from: string; to: string; label: string; categoryName: string; candidates: KioskBillingCandidate[]; blocker: string | null; currency: string;
}) {
  const t = useT();
  const router = useRouter();
  const billableIds = candidates.filter((c) => c.billable).map((c) => c.userId);
  const billableKey = [...billableIds].sort().join(",");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(billableIds));
  // Nach router.refresh (z.B. «Wieder freigeben») neu verrechenbare Mitglieder vorauswählen;
  // eine bestehende Auswahl bzw. abgewählte Mitglieder bleiben unverändert.
  const [seenKey, setSeenKey] = useState(billableKey);
  if (seenKey !== billableKey) {
    const seen = new Set(seenKey ? seenKey.split(",") : []);
    const added = billableIds.filter((id) => !seen.has(id));
    setSeenKey(billableKey);
    if (added.length) setPicked((prev) => new Set([...prev, ...added]));
  }
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
      title: t(chosen.length === 1 ? "adm1.kiosk.billTitle.one" : "adm1.kiosk.billTitle.other", { n: chosen.length }),
      message: t("adm1.kiosk.billMessage", { name: categoryName, total: formatMoney(total, currency) }),
      confirmLabel: t("adm1.kiosk.billConfirm"),
    });
    if (!okToGo) return;
    start(async () => {
      try {
        const r = await billKioskAction({ from, to, userIds: chosen.map((c) => c.userId) });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm1.kiosk.billed"));
        router.refresh();
      } catch (e) {
        if (isNavigationError(e)) throw e;
        setError(t("adm1.common.offline"));
      }
    });
  }

  if (!candidates.length) {
    return <Alert tone="ok">{t("adm1.kiosk.nothingOpen", { period: label })}</Alert>;
  }

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="border-b border-line p-4">
        <h3 className="font-semibold">{t("adm1.kiosk.previewTitle", { name: categoryName })}</h3>
        <p className="text-sm text-ink-3">{t("adm1.kiosk.previewText", { n: chosen.length, total: formatMoney(total, currency) })}</p>
      </div>
      <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
        {candidates.map((c) => (
          <li key={c.userId}>
            <label className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-2">
              <input type="checkbox" checked={c.billable && picked.has(c.userId)} disabled={!c.billable} onChange={() => toggle(c.userId)} className="h-5 w-5 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{c.name}</span>
                  {!c.billable ? <Badge tone="outline">{t("adm1.kiosk.accountDeleted")}</Badge> : null}
                </span>
                <span className="block text-xs text-ink-3">{t(c.count === 1 ? "adm1.kiosk.entries.one" : "adm1.kiosk.entries.other", { n: c.count })} · {c.range}</span>
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
          {pending ? <Spinner /> : <Receipt className="h-4 w-4" />} {t("adm1.kiosk.billButton")}
        </Button>
      </div>
    </Card>
  );
}
