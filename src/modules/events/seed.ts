/**
 * Demo-Anlässe für den Seed (prisma/seed.ts). Bewusst nur relative Imports und
 * kein "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { addDays, todayZurich, zurichParts, zurichToUtc } from "../../lib/time";

type Db = Pick<PrismaClient, "event" | "eventRsvp" | "announcement">;

/** Nächstes Datum (ab morgen) mit dem gewünschten Wochentag (0 = So … 6 = Sa). */
function nextWeekday(from: string, weekday: number, extraWeeks = 0) {
  let d = addDays(from, 1);
  while (zurichParts(zurichToUtc(d, "12:00")).weekday !== weekday) d = addDays(d, 1);
  return addDays(d, extraWeeks * 7);
}

export async function seedDemoEvents(db: Db, tenantId: string, authorId: string, memberIds: string[]) {
  if ((await db.event.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };

  const today = todayZurich();
  const at = (date: string, time: string) => zurichToUtc(date, time);
  const base = { tenantId, createdById: authorId };

  // Training jeden Dienstag 18:30–20:30, die nächsten 6 Wochen
  const firstTuesday = nextWeekday(today, 2);
  const trainings = Array.from({ length: 6 }, (_, i) => {
    const d = addDays(firstTuesday, i * 7);
    return {
      ...base,
      title: "Training 300 m",
      kind: "TRAINING",
      startsAt: at(d, "18:30"),
      endsAt: at(d, "20:30"),
      location: "Schiessanlage Allmend, 300 m Stand",
      description: "Freies Training für alle Mitglieder. Munition kann vor Ort bezogen werden.\nBitte Gehörschutz mitnehmen.",
      rsvpEnabled: true,
      capacity: 16,
    };
  });

  const obligatory = nextWeekday(today, 6, 2);
  const work = nextWeekday(today, 6, 1);
  const championship = nextWeekday(today, 6, 4);
  const gv = nextWeekday(today, 5, 7);
  const pastFinal = addDays(nextWeekday(today, 6), -21);

  const singles = [
    {
      ...base,
      title: "Obligatorisches Programm",
      kind: "OBLIGATORY",
      startsAt: at(obligatory, "08:00"),
      endsAt: at(obligatory, "11:30"),
      location: "Schiessanlage Allmend",
      description: "Bundesübung 300 m. Mitnehmen: Dienstbüchlein, Schiessbüchlein, Aufgebot, amtlicher Ausweis und Gehörschutz.\nInfos: https://www.vtg.admin.ch",
      rsvpEnabled: true,
      capacity: 40,
      rsvpDeadline: at(addDays(obligatory, -3), "20:00"),
    },
    {
      ...base,
      title: "Arbeitseinsatz Scheibenstand",
      kind: "WORK",
      startsAt: at(work, "08:00"),
      endsAt: at(work, "12:00"),
      location: "Schützenhaus",
      description: "Wir reinigen den Scheibenstand und bereiten die Saison vor. Anschliessend Mittagessen für alle Helferinnen und Helfer.",
      rsvpEnabled: true,
      capacity: 15,
    },
    {
      ...base,
      title: "Vereinsmeisterschaft",
      kind: "COMPETITION",
      startsAt: at(championship, "09:00"),
      endsAt: at(championship, "16:00"),
      location: "Schiessanlage Allmend",
      description: "Vereinsmeisterschaft in allen Kategorien. Rangverkündigung um 17:00 im Schützenhaus.",
      rsvpEnabled: true,
      rsvpDeadline: at(addDays(championship, -7), "23:59"),
    },
    {
      ...base,
      title: "Generalversammlung",
      kind: "MEETING",
      startsAt: at(gv, "19:30"),
      endsAt: null,
      location: "Restaurant Sternen, Saal",
      description: "Traktanden:\n1. Begrüssung\n2. Protokoll\n3. Jahresbericht\n4. Rechnung und Budget\n5. Wahlen\n6. Verschiedenes\n\nAnschliessend Nachtessen offeriert vom Verein.",
      rsvpEnabled: true,
    },
    {
      ...base,
      title: "Endschiessen mit Absenden",
      kind: "SOCIAL",
      startsAt: at(pastFinal, "13:00"),
      endsAt: at(pastFinal, "18:00"),
      location: "Schützenhaus",
      description: "Plauschschiessen mit Preisen und Grill.",
      rsvpEnabled: true,
    },
  ];

  await db.event.createMany({ data: [...trainings, ...singles] });

  // Ein paar Antworten, damit die Zähler etwas zeigen
  const created = await db.event.findMany({ where: { tenantId }, select: { id: true, title: true, startsAt: true }, orderBy: { startsAt: "asc" } });
  const statuses = ["YES", "MAYBE", "YES", "NO"] as const;
  const rsvps: Array<{ eventId: string; userId: string; status: string; guests: number; note: string | null }> = [];
  created.forEach((e, ei) => {
    memberIds.forEach((userId, ui) => {
      if ((ei + ui) % 3 === 2) return; // nicht alle antworten
      const status = statuses[(ei + ui) % statuses.length]!;
      rsvps.push({ eventId: e.id, userId, status, guests: status === "YES" && e.title === "Generalversammlung" ? 1 : 0, note: status === "MAYBE" ? "Entscheide kurzfristig" : null });
    });
  });
  if (rsvps.length) await db.eventRsvp.createMany({ data: rsvps, skipDuplicates: true });

  if ((await db.announcement.count({ where: { tenantId } })) === 0) {
    await db.announcement.create({
      data: {
        tenantId,
        authorId,
        title: "Willkommen in der neuen Vereins-App",
        body: "Ab sofort findest du alle Anlässe hier. Bitte melde dich jeweils an oder ab, damit wir besser planen können.\nTipp: Unter «Kalender abonnieren» kannst du alle Termine direkt in deinen Handy-Kalender holen.",
        pinned: true,
        expiresAt: zurichToUtc(addDays(today, 60), "00:00"),
      },
    });
  }

  return { created: trainings.length + singles.length, skipped: false };
}
