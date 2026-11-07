"use client";

import type { ActionResult } from "@/lib/action-result";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { getT } from "@/lib/i18n/core";

/** Sprache der Seite aus <html lang> (vom Root-Layout gesetzt). */
const pageT = () => getT(typeof document === "undefined" ? null : document.documentElement.lang);

/**
 * Server Action aufrufen und Rückmeldung als Toast zeigen. Liefert das Ergebnis oder
 * { ok: false, network: true } bei Verbindungsproblemen (dann gleiche clientId wiederverwenden).
 */
export async function callAction<T>(fn: () => Promise<ActionResult<T>>, opts?: { silent?: boolean; /** Übersetzte Fehlertexte (Standard: Sprache der Seite) */ messages?: { network: string; failed: string } }): Promise<(ActionResult<T> & { network?: false }) | { ok: false; error: string; network: true }> {
  try {
    const res = await fn();
    if (!res.ok) toast.error(res.error);
    else if (res.message && !opts?.silent) toast.success(res.message);
    return res;
  } catch (err) {
    if (isNavigationError(err)) throw err;
    const offline = isNetworkError(err);
    const error = offline
      ? (opts?.messages?.network ?? pageT()("adm2.range.msg.network"))
      : (opts?.messages?.failed ?? pageT()("adm2.common.failed"));
    toast.error(error);
    return { ok: false, error, network: true };
  }
}
