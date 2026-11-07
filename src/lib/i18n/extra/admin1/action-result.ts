/**
 * Übersetzte Varianten von fail()/ok() aus "@/lib/action-result" für Server-Aktionen der Verwaltung.
 * Meldungen bleiben im Code deutsch (wie in Diensten und zod-Schemas) und werden beim Zurückgeben
 * über trMsg() in die Sprache der Anfrage übersetzt. Nur auf dem Server verwenden.
 */
import { fail as baseFail, ok as baseOk, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT } from "@/lib/i18n";
import { trFieldErrors, trMsg } from "./msg";

async function currentT() {
  return getT(await getRequestLocale());
}

/** Wie fail(), mit übersetzter Meldung und übersetzten Feldfehlern. */
export async function lfail(error: string, fieldErrors?: Record<string, string>): Promise<ActionResult<never>> {
  const t = await currentT();
  return baseFail(trMsg(t, error), trFieldErrors(t, fieldErrors));
}

/** Wie ok(), mit übersetzter Meldung. */
export async function lok<T>(data?: T, message?: string): Promise<ActionResult<T>> {
  if (message === undefined) return baseOk(data);
  return baseOk(data, trMsg(await currentT(), message));
}

/** Ergebnis einer bestehenden Aktion nachträglich übersetzen. */
export async function localizeResult<T>(r: ActionResult<T>): Promise<ActionResult<T>> {
  const t = await currentT();
  if (r.ok) return r.message ? { ...r, message: trMsg(t, r.message) } : r;
  return { ...r, error: trMsg(t, r.error), fieldErrors: trFieldErrors(t, r.fieldErrors) };
}
