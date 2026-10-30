import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify, tenantUserIdsWithRole } from "@/lib/notify";
import { addDays, formatDateZurich, formatTimeRange, zurichParts } from "@/lib/time";
import { buildIcs } from "@/modules/events/ics";
import { dayToDbDate, EXPIRY_WARN_DAYS, qualificationLabel } from "@/modules/qualifications/types";
import { formatHours, staffing } from "./logic";

// ---------------------------------------------------------------------------
// iCal für einen einzelnen Einsatz
// ---------------------------------------------------------------------------

export function shiftUid(id: string) {
  return `shift-${id}@standchef.ch`;
}

/** .ics mit genau einem VEVENT für einen Einsatz. Nur für aktuelle Mitglieder des Vereins. */
export async function buildShiftIcs(userId: string, isSuperAdmin: boolean, shiftId: string, baseUrl: string) {
  const s = await db.shift.findUnique({
    where: { id: shiftId },
    select: {
      id: true, tenantId: true, title: true, startsAt: true, endsAt: true, note: true, createdAt: true, hoursCredit: true,
      event: { select: { title: true, location: true, isCancelled: true, updatedAt: true } },
      tenant: { select: { name: true, slug: true, deletedAt: true } },
    },
  });
  if (!s || s.tenant.deletedAt) return null;
  if (!isSuperAdmin) {
    const m = await db.membership.findUnique({ where: { userId_tenantId: { userId, tenantId: s.tenantId } }, select: { status: true } });
    if (!m || m.status === "LEFT") return null;
  }
  const mod = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId: s.tenantId, moduleKey: "shifts" } }, select: { enabled: true } });
  if (!mod?.enabled) return null;
  const summary = `Helfereinsatz: ${s.title}${s.event ? ` (${s.event.title})` : ""}`;
  const ics = buildIcs({
    name: `${s.tenant.name} – Helfereinsatz`,
    events: [{
      uid: shiftUid(s.id),
      summary,
      description: [s.note, s.hoursCredit != null ? `Angerechnete Stunden: ${formatHours(s.hoursCredit)}` : null].filter(Boolean).join("\n"),
      location: s.event?.location ?? null,
      url: `${baseUrl}/shifts`,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.event?.isCancelled ? "CANCELLED" : "CONFIRMED",
      categories: ["Helfereinsatz"],
      stamp: s.event?.updatedAt && s.event.updatedAt > s.createdAt ? s.event.updatedAt : s.createdAt,
      created: s.createdAt,
    }],
  });
  return { ics, filename: `${s.tenant.slug}-einsatz-${zurichParts(s.startsAt).dateStr}.ics` };
}

// ---------------------------------------------------------------------------
// Erinnerungen (stündlich über den Job «reminders»)
// ---------------------------------------------------------------------------

const REMINDER_ACTION = "shifts.reminder";
/** Benachrichtigungen nur tagsüber (Schweizer Zeit). */
const FROM_HOUR = 7;
const TO_HOUR = 21;
const HOUR = 3_600_000;

/** Bereits verschickte Erinnerungen (Merker im Protokoll, damit auch Push nur einmal kommt). */
async function sentKeys(tenantId: string, keys: string[]) {
  if (!keys.length) return new Set<string>();
  const rows = await db.auditLog.findMany({ where: { tenantId, action: REMINDER_ACTION, entityId: { in: keys } }, select: { entityId: true } });
  return new Set(rows.map((r) => r.entityId!));
}

async function markSent(tenantId: string, key: string, entity: string, detail: string) {
  await audit({ tenantId, action: REMINDER_ACTION, entity, entityId: key, detail });
}

async function shiftTenantIds(): Promise<string[]> {
  const rows = await db.tenantModule.findMany({ where: { moduleKey: "shifts", enabled: true, tenant: { deletedAt: null } }, select: { tenantId: true } });
  return rows.map((r) => r.tenantId);
}

const when = (d: Date) => formatDateZurich(d, { year: undefined });

