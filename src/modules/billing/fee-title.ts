/**
 * Bezeichnung einer Beitragsrechnung (FeeInvoice) für Titel, Rechnungsposition und QR-Mitteilung.
 * Jahreslauf: Titel des Laufs. Einzelrechnung ausserhalb des Jahreslaufs (runId und membershipId leer,
 * z.B. Ersatzabgabe Arbeitsstunden): ihre eigene Bezeichnung (categoryName), nicht «Mitgliederbeitrag».
 * Sonst (z.B. gelöschter Jahreslauf) die Ersatzbezeichnung `annualFallback`.
 */
export function isStandaloneFeeInvoice(f: { runId?: string | null; membershipId?: string | null }) {
  return f.runId === null && f.membershipId === null;
}

export function feeInvoiceTitle(
  f: { run?: { title: string } | null; runId?: string | null; membershipId?: string | null; categoryName: string },
  annualFallback: string,
): string {
  if (f.run?.title) return f.run.title;
  if (isStandaloneFeeInvoice(f) && f.categoryName.trim()) return f.categoryName;
  return annualFallback;
}

/** Bereichsbezeichnung einer Beitragsrechnung: Einzelrechnungen (z.B. Ersatzabgabe) sind kein Mitgliederbeitrag. */
export function feeInvoiceSourceLabel(f: { runId?: string | null; membershipId?: string | null }): string {
  return isStandaloneFeeInvoice(f) ? "Vereinsrechnung" : "Mitgliederbeitrag";
}
