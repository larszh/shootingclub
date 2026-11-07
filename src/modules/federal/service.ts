import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify, tenantUserIdsWithRole } from "@/lib/notify";
import { addDays, zurichParts, zurichToUtc } from "@/lib/time";
import { getT, INTL_LOCALE } from "@/lib/i18n/core";
import { getTenantLocale } from "@/lib/i18n";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { listShootingDaysFromVisits } from "@/modules/range/queries";
import { DEADLINE_FIELDS, dbDateToDay, dueDeadlineReminders, mergeShootingDays, swissDay, type DeadlineKey, type ShootingDay } from "./types";

// ---------------------------------------------------------------------------
// Schiesstage (Vertrag für andere Module)
// ---------------------------------------------------------------------------

/**
 * Schiesstage eines Mitglieds im Verein zwischen `from` und `to` (Schweizer Kalendertage, inklusive):
 * Teilnahmen an abgeschlossenen Durchgängen mit erfasstem Resultat und Standbesuche (Standbuch).
 * Pro Tag ein Eintrag; Durchgänge haben Vorrang vor Besuchen. Aufsteigend sortiert.
 */
export async function shootingDaysForUser(tenantId: string, userId: string, from: Date, to: Date): Promise<ShootingDay[]> {
  const margin = 36 * 3600_000;
  const [parts, visits] = await Promise.all([
    db.matchParticipant.findMany({
      where: {
        userId,
        // Erfasstes Resultat: Serien oder ein gespeichertes Total (z.B. übernommene/importierte Resultate ohne Serien)
        OR: [{ results: { some: {} } }, { total: { not: null } }],
        match: { tenantId, status: "FINISHED", date: { gte: new Date(from.getTime() - margin), lte: new Date(to.getTime() + margin) } },
      },
      select: { match: { select: { date: true } } },
      take: 5000,
    }),
    listShootingDaysFromVisits(tenantId, userId, from, to),
  ]);
  return mergeShootingDays(
    parts.map((p) => p.match.date),
    visits,
    { from, to },
  );
}

// ---------------------------------------------------------------------------
// Erinnerungen (stündlich über den Job «reminders»)
// ---------------------------------------------------------------------------

const REMINDER_ACTION = "federal.reminder";

/** Wurde diese Erinnerung schon verschickt? (Merker im Protokoll, damit auch Push nur einmal kommt) */
async function alreadySent(tenantId: string, key: string) {
  const row = await db.auditLog.findFirst({ where: { tenantId, action: REMINDER_ACTION, entityId: key }, select: { id: true } });
  return !!row;
}

async function markSent(tenantId: string, key: string, detail: string) {
  await audit({ tenantId, action: REMINDER_ACTION, entity: "FederalYear", entityId: key, detail });
}

async function federalTenantIds(): Promise<string[]> {
  const rows = await db.tenantModule.findMany({ where: { moduleKey: "federal", enabled: true, tenant: { deletedAt: null } }, select: { tenantId: true } });
  return rows.map((r) => r.tenantId);
}

/** Ab dieser Stunde (Schweizer Zeit) werden Vorabend-Erinnerungen verschickt (nicht nachts). */
const EVE_REMINDER_FROM_HOUR = 16;

/**
 * Erinnerungen der Bundesübungen:
 * 1. Fristen (Meldung, letzter Schiesstag, Resultate) 14 und 3 Tage vorher an Admins (tenant.manage), je Frist und Stufe einmal.
 * 2. Am Vorabend eines Obligatorisch-Anlasses an angemeldete Mitglieder (Zusage), die in diesem Jahr
 *    noch kein bestandenes Obligatorisch haben: Unterlagen und Ausweis mitnehmen.
 * Wirft nicht für einzelne Vereine; Fehler werden gesammelt und am Schluss gemeldet.
 */
