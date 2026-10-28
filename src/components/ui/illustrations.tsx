/**
 * Einfache Strichzeichnungen im Schiess-Thema für leere Zustände, Onboarding und
 * Fehlerseiten. Reines SVG, folgt den Farb-Tokens (currentColor + var(--accent)),
 * funktioniert hell und dunkel. Dekorativ (aria-hidden).
 */

type IllustrationProps = { size?: number; className?: string };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Frame({ size = 96, className, children, viewBox = "0 0 96 96" }: IllustrationProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} className={className ?? "text-ink-2"} aria-hidden focusable="false">
      {children}
    </svg>
  );
}

/** Zielscheibe mit Ringen und Treffern */
export function TargetIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <circle cx="48" cy="48" r="34" {...stroke} />
      <circle cx="48" cy="48" r="24" {...stroke} opacity="0.75" />
      <circle cx="48" cy="48" r="14" {...stroke} opacity="0.55" />
      <circle cx="48" cy="48" r="6" fill="var(--accent)" />
      <path d="M48 8v8M48 80v8M8 48h8M80 48h8" {...stroke} strokeWidth={1.6} opacity="0.5" />
      <circle cx="56" cy="40" r="2.6" fill="currentColor" />
      <circle cx="41" cy="55" r="2.6" fill="currentColor" />
      <circle cx="62" cy="58" r="2.6" fill="currentColor" opacity="0.6" />
    </Frame>
  );
}

/** Kalenderblatt mit markiertem Tag */
export function CalendarIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <rect x="22" y="26" width="52" height="46" rx="7" {...stroke} />
      <path d="M22 38h52M34 20v12M62 20v12" {...stroke} />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => (
        <circle key={`${c}-${r}`} cx={32 + c * 11} cy={47 + r * 9} r="1.8" fill="currentColor" opacity="0.45" />
      )))}
      <circle cx="54" cy="56" r="6" fill="none" stroke="var(--accent)" strokeWidth="2.4" />
      <circle cx="54" cy="56" r="2" fill="var(--accent)" />
    </Frame>
  );
}

/** Rechnung mit QR-Zahlteil */
export function InvoiceIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <path d="M28 18h30l12 12v48H28z" {...stroke} />
      <path d="M58 18v12h12" {...stroke} />
      <path d="M35 34h16M35 42h26M35 50h20" {...stroke} strokeWidth={1.8} opacity="0.6" />
      <rect x="35" y="57" width="14" height="14" rx="1.5" {...stroke} strokeWidth={1.8} />
      <path d="M39 61h2v2h-2zM44 61h1M39 66h1M43 65h2v2h-2z" fill="currentColor" stroke="currentColor" strokeWidth={1} />
      <rect x="40.5" y="62.5" width="3" height="3" fill="var(--accent)" />
      <path d="M55 66h8" {...stroke} stroke="var(--accent)" />
    </Frame>
  );
}

/** Gruppe / Verein (für Beitreten) */
export function TeamIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <circle cx="34" cy="40" r="8" {...stroke} />
      <circle cx="62" cy="40" r="8" {...stroke} />
      <path d="M20 68c2-9 8-14 14-14s12 5 14 14M48 68c2-9 8-14 14-14s12 5 14 14" {...stroke} />
      <circle cx="48" cy="24" r="5" fill="var(--accent)" />
    </Frame>
  );
}

/** Schützenhaus / Anlage (für Neu anlegen) */
export function ClubhouseIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <path d="M20 44 48 24l28 20" {...stroke} />
      <path d="M26 40v32h44V40" {...stroke} />
      <rect x="42" y="54" width="12" height="18" rx="1.5" {...stroke} />
      <circle cx="48" cy="40" r="6" {...stroke} strokeWidth={1.8} />
      <circle cx="48" cy="40" r="2" fill="var(--accent)" />
      <path d="M72 30v-8l8 3-8 3" {...stroke} stroke="var(--accent)" />
    </Frame>
  );
}

/** Keine Verbindung */
export function OfflineIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <path d="M24 44a34 34 0 0 1 48 0M32 52a22 22 0 0 1 32 0M40 60a10 10 0 0 1 16 0" {...stroke} />
      <circle cx="48" cy="68" r="3" fill="currentColor" />
      <path d="M26 24l44 48" {...stroke} stroke="var(--accent)" />
    </Frame>
  );
}

/** Daneben geschossen (Fehler / nicht gefunden) */
export function MissIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <circle cx="44" cy="52" r="26" {...stroke} />
      <circle cx="44" cy="52" r="16" {...stroke} opacity="0.7" />
      <circle cx="44" cy="52" r="6" {...stroke} opacity="0.5" />
      <circle cx="76" cy="20" r="4" fill="var(--accent)" />
      <path d="M70 26l-4 4M80 14l3-3" {...stroke} stroke="var(--accent)" strokeWidth={1.8} />
    </Frame>
  );
}

/** Lupe (Suche ohne Treffer) */
export function SearchIllustration(p: IllustrationProps) {
  return (
    <Frame {...p}>
      <circle cx="48" cy="48" r="44" fill="var(--surface-2)" />
      <circle cx="43" cy="43" r="17" {...stroke} />
      <path d="M56 56l14 14" {...stroke} strokeWidth={3} />
      <circle cx="43" cy="43" r="4" fill="var(--accent)" />
    </Frame>
  );
}
