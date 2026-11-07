import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import type { TFunction } from "@/lib/i18n";

/**
 * Anzeigetitel einer Beitragsrechnung in der Sprache des Mitglieds – gleich wie /payments
 * (localizePaymentItem): Der Standardtitel «Mitgliederbeitrag JJJJ» wird übersetzt,
 * selbst gewählte Titel des Jahreslaufs bleiben Vereinsdaten.
 */
export function localizedFeeInvoiceTitle(
  f: Parameters<typeof feeInvoiceTitle>[0] & { year: number },
  t: TFunction,
): string {
  const title = feeInvoiceTitle(f, t("money.fee.annualTitle", { year: f.year }));
  const annual = /^Mitgliederbeitrag (\d{4})$/.exec(title);
  return annual ? t("money.fee.annualTitle", { year: annual[1]! }) : title;
}
