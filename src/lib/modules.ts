// Modul-Registry. Jedes Modul ist pro Tenant ein-/ausschaltbar.
// Neue Module: hier eintragen, Routen unter src/app/(app)/<key> anlegen und
// Server-Logik unter src/modules/<key>.

export type ModuleKey = "scores" | "targets" | "events" | "bookings" | "billing";

export type ModuleDefinition = {
  key: ModuleKey;
  name: string;
  description: string;
  href: string;
  status: "ready" | "planned";
  /** Standardmässig für neue Tenants aktiviert */
  defaultEnabled: boolean;
};

export const MODULES: ModuleDefinition[] = [
  {
    key: "scores",
    name: "Punkteerfassung",
    description: "Programme definieren, Resultate erfassen, Wettkämpfe mit Vereinskollegen oder Gästen.",
    href: "/scores",
    status: "ready",
    defaultEnabled: true,
  },
  {
    key: "targets",
    name: "Zielscheiben",
    description: "Druckvorlagen für A4/A5/A6 in Schwarz-Weiss, eigene Sujets hochladen.",
    href: "/targets",
    status: "ready",
    defaultEnabled: true,
  },
  {
    key: "events",
    name: "Anlässe & News",
    description: "Vereinskalender mit Trainings, Wettkämpfen und Obligatorisch-Terminen, An- und Abmeldung, Mitteilungen an alle.",
    href: "/events",
    status: "ready",
    defaultEnabled: true,
  },
  {
    key: "bookings",
    name: "Reservationen",
    description: "Anlagen und Bahnen reservieren, mit Freigabe, Rechnung oder Online-Zahlung (Stripe, Worldline, SumUp).",
    href: "/bookings",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "billing",
    name: "Mitgliederbeiträge",
    description: "Beitragskategorien, Jahresrechnung mit QR-Rechnung, Zahlungsübersicht und Erinnerungen.",
    href: "/billing",
    status: "ready",
    defaultEnabled: false,
  },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

export function getModule(key: string) {
  return MODULES.find((m) => m.key === key);
}

export function isModuleKey(key: string): key is ModuleKey {
  return MODULE_KEYS.includes(key as ModuleKey);
}
