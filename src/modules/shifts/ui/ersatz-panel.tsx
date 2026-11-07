"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import { formatMoneyLocale } from "@/lib/i18n/core";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/components/locale";
import { billErsatzAction } from "@/modules/shifts/actions";

export type ErsatzCandidate = { userId: string; name: string; done: number; missing: number; amountCents: number };

/** Vorschau der Ersatzabgaben mit Auswahl und Bestätigung; erstellt pro Mitglied eine Rechnung. */
export function ErsatzPanel({ year, candidates, blocker }: { year: number; candidates: ErsatzCandidate[]; blocker: string | null }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const formatMoney = (c: number) => formatMoneyLocale(c, locale);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((c) => c.userId)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = useMemo(() => candidates.filter((c) => picked.has(c.userId)), [candidates, picked]);
  const total = chosen.reduce((s, c) => s + c.amountCents, 0);
  const fmtH = (h: number) => new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2, useGrouping: false }).format(h);

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
      title: t(chosen.length === 1 ? "adm2.shifts.ers.billQ.one" : "adm2.shifts.ers.billQ.other", { n: chosen.length }),
      message: t("adm2.shifts.ers.billText", { year, total: formatMoney(total) }),
      confirmLabel: t("adm2.shifts.ers.billConfirm"),
    });
    if (!okToGo) return;
    start(async () => {
      try {
        const r = await billErsatzAction(year, chosen.map((c) => c.userId));
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm2.shifts.ers.created"));
        router.refresh();
      } catch {
        setError(t("adm2.common.network"));
      }
    });
  }

  if (!candidates.length) {
    return <Alert tone="ok">{t("adm2.shifts.ers.none", { year })}</Alert>;
  }

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="border-b border-line p-4">
        <h3 className="font-semibold">{t("adm2.shifts.ers.preview", { year })}</h3>
        <p className="text-sm text-ink-3">{t("adm2.shifts.ers.selected", { n: chosen.length, total: formatMoney(total) })}</p>
      </div>
      <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
        {candidates.map((c) => (
          <li key={c.userId}>
            <label className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-2">
              <input type="checkbox" checked={picked.has(c.userId)} onChange={() => toggle(c.userId)} className="h-5 w-5 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block text-xs text-ink-3">{t("adm2.shifts.ers.row", { done: fmtH(c.done), missing: fmtH(c.missing) })}</span>
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
          {pending ? <Spinner /> : <Receipt className="h-4 w-4" />} {t("adm2.shifts.ers.bill")}
        </Button>
      </div>
    </Card>
  );
}
