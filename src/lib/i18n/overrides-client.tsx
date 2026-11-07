"use client";

import { setOverrides, type OverrideMap } from "./core";

/**
 * Setzt die Übersteuerungen im Browser synchron beim Rendern – vor den Kindern, damit
 * getT()/useT() schon beim ersten Rendern (und bei der Hydration) dieselben Texte liefert
 * wie der Server. Im Root-Layout um den App-Inhalt legen. Gleiches Objekt → No-op.
 */
export function I18nOverrides({ overrides, children }: { overrides: OverrideMap; children?: React.ReactNode }) {
  setOverrides(overrides);
  return <>{children}</>;
}
