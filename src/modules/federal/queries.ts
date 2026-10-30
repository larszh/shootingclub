import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireModule, type ActiveTenant, type AppContext } from "@/lib/tenant";
import { zurichParts, zurichToUtc } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { dbDateToDay } from "./types";

export type FederalCtx = AppContext & { tenant: ActiveTenant };

// ---------------------------------------------------------------------------
// Zugriff
// ---------------------------------------------------------------------------

/** Modul «Bundesübungen» aktiv (alle Mitglieder sehen mindestens ihren eigenen Stand). */
export async function requireFederal() {
  return requireModule("federal");
}

/** Volle Listen (alle Schützen): Mitgliederliste oder Schützenmeister. */
export function canSeeAll(ctx: AppContext) {
  return ctx.can("members.view") || ctx.can("results.verify");
}

/** Fristen und Notizen bearbeiten. */
export function canEditYear(ctx: AppContext) {
  return ctx.can("results.verify") || ctx.can("tenant.manage");
}

/** Export und Druckliste für SAT-Admin (Schützenmeister). */
export async function requireFederalVerifier() {
  const ctx = await requireFederal();
  if (!ctx.can("results.verify")) redirect("/federal?denied=1");
  return ctx;
}

export function yearRange(year: number) {
  return { from: zurichToUtc(`${year}-01-01`, "00:00"), to: zurichToUtc(`${year + 1}-01-01`, "00:00") };
}

// ---------------------------------------------------------------------------
// Jahr: Fristen und Notizen
// ---------------------------------------------------------------------------

export async function getFederalYear(tenantId: string, year: number) {
  const row = await db.federalYear.findUnique({ where: { tenantId_year: { tenantId, year } } });
  return {
    year,
    exists: !!row,
    registrationDeadline: dbDateToDay(row?.registrationDeadline),
    shootingDeadline: dbDateToDay(row?.shootingDeadline),
    reportDeadline: dbDateToDay(row?.reportDeadline),
    notes: row?.notes ?? "",
    updatedAt: row?.updatedAt ?? null,
  };
}
export type FederalYearView = Awaited<ReturnType<typeof getFederalYear>>;

// ---------------------------------------------------------------------------
// Anlässe (Obligatorisch) und amtliche Programme
// ---------------------------------------------------------------------------

export async function listOpEvents(tenantId: string, year: number) {
  const { from, to } = yearRange(year);
  const events = await db.event.findMany({
    where: { tenantId, kind: "OBLIGATORY", startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true, title: true, startsAt: true, endsAt: true, allDay: true, location: true, isCancelled: true,
      _count: { select: { rsvps: { where: { status: "YES" } } } },
      matches: {
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, program: { select: { name: true, officialKind: true } }, _count: { select: { participants: true } }, participants: { where: { isOfficial: true }, select: { id: true } } },
      },
    },
    take: 100,
  });
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    allDay: e.allDay,
    location: e.location,
    isCancelled: e.isCancelled,
    yesCount: e._count.rsvps,
    matches: e.matches.map((m) => ({ id: m.id, status: m.status, programName: m.program.name, participantCount: m._count.participants, officialCount: m.participants.length })),
  }));
}
export type OpEventView = Awaited<ReturnType<typeof listOpEvents>>[number];

/** Amtliche Programme, die im Verein sichtbar sind (global oder eigene, nicht versteckt, nicht archiviert). */
export async function listOfficialPrograms(tenantId: string, kind?: string) {
  const [programs, hidden] = await Promise.all([
    db.program.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }], isArchived: false, officialKind: kind ? kind : { not: null } },
      select: { id: true, name: true, officialKind: true, tenantId: true, passMinScore: true, passMaxZeros: true },
      orderBy: [{ tenantId: "desc" }, { name: "asc" }],
    }),
    db.programTenantSetting.findMany({ where: { tenantId, hidden: true }, select: { programId: true } }),
  ]);
  const hiddenSet = new Set(hidden.map((h) => h.programId));
  return programs.filter((p) => !hiddenSet.has(p.id));
}

// ---------------------------------------------------------------------------
// Amtliche Resultate
// ---------------------------------------------------------------------------

export type OfficialResultFilter = {
  /** OP | FS | QUAL; leer = alle */
  kind?: string;
  eventId?: string;
  userId?: string;
  /** passed | failed | none */
  status?: string;
  /** Suche im Namen */
  q?: string;
};

