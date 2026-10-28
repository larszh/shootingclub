import "server-only";
import { db } from "@/lib/db";
import { compactCode } from "@/lib/qr-reference";
import type { CamtCredit } from "./camt";
import type { ImportPreviewItem, ImportTarget } from "./import-types";

export type { ImportPreviewItem, ImportTarget, ImportStatus } from "./import-types";

type Candidate = ImportTarget & { reference: string | null };

async function loadCandidates(tenantId: string, since: Date): Promise<Candidate[]> {
  const [fees, invoices, ammo] = await Promise.all([
    db.feeInvoice.findMany({
      where: { tenantId, issuedAt: { gte: since } },
      select: { id: true, number: true, reference: true, amountCents: true, currency: true, status: true, memberName: true, year: true, categoryName: true },
    }),
    db.invoice.findMany({
      where: { tenantId, issuedAt: { gte: since } },
      select: { id: true, number: true, reference: true, amountCents: true, currency: true, status: true, booking: { select: { user: { select: { name: true } }, resource: { select: { name: true } } } } },
    }),
    // Munitionsrechnungen entstehen bei der Ausgabe (invoiceNumber + invoiceIssuedAt gesetzt).
    db.ammoOrder.findMany({
      where: { tenantId, invoiceNumber: { not: null }, invoiceIssuedAt: { gte: since } },
      select: { id: true, invoiceNumber: true, reference: true, totalCents: true, currency: true, status: true, paymentStatus: true, user: { select: { name: true } }, items: { select: { productName: true }, take: 2 } },
    }),
  ]);
  return [
    ...fees.map((f) => ({ kind: "FEE" as const, id: f.id, number: f.number, reference: f.reference, amountCents: f.amountCents, currency: f.currency, status: f.status, name: f.memberName, label: `Beitrag ${f.year} · ${f.categoryName}` })),
    ...invoices.map((i) => ({ kind: "BOOKING" as const, id: i.id, number: i.number, reference: i.reference, amountCents: i.amountCents, currency: i.currency, status: i.status, name: i.booking.user?.name ?? "Gast", label: `Reservation ${i.booking.resource.name}` })),
    ...ammo.map((a) => ({
      kind: "AMMO" as const,
      id: a.id,
      number: a.invoiceNumber ?? "",
      reference: a.reference,
      amountCents: a.totalCents,
      currency: a.currency,
      // gleiche Statuswerte wie bei den anderen Rechnungen: OPEN | PAID | CANCELLED
      status: a.paymentStatus === "PAID" ? "PAID" : a.paymentStatus === "CANCELLED" || a.status !== "ISSUED" ? "CANCELLED" : "OPEN",
      name: a.user?.name ?? "Ehemaliges Mitglied",
      label: `Munition${a.items.length ? ` · ${a.items.map((i) => i.productName).join(", ")}` : ""}`.slice(0, 120),
    })),
  ];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rechnungsnummern, die als eigenes «Wort» in der Mitteilung vorkommen (auch ohne Bindestriche). */
function numberMentioned(text: string, number: string) {
  if (!text || !number) return false;
  const upper = text.toUpperCase();
  const n = number.toUpperCase();
  const variants = new Set([n, n.replace(/[-\s]/g, ""), n.replace(/-/g, " ")]);
  for (const v of variants) {
    if (v.length < 4) continue;
    if (new RegExp(`(?<![A-Z0-9])${escapeRe(v)}(?![0-9])`).test(upper)) return true;
  }
  return false;
}

function toTarget(c: Candidate): ImportTarget {
  return { kind: c.kind, id: c.id, number: c.number, name: c.name, label: c.label, amountCents: c.amountCents, currency: c.currency, status: c.status };
}

/**
 * Ordnet Gutschriften offenen Rechnungen zu:
 * 1. über die QR-Referenz (eindeutig),
 * 2. sonst über Rechnungsnummer in der Mitteilung und exakten Betrag.
 * Berücksichtigt Mitgliederbeiträge, Reservations- und Munitionsrechnungen.
 */
export async function matchCredits(tenantId: string, credits: CamtCredit[], since: Date): Promise<ImportPreviewItem[]> {
  const candidates = await loadCandidates(tenantId, since);
  const byRef = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!c.reference) continue;
    const k = compactCode(c.reference);
    byRef.set(k, [...(byRef.get(k) ?? []), c]);
  }
  const claimed = new Set<string>();

  return credits.map((cr) => {
    const text = [cr.message, cr.reference ?? ""].join(" ");
    let matchedBy: ImportPreviewItem["matchedBy"] = null;
    let found: Candidate[] = [];
    if (cr.reference && byRef.has(compactCode(cr.reference))) {
      found = byRef.get(compactCode(cr.reference))!;
      matchedBy = "reference";
    } else {
      const mentioned = candidates.filter((c) => numberMentioned(text, c.number));
      if (mentioned.length) {
        matchedBy = "number";
        const sameAmount = mentioned.filter((c) => c.amountCents === cr.amountCents && c.currency === cr.currency);
        const openSameAmount = sameAmount.filter((c) => c.status === "OPEN");
        found = openSameAmount.length === 1 ? openSameAmount : sameAmount.length ? sameAmount : mentioned;
      }
    }

    const base = { ...cr, matchedBy, candidates: found.slice(0, 5).map((c) => ({ number: c.number, name: c.name })) };
    if (found.length === 0) return { ...base, status: "unmatched" as const, reason: cr.reference ? "Referenz unbekannt" : null, target: null };
    if (found.length > 1) return { ...base, status: "ambiguous" as const, reason: `${found.length} mögliche Rechnungen`, target: null };

    const c = found[0]!;
    const target = toTarget(c);
    const claimKey = `${c.kind}:${c.id}`;
    if (c.status === "PAID") return { ...base, status: "already_paid" as const, reason: null, target };
    if (c.status === "CANCELLED") return { ...base, status: "unmatched" as const, reason: `Rechnung ${c.number} ist storniert`, target };
    if (claimed.has(claimKey)) return { ...base, status: "duplicate" as const, reason: `${c.number} kommt mehrfach vor`, target };
    claimed.add(claimKey);
    if (c.currency !== cr.currency) return { ...base, status: "amount_mismatch" as const, reason: `Währung ${cr.currency} statt ${c.currency}`, target };
    if (c.amountCents !== cr.amountCents) return { ...base, status: "amount_mismatch" as const, reason: null, target };
    return { ...base, status: "matched" as const, reason: null, target };
  });
}