/**
 * Stündlicher Erinnerungs-Hook:
 * 1. 24 Stunden vor einem Einsatz an die eingeteilten Mitglieder (einmal pro Einteilung).
 * Beide Einsatz-Erinnerungen laufen über das Thema «reminders» (E-Mail standardmässig an), sonst erreichen sie
 * ohne Push-Abo niemanden und werden wegen der Dedupe-Markierung auch nie nachgeholt.
 * 2. 3 Tage vorher an die Einsatzplaner (Admins), wenn ein Einsatz unterbesetzt ist (einmal pro Einsatz).
 * 3. 60 Tage vor Ablauf einer Qualifikation an die Inhaberin bzw. den Inhaber (einmal pro Ablaufdatum).
 * Nachts (vor 7 und ab 22 Uhr) wird nichts verschickt; die nächste Stunde holt es nach.
 */
export async function runShiftReminders(now: Date = new Date()): Promise<{ assignments: number; understaffed: number; qualifications: number }> {
  const result = { assignments: 0, understaffed: 0, qualifications: 0 };
  const hour = Number(zurichParts(now).timeStr.slice(0, 2));
  if (hour < FROM_HOUR || hour > TO_HOUR) return result;
  const errors: string[] = [];

  for (const tenantId of await shiftTenantIds()) {
    try {
      // --- 1. 24 h vorher an Eingeteilte --------------------------------------
      const soon = await db.shift.findMany({
        where: { tenantId, startsAt: { gt: now, lte: new Date(now.getTime() + 24 * HOUR) }, OR: [{ eventId: null }, { event: { isCancelled: false } }] },
        select: { id: true, title: true, startsAt: true, endsAt: true, event: { select: { title: true, location: true } }, assignments: { where: { status: "ASSIGNED", user: { deletedAt: null, memberships: { some: { tenantId, status: { not: "LEFT" } } } } }, select: { id: true, userId: true } } },
      });
      const keys = soon.flatMap((s) => s.assignments.map((a) => `shift-24h:${a.id}`));
      const done = await sentKeys(tenantId, keys);
      for (const s of soon) {
        for (const a of s.assignments) {
          const key = `shift-24h:${a.id}`;
          if (done.has(key)) continue;
          const place = s.event?.location ? `, ${s.event.location}` : "";
          await notify({
            tenantId, userIds: [a.userId], topic: "reminders",
            title: `Helfereinsatz morgen: ${s.title}`,
            body: `${when(s.startsAt)}, ${formatTimeRange(s.startsAt, s.endsAt)} Uhr${place}${s.event ? ` · ${s.event.title}` : ""}. Danke für deinen Einsatz!`,
            emailBody: `Du bist für «${s.title}»${s.event ? ` (${s.event.title})` : ""} eingeteilt: ${when(s.startsAt)}, ${formatTimeRange(s.startsAt, s.endsAt)} Uhr${place}.\n\nFalls du verhindert bist, melde dich bitte rechtzeitig bei den Verantwortlichen.`,
            url: "/shifts?tab=mine", tag: `shift:${s.id}`, dedupeKey: key,
          });
          await markSent(tenantId, key, "ShiftAssignment", `${s.title} · ${zurichParts(s.startsAt).dateStr}`);
          result.assignments += 1;
        }
      }

      // --- 2. 3 Tage vorher: unterbesetzte Einsätze an Planer ---------------------
      const upcoming = await db.shift.findMany({
        where: { tenantId, startsAt: { gt: now, lte: new Date(now.getTime() + 72 * HOUR) }, OR: [{ eventId: null }, { event: { isCancelled: false } }] },
        select: { id: true, title: true, startsAt: true, capacity: true, assignments: { select: { status: true } } },
        orderBy: { startsAt: "asc" },
      });
      const under = upcoming.map((s) => ({ s, st: staffing(s.capacity, s.assignments) })).filter((x) => x.st.understaffed);
      if (under.length) {
        const sent = await sentKeys(tenantId, under.map((x) => `shift-under:${x.s.id}`));
        const fresh = under.filter((x) => !sent.has(`shift-under:${x.s.id}`));
        if (fresh.length) {
          const managers = await tenantUserIdsWithRole(tenantId, ["OWNER", "ADMIN"]);
          const lines = fresh.map((x) => `${x.s.title} (${formatDateZurich(x.s.startsAt, { year: undefined })}): ${x.st.filled}/${x.st.capacity}`);
          if (managers.length) {
            await notify({
              tenantId, userIds: managers, topic: "reminders",
              title: fresh.length === 1 ? "Helfereinsatz unterbesetzt" : `${fresh.length} Helfereinsätze unterbesetzt`,
              body: lines.slice(0, 5).join(" · ") + (lines.length > 5 ? ` und ${lines.length - 5} weitere` : ""),
              emailBody: `In den nächsten drei Tagen fehlen noch Helferinnen und Helfer:\n\n${lines.join("\n")}\n\nBitte Mitglieder anfragen oder einteilen.`,
              url: "/admin/shifts?scope=open", tag: `shift-under:${tenantId}`,
              dedupeKey: `shift-under:${fresh.map((x) => x.s.id).join(",")}`.slice(0, 150),
            });
          }
          for (const x of fresh) await markSent(tenantId, `shift-under:${x.s.id}`, "Shift", `${x.s.title}: ${x.st.filled}/${x.st.capacity}`);
          result.understaffed += fresh.length;
        }
      }
    } catch (e) {
      errors.push(`${tenantId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // --- 3. Qualifikationen laufen ab (alle Vereine) ------------------------------
  try {
    result.qualifications = await qualificationExpiryReminders(now);
  } catch (e) {
    errors.push(`qualifications: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (errors.length) throw new Error(`shift reminders: ${errors.join("; ")}`);
  return result;
}

async function qualificationExpiryReminders(now: Date) {
  const today = zurichParts(now).dateStr;
  const rows = await db.qualification.findMany({
    where: {
      validUntil: { gte: dayToDbDate(today), lte: dayToDbDate(addDays(today, EXPIRY_WARN_DAYS)) },
      tenant: { deletedAt: null },
      user: { deletedAt: null },
    },
    select: { id: true, tenantId: true, userId: true, kind: true, label: true, validUntil: true },
    take: 2000,
  });
  // Nur aktuelle Mitglieder (nicht ausgetreten) des jeweiligen Vereins erinnern.
  const members = rows.length
    ? await db.membership.findMany({
        where: { status: { not: "LEFT" }, OR: [...new Set(rows.map((r) => r.tenantId))].map((tenantId) => ({ tenantId, userId: { in: rows.filter((r) => r.tenantId === tenantId).map((r) => r.userId) } })) },
        select: { tenantId: true, userId: true },
      })
    : [];
  const current = new Set(members.map((m) => `${m.tenantId}:${m.userId}`));
  const byTenant = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!current.has(`${r.tenantId}:${r.userId}`)) continue;
    const list = byTenant.get(r.tenantId) ?? [];
    list.push(r);
    byTenant.set(r.tenantId, list);
  }
  let count = 0;
  for (const [tenantId, list] of byTenant) {
    const keyOf = (q: (typeof list)[number]) => `qual-expiry:${q.id}:${q.validUntil!.toISOString().slice(0, 10)}`;
    const sent = await sentKeys(tenantId, list.map(keyOf));
    for (const q of list) {
      const key = keyOf(q);
      if (sent.has(key)) continue;
      const name = q.label ? `${qualificationLabel(q.kind)} (${q.label})` : qualificationLabel(q.kind);
      const until = new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(q.validUntil!);
      await notify({
        tenantId, userIds: [q.userId], topic: "reminders",
        title: "Qualifikation läuft ab",
        body: `${name} ist gültig bis ${until}. Bitte rechtzeitig erneuern (Kurs, Wiederholung) und den Nachweis beim Verein abgeben.`,
        url: "/shifts?tab=mine", tag: `qual:${q.id}`, dedupeKey: key,
      });
      await markSent(tenantId, key, "Qualification", `${name} bis ${until}`);
      count += 1;
    }
  }
  return count;
}
