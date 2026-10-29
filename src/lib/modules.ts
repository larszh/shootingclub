// Modul-Registry. Jedes Modul ist pro Tenant ein-/ausschaltbar.
// Neue Module: hier eintragen, Routen unter src/app/(app)/<key> anlegen und
// Server-Logik unter src/modules/<key>.

export type ModuleKey =
  | "scores"
  | "targets"
  | "events"
  | "bookings"
  | "billing"
  | "files"
  | "chat"
  | "ammo"
  | "federal"
  | "range"
  | "weapons"
  | "shifts"
  | "courses"
  | "championship";

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
  {
    key: "files",
    name: "Dateiablage",
    description: "Dokumente, Reglemente und Fotos in Ordnern ablegen, mit Sichtbarkeit pro Gruppe. Speicherort wählbar: Server, S3/AWS, Hetzner oder Nextcloud.",
    href: "/files",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "chat",
    name: "Chat",
    description: "Direktnachrichten und Gruppenchats unter Vereinsmitgliedern, mit Ungelesen-Anzeige.",
    href: "/chat",
    status: "ready",
    defaultEnabled: true,
  },
  {
    key: "ammo",
    name: "Munition",
    description: "Munition im Verein bestellen und ausgeben, Abrechnung nur auf Rechnung mit QR-Rechnung.",
    href: "/ammo",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "federal",
    name: "Bundesübungen",
    description: "Obligatorisch und Feldschiessen: amtliche Resultate bestätigen, Verbliebene, Fristen, Export für SAT-Admin, Schiessnachweis.",
    href: "/federal",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "range",
    name: "Standbetrieb",
    description: "Standbuch mit Check-in, Gäste, Standordnung, bewilligte Schiesszeiten und Halbtage-Kontingent, Vorfälle.",
    href: "/range",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "weapons",
    name: "Vereinswaffen",
    description: "Inventar der Vereinswaffen mit Ausleihe, Schusszähler und Wartung.",
    href: "/weapons",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "shifts",
    name: "Helfereinsätze",
    description: "Schichtplan für Anlässe und Standdienst, Arbeitsstunden-Konto mit Ersatzabgabe, Qualifikationen.",
    href: "/shifts",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "courses",
    name: "Kurse",
    description: "Jungschützenkurs, J+S, Ausbildung und Qualifikationsschiessen mit Präsenz und Pflichtprogrammen.",
    href: "/courses",
    status: "ready",
    defaultEnabled: false,
  },
  {
    key: "championship",
    name: "Jahresmeisterschaft",
    description: "Vereinsmeisterschaft mit Streichresultaten, Pflichtprogrammen, Kategorien und Rangliste für die GV.",
    href: "/championship",
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
