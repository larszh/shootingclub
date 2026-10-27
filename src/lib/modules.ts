// Modul-Registry. Jedes Modul ist pro Tenant ein-/ausschaltbar.
// Neue Module: hier eintragen, Routen unter src/app/(app)/<key> anlegen und
// Server-Logik unter src/modules/<key>.

export type ModuleKey = "scores" | "targets" | "bookings" | "billing";

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
    key: "bookings",
    name: "Reservationen",
    description: "Stände, Bahnen und Räume buchen. Kommt später.",
    href: "/bookings",
    status: "planned",
    defaultEnabled: false,
  },
  {
    key: "billing",
    name: "Zahlungen",
    description: "Rechnungen und Direktzahlung für Reservationen. Kommt später.",
    href: "/billing",
    status: "planned",
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
