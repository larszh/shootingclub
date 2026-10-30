/**
 * Demo-Standbetrieb für den Seed (prisma/seed.ts). Bewusst nur relative Imports und kein
 * "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann. Idempotent:
 * legt nur etwas an, wenn der Verein noch keine Standordnung und kein Standbuch hat.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { addDays, todayZurich, zurichParts, zurichToUtc } from "../../lib/time";
import { dayKeyToDbDate, halfDayFlagsFromVisits } from "./logic";

type Db = Pick<PrismaClient, "rangeRules" | "rulesAcceptance" | "shootingWindow" | "shootingQuota" | "rangeDay" | "rangeVisit" | "incident" | "user">;

const RULES_BODY = `# Standordnung Demo-Verein

Beispieltext. Bitte an die eigene Anlage anpassen und mit den aktuellen Vorgaben (VBS/SSV/Kanton, Reglement der Gemeinde) abgleichen.

## Allgemein
- Vor dem Schiessen beim Standdienst eintragen (Check-in), danach austragen.
- Den Anweisungen des Standdienstes ist jederzeit Folge zu leisten.
- Gäste schiessen nur in Begleitung eines Mitglieds.

## Sicherheit
- Waffen nur im Schützenstand handhaben, Mündung immer Richtung Kugelfang.
- **Verschluss offen** und Magazin entfernt, sobald nicht geschossen wird.
- Gehörschutz ist Pflicht.
- Bei «Feuer einstellen» sofort unterbrechen.

## Notfall
- Notruf 144 (Sanität), 117 (Polizei), 118 (Feuerwehr), 145 (Tox Info).
- Erste-Hilfe-Koffer und Defibrillator: Schützenhaus, Eingang links.`;

/** Letzte Daten (vor heute) mit dem gewünschten Wochentag. */
function previousWeekdays(from: string, weekday: number, count: number) {
  const out: string[] = [];
  let d = addDays(from, -1);
  while (out.length < count) {
    if (zurichParts(zurichToUtc(d, "12:00")).weekday === weekday) out.push(d);
    d = addDays(d, -1);
  }
  return out;
}

export async function seedDemoRange(db: Db, tenantId: string, userIds: string[]) {
  const [rulesCount, dayCount] = await Promise.all([db.rangeRules.count({ where: { tenantId } }), db.rangeDay.count({ where: { tenantId } })]);
  if (rulesCount > 0 || dayCount > 0) return { created: 0, skipped: true };
  const [duty, ...others] = userIds;
  const today = todayZurich();
  const year = Number(today.slice(0, 4));
  const dutyName = duty ? ((await db.user.findUnique({ where: { id: duty }, select: { name: true } }))?.name ?? "Standdienst") : "Standdienst";

  const rules = await db.rangeRules.create({
    data: { tenantId, version: 1, title: "Standordnung", body: RULES_BODY, isActive: true, publishedAt: zurichToUtc(`${year}-01-05`, "10:00") },
  });
  for (const userId of userIds.slice(0, 2)) {
    await db.rulesAcceptance.upsert({ where: { rulesId_userId: { rulesId: rules.id, userId } }, create: { rulesId: rules.id, userId }, update: {} });
  }

  // Beispiel-Schiesszeiten (ganze Anlage): Di/Do Abend, Sa Vor- und Nachmittag
  const t = (h: number, m = 0) => h * 60 + m;
  await db.shootingWindow.createMany({
    data: [
      { tenantId, resourceId: null, weekday: 2, startMinute: t(17, 30), endMinute: t(20), note: "Beispiel – gemäss Bewilligung prüfen" },
      { tenantId, resourceId: null, weekday: 4, startMinute: t(17, 30), endMinute: t(20), note: "Beispiel – gemäss Bewilligung prüfen" },
      { tenantId, resourceId: null, weekday: 6, startMinute: t(9), endMinute: t(12), note: null },
      { tenantId, resourceId: null, weekday: 6, startMinute: t(13, 30), endMinute: t(17), note: null },
    ],
  });
  await db.shootingQuota.create({ data: { tenantId, resourceId: null, year, maxHalfDays: 80, note: "Beispielwert – Bewilligung der Gemeinde prüfen" } });

  // Vergangene Schiesstage: Dienstagabende und Samstage
  const dates = [...previousWeekdays(today, 2, 4).map((d) => ({ d, from: "18:00", to: "19:45" })), ...previousWeekdays(today, 6, 3).map((d) => ({ d, from: "09:15", to: "14:30" }))]
    .filter((x) => x.d.startsWith(String(year)) || x.d >= addDays(today, -60))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  let i = 0;
  for (const { d, from, to } of dates) {
    const openedAt = zurichToUtc(d, from);
    const closedAt = zurichToUtc(d, to);
    const visitors = [duty, ...others].filter((x): x is string => !!x).slice(0, 1 + (i % Math.max(1, userIds.length)));
    const visits = visitors.map((userId, j) => ({
      tenantId, userId, lane: String(j + 1), discipline: "Gewehr 300 m",
      checkedInAt: new Date(openedAt.getTime() + j * 10 * 60_000), checkedOutAt: new Date(closedAt.getTime() - j * 5 * 60_000),
      rulesId: rules.id, rulesAcceptedAt: openedAt,
    }));
    const guest = i % 3 === 0 && duty
      ? [{ tenantId, userId: null, guestName: "Gast Muster", guestBirthYear: 1985, guestIdChecked: true, hostUserId: duty, lane: String(visitors.length + 1), discipline: "Gewehr 300 m", checkedInAt: new Date(openedAt.getTime() + 20 * 60_000), checkedOutAt: new Date(openedAt.getTime() + 80 * 60_000), rulesId: rules.id, rulesAcceptedAt: openedAt }]
      : [];
    const all = [...visits, ...guest];
    const flags = halfDayFlagsFromVisits(d, all, closedAt);
    const day = await db.rangeDay.create({
      data: { tenantId, date: dayKeyToDbDate(d), dutyUserId: duty ?? null, dutyName, openedAt, closedAt, ...flags, notes: i === 0 ? "Scheibe 4 klemmt, Hauswart informiert." : null },
    });
    await db.rangeVisit.createMany({ data: all.map((v) => ({ ...v, rangeDayId: day.id })) });
    i++;
  }

  const last = dates[dates.length - 1];
  if (last) {
    await db.incident.create({
      data: {
        tenantId, occurredAt: zurichToUtc(last.d, "10:20"), kind: "NEAR_MISS", severity: "MEDIUM", location: "300-m-Stand, Scheibe 3",
        description: "Schütze hat mit geschlossenem Verschluss den Stand verlassen. Sofort angesprochen, Waffe entladen.",
        persons: "Standdienst, ein Schütze", measures: "Hinweis im nächsten Training wiederholt, Plakat «Verschluss offen» aufgehängt.", status: "CLOSED", reportedById: duty ?? null,
      },
    });
  }
  return { created: dates.length, skipped: false };
}
