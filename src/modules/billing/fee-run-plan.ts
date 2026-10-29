/**
 * Jahreslauf Mitgliederbeiträge: Wer erhält welche Rechnung? Reine Planung ohne Datenbank.
 * Mit «Haushalte zusammenfassen» erhalten Mitglieder desselben Haushalts EINE Rechnung an den
 * Zahler (Summe der Beiträge, Bezeichnung «Familie Muster (3 Mitglieder)»).
 */
import { HOUSEHOLD_INVOICE_RE, householdInvoiceLabel } from "../members/types";

export type FeeSnapshot = { id: string; userId: string; name: string; email: string; address: string | null; categoryId: string | null; categoryName: string; amountCents: number };

export type FeeCandidate = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  address: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  /** Beitrag (Überschreibung oder Kategorie), null = keiner */
  amountCents: number | null;
  householdId: string | null;
  /** Nicht stornierte Rechnungen dieses Jahres auf diese Mitgliedschaft (nur categoryName zählt) */
  invoices: Array<{ categoryName: string }>;
};

export type FeeHousehold = { id: string; name: string; payerUserId: string | null };

const hasFee = (c: FeeCandidate) => c.amountCents !== null && c.amountCents > 0;

function single(c: FeeCandidate): FeeSnapshot {
  return { id: c.membershipId, userId: c.userId, name: c.name, email: c.email, address: c.address, categoryId: c.categoryId, categoryName: c.categoryName ?? "Mitgliederbeitrag", amountCents: c.amountCents! };
}

export function planFeeInvoices(candidates: FeeCandidate[], households: FeeHousehold[], combineHouseholds: boolean): FeeSnapshot[] {
  // Ausgetretene erhalten keine Rechnung mehr.
  const active = candidates.filter((c) => c.status !== "LEFT");
  const out: FeeSnapshot[] = [];
  const hh = new Map(households.map((h) => [h.id, h]));
  const groups = new Map<string, FeeCandidate[]>();

  for (const c of active) {
    if (combineHouseholds && c.householdId && hh.has(c.householdId)) {
      const g = groups.get(c.householdId) ?? [];
      g.push(c);
      groups.set(c.householdId, g);
      continue;
    }
    if (!c.invoices.length && hasFee(c)) out.push(single(c));
  }

  for (const [householdId, members] of groups) {
    const household = hh.get(householdId)!;
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
    const payer = sorted.find((m) => m.userId === household.payerUserId) ?? sorted.find(hasFee) ?? sorted[0]!;
    // Hat der Zahler bereits eine Haushaltsrechnung, ist der ganze Haushalt erledigt.
    if (payer.invoices.some((i) => HOUSEHOLD_INVOICE_RE.test(i.categoryName))) continue;
    const open = sorted.filter((m) => !m.invoices.length && hasFee(m));
    if (!open.length) continue;
    if (open.length === 1) {
      out.push(single(open[0]!));
      continue;
    }
    const sum = open.reduce((s, m) => s + m.amountCents!, 0);
    const categories = new Set(open.map((m) => m.categoryId));
    out.push({
      id: payer.membershipId,
      userId: payer.userId,
      name: payer.name,
      email: payer.email,
      address: payer.address,
      categoryId: categories.size === 1 ? open[0]!.categoryId : null,
      categoryName: householdInvoiceLabel(household.name, open.length),
      amountCents: sum,
    });
  }
  return out;
}
