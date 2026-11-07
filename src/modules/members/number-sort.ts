/**
 * Mitgliedernummern natürlich sortieren: «9» vor «10», «A2» vor «A10», «M-007» wie «M-7».
 * Rein (ohne DB), testbar. Leere Nummern kommen ans Ende; bei gleicher Nummer entscheidet der Name.
 */

const collator = new Intl.Collator("de-CH", { numeric: true, sensitivity: "base" });

/** Vergleich zweier Mitgliedernummern (null/leer zuletzt). */
export function compareMemberNumbers(a: string | null | undefined, b: string | null | undefined): number {
  const x = a?.trim() ?? "";
  const y = b?.trim() ?? "";
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  // Rein numerische Nummern exakt als Zahl vergleichen (auch sehr lange, mit führenden Nullen).
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    const nx = x.replace(/^0+(?=\d)/, "");
    const ny = y.replace(/^0+(?=\d)/, "");
    if (nx.length !== ny.length) return nx.length - ny.length;
    if (nx !== ny) return nx < ny ? -1 : 1;
    return x.length - y.length;
  }
  return collator.compare(x, y);
}

export type NumberSortable = { memberNumber: string | null; name: string };

/** Sortiert nach Mitgliedernummer (natürlich), dann nach Name. Gibt eine neue Liste zurück. */
export function sortByMemberNumber<T extends NumberSortable>(list: T[]): T[] {
  return [...list].sort((a, b) => compareMemberNumbers(a.memberNumber, b.memberNumber) || collator.compare(a.name, b.name));
}
