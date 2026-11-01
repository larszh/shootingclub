"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldCheck, Undo2 } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import { formatScore } from "@/lib/utils";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { confirmOfficialResultAction, revokeOfficialResultAction, setOfficialAttemptAction } from "@/modules/scores/official-actions";

export type OfficialRow = {
  id: string;
  name: string;
  isGuest: boolean;
  total: number | null;
  zeros: number | null;
  isOfficial: boolean;
  attempt: number | null;
  passed: boolean | null;
  verifiedAtLabel: string | null;
  verifiedByName: string | null;
  suggestedAttempt: number;
  complete: boolean;
};

function PassBadge({ passed, t }: { passed: boolean | null; t: TFunction }) {
  if (passed === true) return <Badge tone="ok">{t("shooting.official.passed")}</Badge>;
  if (passed === false) return <Badge tone="danger">{t("shooting.official.failed")}</Badge>;
  return <Badge tone="outline">{t("shooting.official.noRule")}</Badge>;
}

/**
 * Amtliche Bestätigung pro Teilnehmer (Obligatorisch, Feldschiessen, Qualifikation).
 * Schützenmeister (results.verify) bestätigen oder heben auf; alle anderen sehen nur den Status.
 */
export function OfficialPanel({ rows, canVerify, kindLabel, ruleText, decimal, locale = "de" }: { rows: OfficialRow[]; canVerify: boolean; kindLabel: string; ruleText: string; decimal: boolean; locale?: Locale }) {
  const t = useMemo(() => getT(locale), [locale]);
  return (
    <Card className="animate-rise p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="font-semibold">{t("shooting.official.title", { kind: kindLabel })}</h2>
          <p className="text-xs text-ink-3">{ruleText}</p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => <OfficialRowItem key={r.id} row={r} canVerify={canVerify} decimal={decimal} t={t} />)}
      </ul>
      {canVerify ? (
        <p className="text-xs text-ink-3">{t("shooting.official.verifierNote")}</p>
      ) : null}
    </Card>
  );
}

function OfficialRowItem({ row, canVerify, decimal, t }: { row: OfficialRow; canVerify: boolean; decimal: boolean; t: TFunction }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [attempt, setAttempt] = useState(String(row.isOfficial ? (row.attempt ?? "") : row.suggestedAttempt));

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          if (res.message) toast.success(res.message);
          router.refresh();
        } else toast.error(res.error);
      } catch {
        toast.error(t("shooting.common.noConnectionRetry"));
      }
    });

  const confirm = async () => {
    if (!row.complete) {
      const okay = await confirmDialog({ title: t("shooting.official.incompleteTitle"), message: t("shooting.official.incompleteText"), confirmLabel: t("shooting.official.confirmAnyway") });
      if (!okay) return;
    }
    run(() => confirmOfficialResultAction(row.id, attempt));
  };
  const revoke = async () => {
    const okay = await confirmDialog({ title: t("shooting.official.revokeTitle"), message: t("shooting.official.revokeText", { name: row.name }), tone: "danger", confirmLabel: t("shooting.official.revokeLabel") });
    if (okay) run(() => revokeOfficialResultAction(row.id));
  };

  return (
    <li className="py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{row.name}</div>
          <div className="text-xs text-ink-3 tabular-nums">
            {row.total === null ? t("shooting.official.noResult") : t("shooting.official.totalZeros", { total: formatScore(row.total, decimal), zeros: row.zeros ?? 0 })}
            {!row.complete && row.total !== null ? t("shooting.official.incomplete") : ""}
          </div>
          {row.isOfficial ? (
            <div className="mt-1 text-xs text-ink-3">{t("shooting.official.confirmed")}{row.verifiedByName ? t("shooting.official.confirmedBy", { name: row.verifiedByName }) : ""}{row.verifiedAtLabel ? t("shooting.official.confirmedOn", { date: row.verifiedAtLabel }) : ""}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.isOfficial ? <Badge tone="accent"><BadgeCheck className="mr-1 h-3 w-3" aria-hidden />{t("shooting.official.badge", { attempt: row.attempt ?? "–" })}</Badge> : <Badge tone="outline">{t("shooting.official.notConfirmed")}</Badge>}
          {row.isOfficial ? <PassBadge passed={row.passed} t={t} /> : null}
        </div>
      </div>
      {canVerify && !row.isGuest ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            {t("shooting.official.attempt")}
            <Input type="number" inputMode="numeric" min={1} max={20} value={attempt} onChange={(e) => setAttempt(e.target.value)} className="h-11 w-20 tabular-nums" aria-label={t("shooting.official.attemptFor", { name: row.name })} />
          </label>
          {row.isOfficial ? (
            <>
              {attempt !== String(row.attempt ?? "") ? (
                <Button type="button" variant="secondary" size="sm" className="h-11" disabled={pending} onClick={() => run(() => setOfficialAttemptAction(row.id, attempt))}>{t("shooting.official.saveAttempt")}</Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="h-11" disabled={pending} onClick={() => void revoke()}><Undo2 className="h-4 w-4" aria-hidden /> {t("shooting.official.revoke")}</Button>
            </>
          ) : (
            <Button type="button" size="sm" className="h-11" disabled={pending || row.total === null} onClick={() => void confirm()}><BadgeCheck className="h-4 w-4" aria-hidden /> {t("shooting.official.confirm")}</Button>
          )}
        </div>
      ) : canVerify && row.isGuest ? (
        <p className="text-xs text-ink-3">{t("shooting.official.guestsNo")}</p>
      ) : null}
    </li>
  );
}
