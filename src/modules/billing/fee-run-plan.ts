/**
 * Jahreslauf Mitgliederbeiträge: Wer erhält welche Rechnung? Reine Planung ohne Datenbank.
 * Mit «Haushalte zusammenfassen» erhalten Mitglieder desselben Haushalts EINE Rechnung an den
 * Zahler (Summe der Beiträge, Bezeichnung «Familie Muster (3 Mitglieder)»).
 */
import { getT } from "@/lib/i18n/core";
import { HOUSEHOLD_INVOICE_RE, householdInvoiceLabel } from "../members/types";

export type FeeSnapshot = {
  id: string; userId: string; name: string; email: string; address: string | null; categoryId: string | null; categoryName: string; amountCents: number;
  /** Nur Haushaltsrechnung: die darin verrechneten Mitgliedschaften (wird beim Anlegen festgehalten). */
  covers?: Array<{ membershipId: string; name: string }>;
};

export type FeeCandidateInvoice = {
  id?: string;
  categoryName: string;
  number?: string;
  issuedAt?: Date;
  /**
   * Nur Haushaltsrechnungen: die beim Anlegen festgehaltenen Mitgliedschaften, die darin enthalten sind.
   * undefined/null = nicht festgehalten (ältere Rechnung), dann gilt die Schätzung über den Haushalt.
   */
  members?: string[] | null;
};

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
  /** Erfasst am – nur für ältere Haushaltsrechnungen ohne festgehaltene Mitglieder. */
  createdAt?: Date;
  /** Nicht stornierte Rechnungen dieses Jahres auf diese Mitgliedschaft */
  invoices: FeeCandidateInvoice[];
};

export type CoverageInput = Pick<FeeCandidate, "membershipId" | "householdId" | "createdAt" | "invoices">;

/**
 * Mitgliedschaften ohne eigene Rechnung, die eine Haushaltsrechnung dieses Jahres bereits abdeckt.
 * Die Haushaltsrechnung liegt nur auf der Mitgliedschaft der Person, die damals zahlte; welche
 * Mitgliedschaften sie enthält, wird beim Anlegen festgehalten (`members`). Abgedeckt ist genau, wer
 * darin enthalten war – unabhängig davon, wer heute zahlt, ob die zahlende Person ausgetreten oder
 * nicht mehr im Haushalt ist, ob «Haushalte zusammenfassen» aus ist, und unabhängig davon, wer
 * später in den Haushalt kommt.
 * Ältere Haushaltsrechnungen ohne festgehaltene Mitglieder: abgedeckt sind die Mitglieder desselben
 * Haushalts, die vor der Rechnung erfasst wurden (Schätzung).
 * Liste muss alle Mitgliedschaften des Vereins enthalten, auch ausgetretene.
 */
export function householdCoverage(list: CoverageInput[]): Map<string, { number: string | null }> {
  const recorded = new Map<string, { number: string | null }>();
  const legacy = new Map<string, Array<{ number: string | null; issuedAt?: Date }>>();
  for (const c of list) {
    for (const i of c.invoices) {
      if (!HOUSEHOLD_INVOICE_RE.test(i.categoryName)) continue;
      if (i.members) {
        for (const id of i.members) if (!recorded.has(id)) recorded.set(id, { number: i.number ?? null });
      } else if (c.householdId) {
        const g = legacy.get(c.householdId) ?? [];
        g.push({ number: i.number ?? null, issuedAt: i.issuedAt });
        legacy.set(c.householdId, g);
      }
    }
  }
  const out = new Map<string, { number: string | null }>();
  for (const c of list) {
    if (c.invoices.length) continue;
    const rec = recorded.get(c.membershipId);
    if (rec) {
      out.set(c.membershipId, rec);
      continue;
    }
    if (!c.householdId) continue;
    const inv = legacy.get(c.householdId)?.find((i) => !c.createdAt || !i.issuedAt || i.issuedAt >= c.createdAt);
    if (inv) out.set(c.membershipId, { number: inv.number });
  }
  return out;
}

export type FeeHousehold = { id: string; name: string; payerUserId: string | null };

const hasFee = (c: FeeCandidate) => c.amountCents !== null && c.amountCents > 0;

function single(c: FeeCandidate, locale?: string | null): FeeSnapshot {
  // Ohne Kategorie (nur individueller Betrag): Bezeichnung in der Sprache des Vereins.
  return { id: c.membershipId, userId: c.userId, name: c.name, email: c.email, address: c.address, categoryId: c.categoryId, categoryName: c.categoryName ?? getT(locale)("invoice.memberFee"), amountCents: c.amountCents! };
}

/** `locale`: Sprache des Vereins für die Bezeichnung der Haushaltsrechnung (Standard Deutsch). */
export function planFeeInvoices(candidates: FeeCandidate[], households: FeeHousehold[], combineHouseholds: boolean, locale?: string | null): FeeSnapshot[] {
  // Bereits verrechnet: eigene Rechnung oder durch eine Haushaltsrechnung abgedeckt (auch über Ausgetretene).
  const covered = householdCoverage(candidates);
  const billed = (c: FeeCandidate) => c.invoices.length > 0 || covered.has(c.membershipId);
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
    if (!billed(c) && hasFee(c)) out.push(single(c, locale));
  }

  for (const [householdId, members] of groups) {
    const household = hh.get(householdId)!;
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
    const payer = sorted.find((m) => m.userId === household.payerUserId) ?? sorted.find(hasFee) ?? sorted[0]!;
    const open = sorted.filter((m) => !billed(m) && hasFee(m));
    if (!open.length) continue;
    if (open.length === 1) {
      out.push(single(open[0]!, locale));
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
      categoryName: householdInvoiceLabel(household.name, open.length, locale),
      amountCents: sum,
      covers: open.map((m) => ({ membershipId: m.membershipId, name: m.name })),
    });
  }
  return out;
}
