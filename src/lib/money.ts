export function formatMoney(cents: number, currency = "CHF") {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

/** "12.50" oder "12,5" → 1250 */
export function parseMoneyToCents(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : Number(String(input).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
