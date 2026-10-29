"use client";

import type { ActionResult } from "@/lib/action-result";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";

/**
 * Server Action aufrufen und Rückmeldung als Toast zeigen. Liefert das Ergebnis oder
 * { ok: false, network: true } bei Verbindungsproblemen (dann gleiche clientId wiederverwenden).
 */
export async function callAction<T>(fn: () => Promise<ActionResult<T>>, opts?: { silent?: boolean }): Promise<(ActionResult<T> & { network?: false }) | { ok: false; error: string; network: true }> {
  try {
    const res = await fn();
    if (!res.ok) toast.error(res.error);
    else if (res.message && !opts?.silent) toast.success(res.message);
    return res;
  } catch (err) {
    if (isNavigationError(err)) throw err;
    const offline = isNetworkError(err);
    const error = offline ? "Keine Verbindung. Bitte nochmals tippen, sobald du wieder Empfang hast – es entsteht kein doppelter Eintrag." : "Das hat nicht geklappt. Bitte nochmals versuchen.";
    toast.error(error);
    return { ok: false, error, network: true };
  }
}
