/**
 * Jahreslauf Mitgliederbeiträge: Wer erhält welche Rechnung? Reine Planung ohne Datenbank.
 * Mit «Haushalte zusammenfassen» erhalten Mitglieder desselben Haushalts EINE Rechnung an den
 * Zahler (Summe der Beiträge, Bezeichnung «Familie Muster (3 Mitglieder)»).
 */
import { getT } from "@/lib/i18n/core";
import { hasTenantAccess } from "@/lib/membership-access";
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
   * Nur Haushaltsrechnungen: die darin enthaltenen Mitgliedschaften (Tabelle FeeInvoiceMember, bei
   * älteren Rechnungen aus dem Protokoll). undefined/null = nicht festgehalten, dann gilt die Schätzung
   * über den Haushalt.
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
  // Ausgetretene und Beitritte, die noch auf Freigabe warten, erhalten keine Rechnung.
  const active = candidates.filter((c) => hasTenantAccess(c.status));
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

/* ------------------------------------------------------------------ Haushaltsrechnungen festhalten */

/** Anzahl Mitglieder aus der Bezeichnung «Familie Muster (3 Mitglieder)», sonst null. */
export function householdCountFromLabel(categoryName: string): number | null {
  const m = /\((\d+) (?:Mitglieder|membres|membri)\)$/.exec(categoryName);
  return m ? Number(m[1]) : null;
}

export type LegacyHouseholdInvoice = { id: string; membershipId: string | null; categoryName: string; issuedAt: Date };

/**
 * Einmalige Ableitung für ältere Haushaltsrechnungen ohne festgehaltene Mitglieder: die zahlende
 * Mitgliedschaft plus die Mitglieder desselben Haushalts ohne eigene Rechnung, die vor der Rechnung
 * erfasst wurden (gleiche Schätzung wie householdCoverage). Nur wenn die Anzahl genau der Bezeichnung
 * «(n Mitglieder)» entspricht, sonst null (dann bleibt die Schätzung beim Lesen).
 * `list`: alle Mitgliedschaften des Vereins mit ihren nicht stornierten Rechnungen des Jahres.
 */
export function deriveHouseholdMembers(inv: LegacyHouseholdInvoice, list: CoverageInput[]): string[] | null {
  const expected = householdCountFromLabel(inv.categoryName);
  if (!expected || !inv.membershipId) return null;
  const payer = list.find((c) => c.membershipId === inv.membershipId);
  if (!payer?.householdId) return null;
  const others = list.filter((c) =>
    c.membershipId !== payer.membershipId && c.householdId === payer.householdId && c.invoices.length === 0 && (!c.createdAt || c.createdAt <= inv.issuedAt));
  // Die zahlende Person ist enthalten, wenn sie selbst einen Beitrag hatte; sonst nur die übrigen.
  const withPayer = [payer.membershipId, ...others.map((c) => c.membershipId)];
  if (withPayer.length === expected) return withPayer;
  if (others.length === expected) return others.map((c) => c.membershipId);
  return null;
}

/* ------------------------------------------------------------------ Übersicht */

export type FeeCoverageStats = {
  /** Mitglieder mit Zugang (ohne Ausgetretene und wartende Beitritte) und Beitrag > 0 */
  withFee: number;
  /** davon mit eigener Rechnung */
  ownInvoice: number;
  /** davon in der Haushaltsrechnung eines anderen Haushaltsmitglieds enthalten */
  household: number;
  /** davon noch ohne Rechnung (weder eigene noch Haushaltsrechnung) */
  notInvoiced: number;
};

/** Wer ist verrechnet? Haushaltsmitglieder ohne eigene Rechnung zählen als verrechnet, wenn eine Haushaltsrechnung sie abdeckt. */
export function feeCoverageStats(candidates: FeeCandidate[]): FeeCoverageStats {
  const covered = householdCoverage(candidates);
  const out: FeeCoverageStats = { withFee: 0, ownInvoice: 0, household: 0, notInvoiced: 0 };
  for (const c of candidates) {
    if (!hasTenantAccess(c.status)) continue;
    const own = c.invoices.length > 0;
    const inHousehold = !own && covered.has(c.membershipId);
    if (!hasFee(c) && !own && !inHousehold) continue;
    out.withFee++;
    if (own) out.ownInvoice++;
    else if (inHousehold) out.household++;
    else out.notInvoiced++;
  }
  return out;
}
