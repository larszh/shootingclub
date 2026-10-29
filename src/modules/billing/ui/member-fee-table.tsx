"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, FilePlus } from "lucide-react";
import { createSingleInvoiceAction, setMemberFeeAction } from "@/modules/billing/actions";
import { Badge, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";

type Member = {
  membershipId: string; name: string; email: string; avatarUrl?: string | null; address: string | null; memberNumber: string | null;
  category: { id: string; name: string; amountCents: number } | null; overrideCents: number | null; effectiveCents: number | null;
  invoice: { id: string; number: string; status: string; amountCents: number } | null;
  /** In der Haushaltsrechnung eines anderen Haushaltsmitglieds enthalten */
  coveredBy?: { number: string | null } | null;
};
type Cat = { id: string; name: string; amountCents: number };

export function MemberFeeTable({ members, categories, currency, year }: { members: Member[]; categories: Cat[]; currency: string; year: number }) {
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {members.map((m) => <Row key={m.membershipId} m={m} categories={categories} currency={currency} year={year} />)}
      {members.length === 0 ? <p className="p-4 text-sm text-ink-3">Keine Mitglieder.</p> : null}
    </Card>
  );
}

function Row({ m, categories, currency, year }: { m: Member; categories: Cat[]; currency: string; year: number }) {
  const [catId, setCatId] = useState(m.category?.id ?? "");
  const [override, setOverride] = useState(m.overrideCents !== null ? (m.overrideCents / 100).toFixed(2) : "");
  const [memberNumber, setMemberNumber] = useState(m.memberNumber ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = catId !== (m.category?.id ?? "") || override !== (m.overrideCents !== null ? (m.overrideCents / 100).toFixed(2) : "") || memberNumber !== (m.memberNumber ?? "");
  const save = () => start(async () => {
    setErr(null);
    const r = await setMemberFeeAction(m.membershipId, { categoryId: catId || null, overrideAmount: override, memberNumber });
    if (!r.ok) setErr(r.error); else { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  });
  const invoice = () => start(async () => { const r = await createSingleInvoiceAction(m.membershipId, year); if (!r.ok) setErr(r.error); });
  const st = m.invoice ? FEE_INVOICE_STATUS[m.invoice.status] : null;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={m.name} src={m.avatarUrl ?? null} size={36} tone="soft" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{m.name}</div>
          <div className="text-xs text-ink-3 truncate">{m.address ?? <span className="text-warn">Keine Adresse hinterlegt</span>}</div>
        </div>
        <div className="text-right shrink-0">
          {m.invoice ? (
            <Link href={`/billing/invoices/${m.invoice.id}/print`} target="_blank" className="block"><Badge tone={st!.tone}>{m.invoice.number} · {st!.label}</Badge></Link>
          ) : m.coveredBy ? (
            <Badge tone="outline">In Haushaltsrechnung{m.coveredBy.number ? ` ${m.coveredBy.number}` : ""}</Badge>
          ) : m.effectiveCents && m.effectiveCents > 0 ? (
            <button type="button" disabled={pending} onClick={invoice} className="press inline-flex items-center gap-1 h-11 px-3 rounded-control border border-line text-xs font-medium"><FilePlus className="h-3.5 w-3.5" /> Rechnung {year}</button>
          ) : (
            <span className="text-xs text-ink-3">kein Beitrag</span>
          )}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_90px_80px_40px] gap-2 items-center">
        <select value={catId} onChange={(e) => setCatId(e.target.value)} className="h-10 rounded-control border border-line bg-surface px-2 text-sm">
          <option value="">Keine Kategorie</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.amountCents ? formatMoney(c.amountCents, currency) : "0"})</option>)}
        </select>
        <input value={override} onChange={(e) => setOverride(e.target.value)} placeholder={m.category ? (m.category.amountCents / 100).toFixed(2) : "Betrag"} inputMode="decimal" title="Individueller Betrag (überschreibt Kategorie)" className="h-10 rounded-control border border-line bg-surface px-2 text-sm tabular-nums" />
        <input value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} placeholder="Nr." title="Mitgliedernummer" className="h-10 rounded-control border border-line bg-surface px-2 text-sm" />
        <button type="button" onClick={save} disabled={!dirty || pending} className={cn("h-10 w-10 rounded-control flex items-center justify-center", dirty ? "bg-ink text-bg" : saved ? "text-ok" : "text-ink-3/40")} aria-label="Speichern">{pending ? <Spinner /> : <Check className="h-4 w-4" />}</button>
      </div>
      {err ? <p className="mt-1 text-xs text-accent">{err}</p> : null}
    </div>
  );
}
