import "server-only";
import { registerJob } from "./index";
import { sendDueMails } from "@/lib/mail/sender";
import { runCleanup } from "./cleanup";
import { purgeDeletedTenants } from "@/modules/core/tenant-purge";
import { backfillMatchTotals } from "@/modules/scores/sync";
import { runShiftReminders } from "@/modules/shifts/service";
import { runWeaponReminders } from "@/modules/weapons/service";
import { runFederalReminders } from "@/modules/federal/service";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Erinnerungs-Hooks: Funktionen anderer Module, die stündlich laufen und selbst entscheiden,
 * ob etwas fällig ist (z.B. Mails mit dedupeKey). Neue Hooks hier eintragen.
 */
const REMINDER_HOOKS: Array<{ name: string; fn: () => Promise<unknown> }> = [
  // Jeder Hook dedupliziert selbst (Audit-Marker «<modul>.reminder»), stündlicher Aufruf ist sicher.
  { name: "shifts", fn: () => runShiftReminders() }, // 07–22 Uhr: Schicht in 24 h, Unterbesetzung, ablaufende Qualifikationen
  { name: "weapons", fn: () => runWeaponReminders() }, // ab 08 Uhr: überfällige Ausleihen, Meldefristen Minderjährige, Wartung
  { name: "federal", fn: () => runFederalReminders() }, // Fristen 14/3 Tage vorher, Vorabend-Erinnerung Obligatorisch
];

/** Alle Plattform-Jobs registrieren. Wird vom Runner einmal pro Prozess aufgerufen. */
export function registerDefaultJobs() {
  registerJob("mail.send", 30_000, async () => {
    await sendDueMails();
  });

  registerJob("cleanup", HOUR, async () => {
    await runCleanup();
  });

  registerJob("tenant.purge", DAY, async () => {
    await purgeDeletedTenants();
  });

  // Gespeicherte Totale (MatchParticipant.total/zeros) für Altdaten nachtragen; idempotent,
  // höchstens 10 × 200 Durchgänge pro Lauf.
  registerJob("scores.backfill", DAY, async () => {
    for (let i = 0; i < 10; i++) {
      if ((await backfillMatchTotals()) === 0) break;
    }
  });

  registerJob("reminders", HOUR, async () => {
    const errors: string[] = [];
    for (const hook of REMINDER_HOOKS) {
      try {
        await hook.fn();
      } catch (err) {
        errors.push(`${hook.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (errors.length) throw new Error(errors.join("; "));
  });
}
