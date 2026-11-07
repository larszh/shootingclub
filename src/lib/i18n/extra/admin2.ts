/**
 * Zusatz-Wörterbuch «admin2» (Welle E): Verwaltungs-, Trainer-, Super-Admin- und Verbandsseiten
 * für Standbetrieb, Bundesübungen, Vereinswaffen, Helfereinsätze, Kurse, Qualifikationen,
 * Jahresmeisterschaft, Live-Rangliste, Widgets, Scheiben und Verband sowie deren Druckseiten.
 *
 * Aufbau: pro Schlüssel ein Tupel [de, fr, it, en] in den Teil-Dateien unter ./admin2/.
 * Platzhalter {name} usw. in allen Sprachen identisch. Im Französischen setzt frSpacing() die
 * schmalen geschützten Leerzeichen (« », ? ! ; und :). Mehrzahl über `<basis>.one`/`<basis>.other`.
 */
import type { Rows } from "./admin2/row";
import common from "./admin2/common";
import range from "./admin2/range";
import federal from "./admin2/federal";
import weapons from "./admin2/weapons";
import shifts from "./admin2/shifts";
import courses from "./admin2/courses";
import championship from "./admin2/championship";
import qualifications from "./admin2/qualifications";
import live from "./admin2/live";
import embed from "./admin2/embed";
import association from "./admin2/association";
import superAdmin from "./admin2/super";
import targets from "./admin2/targets";
import awards from "./admin2/awards";

/** Französische Typografie: schmale geschützte Leerzeichen bei Guillemets und vor ? ! ; :. */
export function frSpacing(s: string): string {
  return s
    .replace(/«[   ]?/g, "« ")
    .replace(/[   ]?»/g, " »")
    .replace(/ ([?!;:])(?=\s|$|\))/g, " $1");
}

export const ROWS: Rows = {
  ...common, ...range, ...federal, ...weapons, ...shifts, ...courses, ...championship,
  ...qualifications, ...live, ...embed, ...association, ...superAdmin, ...targets, ...awards,
};

const de: Record<string, string> = {};
const fr: Record<string, string> = {};
const it: Record<string, string> = {};
const en: Record<string, string> = {};
for (const [key, [d, f, i, e]] of Object.entries(ROWS)) {
  de[key] = d;
  fr[key] = frSpacing(f);
  it[key] = i;
  en[key] = e;
}

const dict: { de: Record<string, string>; fr: Record<string, string>; it: Record<string, string>; en: Record<string, string> } = { de, fr, it, en };

export default dict;
