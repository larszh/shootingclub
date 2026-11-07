"use client";

import { setOverrides, type OverrideMap } from "./core";

/**
 * Setzt die Übersteuerungen im Browser synchron beim Rendern – vor den Kindern, damit
 * getT()/useT() schon beim ersten Rendern (und bei der Hydration) dieselben Texte liefert
 * wie der Server. Im Root-Layout um den App-Inhalt legen. Gleiches Objekt → No-op.
 *
 * Nur im Browser: beim SSR ist `overrides` eine Kopie aus dem RSC-Payload dieses Requests.
 * Sie in die prozessweite Registry zu schreiben, könnte eine inzwischen neu geladene Tabelle
 * (reloadOverrides() nach dem Speichern) mit dem alten Stand überschreiben. Server-seitig
 * liest t() die Registry ohnehin direkt.
 */
export function I18nOverrides({ overrides, children }: { overrides: OverrideMap; children?: React.ReactNode }) {
  if (typeof window !== "undefined") setOverrides(overrides);
  return <>{children}</>;
}