export async function listOfficialResults(tenantId: string, year: number, f: OfficialResultFilter = {}) {
  const { from, to } = yearRange(year);
  const q = f.q?.trim().slice(0, 60).replace(/[\\%_]/g, "\\$&");
  const where: Prisma.MatchParticipantWhereInput = {
    isOfficial: true,
    userId: f.userId ? f.userId : { not: null },
    match: {
      tenantId,
      date: { gte: from, lt: to },
      ...(f.eventId ? { eventId: f.eventId } : {}),
      program: f.kind ? { officialKind: f.kind } : { officialKind: { not: null } },
    },
    ...(f.status === "passed" ? { passed: true } : f.status === "failed" ? { passed: false } : f.status === "none" ? { passed: null } : {}),
    ...(q ? { user: { name: { contains: q } } } : {}),
  };
  const rows = await db.matchParticipant.findMany({
    where,
    select: {
      id: true, userId: true, total: true, zeros: true, attempt: true, passed: true, verifiedAt: true,
      user: { select: { name: true, birthDate: true, street: true, zip: true, city: true, deletedAt: true } },
      match: { select: { id: true, date: true, eventId: true, event: { select: { title: true } }, program: { select: { id: true, name: true, officialKind: true, scoringMode: true } } } },
    },
    orderBy: [{ match: { date: "asc" } }, { sortOrder: "asc" }],
    take: 3000,
  });
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match.id,
    userId: r.userId,
    name: r.user?.name ?? "–",
    birthDate: r.user?.birthDate ?? null,
    street: r.user?.street ?? null,
    zip: r.user?.zip ?? null,
    city: r.user?.city ?? null,
    program: r.match.program.name,
    programId: r.match.program.id,
    kind: r.match.program.officialKind ?? "",
    decimal: r.match.program.scoringMode === "RINGS_DECIMAL",
    total: r.total,
    zeros: r.zeros,
    attempt: r.attempt,
    passed: r.passed,
    date: r.match.date,
    eventId: r.match.eventId,
    eventTitle: r.match.event?.title ?? null,
    verifiedAt: r.verifiedAt,
  }));
}
export type OfficialResultRow = Awaited<ReturnType<typeof listOfficialResults>>[number];

/** Aktuelle Mitglieder (nicht ausgetreten, Konto nicht gelöscht) als Map userId → Name. */
export async function currentMembers(tenantId: string) {
  const ms = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { userId: true, joinedAt: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return ms.map((m) => ({ userId: m.userId, name: m.user.name, joinedAt: m.joinedAt }));
}

/** Teilnehmer an Feldschiessen-Durchgängen eines Jahres (Mitglieder und Gäste) mit Total. */
export async function listFsParticipants(tenantId: string, year: number) {
  const { from, to } = yearRange(year);
  const rows = await db.matchParticipant.findMany({
    where: { total: { not: null }, match: { tenantId, date: { gte: from, lt: to }, program: { officialKind: "FS" } } },
    select: {
      id: true, total: true, zeros: true, isOfficial: true, guestName: true,
      user: { select: { name: true } },
      match: { select: { id: true, date: true, program: { select: { name: true, scoringMode: true } } } },
    },
    take: 2000,
  });
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match.id,
    name: r.user?.name ?? r.guestName ?? "Gast",
    isGuest: !r.user,
    total: r.total ?? 0,
    zeros: r.zeros,
    isOfficial: r.isOfficial,
    program: r.match.program.name,
    decimal: r.match.program.scoringMode === "RINGS_DECIMAL",
    date: r.match.date,
  }));
}

// ---------------------------------------------------------------------------
// Schiessnachweis
// ---------------------------------------------------------------------------

/** Mitglied für den Schiessnachweis (nur im eigenen Verein). */
export async function getNachweisMember(tenantId: string, userId: string) {
  const m = await db.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: {
      joinedAt: true, leftAt: true, status: true, memberNumber: true, licenseNumber: true,
      user: { select: { id: true, name: true, birthDate: true, street: true, zip: true, city: true, deletedAt: true } },
    },
  });
  if (!m || m.user.deletedAt) return null;
  return {
    userId: m.user.id,
    name: m.user.name,
    birthDate: m.user.birthDate,
    street: m.user.street,
    zip: m.user.zip,
    city: m.user.city,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
    status: m.status,
    memberNumber: m.memberNumber,
    licenseNumber: m.licenseNumber,
  };
}

/** Vereinsdaten für Ausdrucke (Adresse aus dem Rechnungsprofil, falls vorhanden). */
export async function getClubInfo(tenantId: string) {
  const [t, profile] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, city: true, canton: true, website: true } }),
    db.billingProfile.findUnique({ where: { tenantId }, select: { payeeName: true, payeeStreet: true, payeeZip: true, payeeCity: true } }),
  ]);
  return {
    name: profile?.payeeName || t?.name || "",
    street: profile?.payeeStreet ?? null,
    zipCity: [profile?.payeeZip, profile?.payeeCity ?? t?.city].filter(Boolean).join(" ") || null,
    canton: t?.canton ?? null,
    website: t?.website ?? null,
  };
}

// ---------------------------------------------------------------------------
// Zeit (ausserhalb des Renderns aufrufen)
// ---------------------------------------------------------------------------

export function nowDate() {
  return new Date();
}

export function currentSwissYear(now: Date = nowDate()) {
  return Number(zurichParts(now).dateStr.slice(0, 4));
}