export async function runFederalReminders(now: Date = new Date()): Promise<{ deadlines: number; eve: number }> {
  const today = swissDay(now);
  const year = Number(today.slice(0, 4));
  const hour = Number(zurichParts(now).timeStr.slice(0, 2));
  let deadlines = 0;
  let eve = 0;
  const errors: string[] = [];

  for (const tenantId of await federalTenantIds()) {
    try {
      // --- 1. Fristen -----------------------------------------------------------
      const years = await db.federalYear.findMany({ where: { tenantId, year: { in: [year, year + 1] } } });
      for (const fy of years) {
        const due = dueDeadlineReminders(
          {
            registrationDeadline: dbDateToDay(fy.registrationDeadline),
            shootingDeadline: dbDateToDay(fy.shootingDeadline),
            reportDeadline: dbDateToDay(fy.reportDeadline),
          } satisfies Record<DeadlineKey, string | null>,
          today,
        );
        for (const d of due) {
          const key = `fed:${fy.id}:${d.key}:${d.day}:${d.stage}`;
          if (await alreadySent(tenantId, key)) continue;
          const admins = await tenantUserIdsWithRole(tenantId, ["OWNER", "ADMIN"]);
          if (admins.length) {
            const locale = await getTenantLocale(tenantId);
            const t = getT(locale);
            const when = d.daysLeft === 0 ? t("adm2.federal.rem.today") : d.daysLeft === 1 ? t("adm2.federal.rem.tomorrow") : t("adm2.federal.rem.inDays", { n: d.daysLeft });
            const vars = { label: t(`adm2.federal.dl.${d.key}`), year: fy.year, date: dayKeyLabel(d.day, locale), when };
            await notify({
              tenantId,
              userIds: admins,
              topic: "reminders",
              title: t("adm2.federal.rem.title", { when }),
              body: t("adm2.federal.rem.body", vars),
              emailBody: t("adm2.federal.rem.email", vars),
              url: `/federal?year=${fy.year}`,
              tag: `federal-deadline:${fy.id}:${d.key}`,
              dedupeKey: key,
            });
          }
          await markSent(tenantId, key, `${DEADLINE_FIELDS.find((f) => f.key === d.key)?.label ?? d.key} ${d.day} · ${d.stage} Tage`);
          deadlines += 1;
        }
      }

      // --- 2. Vorabend Obligatorisch --------------------------------------------
      if (hour >= EVE_REMINDER_FROM_HOUR) {
        const tomorrow = addDays(today, 1);
        const events = await db.event.findMany({
          where: { tenantId, kind: "OBLIGATORY", isCancelled: false, startsAt: { gte: zurichToUtc(tomorrow, "00:00"), lt: zurichToUtc(addDays(tomorrow, 1), "00:00") } },
          select: { id: true, title: true, startsAt: true, allDay: true, location: true, rsvps: { where: { status: "YES" }, select: { userId: true } } },
        });
        if (events.length) {
          const yearStart = zurichToUtc(`${year}-01-01`, "00:00");
          const passed = await db.matchParticipant.findMany({
            where: { isOfficial: true, passed: true, userId: { not: null }, match: { tenantId, date: { gte: yearStart }, program: { officialKind: "OP" } } },
            select: { userId: true },
          });
          const passedSet = new Set(passed.map((p) => p.userId!));
          for (const ev of events) {
            const key = `fed:op-eve:${ev.id}`;
            if (await alreadySent(tenantId, key)) continue;
            const userIds = ev.rsvps.map((r) => r.userId).filter((id) => !passedSet.has(id));
            if (userIds.length) {
              const locale = await getTenantLocale(tenantId);
              const t = getT(locale);
              const clock = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" }).format(ev.startsAt);
              const time = ev.allDay ? "" : t("adm2.federal.rem.time", { time: clock });
              await notify({
                tenantId,
                userIds,
                topic: "reminders",
                title: t("adm2.federal.rem.eveTitle"),
                body: t("adm2.federal.rem.eveBody", { title: ev.title, time, place: ev.location ? `, ${ev.location}` : "" }),
                emailBody: t("adm2.federal.rem.eveEmail", { title: ev.title, time, place: ev.location ? ` (${ev.location})` : "" }),
                url: `/events/${ev.id}`,
                tag: `federal-eve:${ev.id}`,
                dedupeKey: key,
              });
            }
            await markSent(tenantId, key, `${ev.title} · ${userIds.length} Empfänger`);
            eve += 1;
          }
        }
      }
    } catch (e) {
      errors.push(`${tenantId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (errors.length) throw new Error(`federal reminders: ${errors.join("; ")}`);
  return { deadlines, eve };
}
