import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify, tenantUserIdsWithRole } from "@/lib/notify";
import { todayZurich, zurichParts } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { MODULES } from "@/lib/modules";
import { inferReportDays, isLoanOverdue, isMinorOn, isoWeekKey, minorReportState, reportDueFrom, serviceInfo, statusAfterReturn } from "./logic";
import { DEFAULT_MINOR_REPORT_DAYS, MINOR_REPORT_WARN_DAYS, resolveWeaponSettings, type WeaponSettingsView } from "./types";
import { accessStatusWhere } from "@/lib/membership-access";
import { formatDate, getT, type TFunction } from "@/lib/i18n/core";
import { getTenantLocale } from "@/lib/i18n";

/**
 * Vereinswaffen: Ausleihe, Rückgabe, Wartungsstand und Erinnerungen.
 * Vertrag für andere Module (z.B. Standbetrieb): createWeaponLoan, returnWeaponLoan, listAvailableWeapons.
 */

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof db;

/** Rollen mit «weapons.manage» (siehe src/lib/permissions.ts). */
const MANAGER_ROLES = ["OWNER", "ADMIN"];

class LoanError extends Error {}

/** Schuss seit der letzten erfassten Wartung (Summe der Rückgaben danach). */
export async function shotsSinceService(tenantId: string, weaponId: string, client: Client = db) {
  const last = await client.weaponService.findFirst({ where: { weaponId, weapon: { tenantId } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const agg = await client.weaponLoan.aggregate({
    where: { tenantId, weaponId, returnedAt: last ? { gt: last.createdAt } : { not: null } },
    _sum: { shots: true },
  });
  return agg._sum.shots ?? 0;
}

/** Schuss seit der letzten Wartung für mehrere Waffen auf einmal. */
export async function shotsSinceServiceMap(tenantId: string, weaponIds: string[]) {
  const map = new Map<string, number>();
  if (!weaponIds.length) return map;
  const [services, loans] = await Promise.all([
    db.weaponService.groupBy({ by: ["weaponId"], where: { weaponId: { in: weaponIds }, weapon: { tenantId } }, _max: { createdAt: true } }),
    db.weaponLoan.findMany({ where: { tenantId, weaponId: { in: weaponIds }, returnedAt: { not: null }, shots: { gt: 0 } }, select: { weaponId: true, returnedAt: true, shots: true } }),
  ]);
  const lastService = new Map(services.map((s) => [s.weaponId, s._max.createdAt]));
  for (const id of weaponIds) map.set(id, 0);
  for (const l of loans) {
    const since = lastService.get(l.weaponId);
    if (since && l.returnedAt! <= since) continue;
    map.set(l.weaponId, (map.get(l.weaponId) ?? 0) + (l.shots ?? 0));
  }
  return map;
}

/** Einstellungen des Vereins (WeaponSettings); ohne Datensatz die Standardwerte. */
export async function getWeaponSettings(tenantId: string, client: Client = db): Promise<WeaponSettingsView> {
  const row = await client.weaponSettings.findUnique({ where: { tenantId }, select: { minorReportDays: true, serviceEveryShotsDefault: true } });
  return resolveWeaponSettings(row);
}

/**
 * Meldefrist (Tage) für Abgaben an Minderjährige: aus den Einstellungen des Vereins. Hat der Verein noch
 * keine Einstellungen gespeichert, gilt die zuletzt verwendete Frist (Verhalten vor den Einstellungen),
 * sonst DEFAULT_MINOR_REPORT_DAYS. Werte bitte beim Kanton prüfen.
 */
export async function defaultMinorReportDays(tenantId: string, client: Client = db) {
  const settings = await getWeaponSettings(tenantId, client);
  if (settings.saved) return settings.minorReportDays;
  const last = await client.weaponLoan.findFirst({
    where: { tenantId, isMinor: true, reportDueAt: { not: null } },
    orderBy: { loanedAt: "desc" },
    select: { loanedAt: true, reportDueAt: true },
  });
  return (last && inferReportDays(last.loanedAt, last.reportDueAt)) ?? DEFAULT_MINOR_REPORT_DAYS;
}

/**
 * Leiht eine Vereinswaffe aus. Schlägt fehl, wenn die Waffe nicht verfügbar ist (Statuswechsel
 * AVAILABLE → LOANED ist bedingt und damit sicher gegen parallele Ausleihen). Mitglieder müssen zum
 * Verein gehören (nicht ausgetreten, nicht wartend auf Freigabe). Minderjährig wird bei Mitgliedern zusätzlich aus dem
 * Geburtsdatum abgeleitet; dann wird die Meldefrist gesetzt (loanedAt + reportDays bzw. Vereinsstandard).
 */
export async function createWeaponLoan(l: {
  tenantId: string;
  weaponId: string;
  userId?: string | null;
  borrowerName?: string | null;
  isMinor?: boolean;
  onSiteOnly?: boolean;
  issuedById: string;
  note?: string | null;
  /** optional: Rückgabe bis */
  dueAt?: Date | null;
  /** optional: Meldefrist in Tagen bei Minderjährigen (Standard: Einstellungen des Vereins) */
  reportDays?: number | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = l.borrowerName?.trim().slice(0, 191) || null;
  if (!l.userId && !name) return { ok: false, error: "adm2.weapons.v.borrower" };
  let isMinor = l.isMinor === true;
  // Bei Mitgliedern keine Namenskopie speichern (Anzeige über die user-Relation, siehe queries.ts):
  // so bleibt nach einer Kontolöschung kein Klarname in der Ausleihe zurück.
  const borrowerName = l.userId ? null : name;
  let displayName = name;
  if (l.userId) {
    const m = await db.membership.findFirst({
      where: { tenantId: l.tenantId, userId: l.userId, status: accessStatusWhere(), user: { deletedAt: null } },
      select: { user: { select: { name: true, birthDate: true } } },
    });
    if (!m) return { ok: false, error: "adm2.weapons.msg.memberNotFound" };
    if (isMinorOn(m.user.birthDate, todayZurich()) === true) isMinor = true;
    displayName = m.user.name;
  }
  const reportDays = isMinor ? (l.reportDays && l.reportDays > 0 ? Math.min(365, Math.round(l.reportDays)) : await defaultMinorReportDays(l.tenantId)) : null;

  try {
    const loan = await db.$transaction(async (tx) => {
      const claimed = await tx.clubWeapon.updateMany({ where: { id: l.weaponId, tenantId: l.tenantId, status: "AVAILABLE" }, data: { status: "LOANED" } });
      if (claimed.count === 0) {
        const w = await tx.clubWeapon.findFirst({ where: { id: l.weaponId, tenantId: l.tenantId }, select: { status: true } });
        throw new LoanError(!w ? "adm2.weapons.msg.notFound" : w.status === "LOANED" ? "adm2.weapons.msg.alreadyLoaned" : "adm2.weapons.msg.notAvailable");
      }
      const loanedAt = new Date();
      return tx.weaponLoan.create({
        data: {
          tenantId: l.tenantId,
          weaponId: l.weaponId,
          userId: l.userId ?? null,
          borrowerName,
          isMinor,
          onSiteOnly: l.onSiteOnly ?? true,
          loanedAt,
          dueAt: l.dueAt ?? null,
          issuedById: l.issuedById,
          reportDueAt: isMinor && reportDays ? reportDueFrom(loanedAt, reportDays) : null,
          note: l.note?.trim().slice(0, 191) || null,
        },
        select: { id: true },
      });
    });
    await audit({ tenantId: l.tenantId, actorId: l.issuedById, action: "weapons.loan.create", entity: "WeaponLoan", entityId: loan.id, detail: `${displayName ?? ""}${isMinor ? " (minderjährig)" : ""}` });
    return { ok: true, id: loan.id };
  } catch (e) {
    if (e instanceof LoanError) return { ok: false, error: e.message };
    console.error("Vereinswaffen: Ausleihe fehlgeschlagen", e);
    return { ok: false, error: "adm2.weapons.msg.loanFailed" };
  }
}

/**
 * Nimmt eine Leihe zurück: Rückgabezeit und Schusszahl setzen (nur einmal), Schusszähler der Waffe
 * erhöhen und Status AVAILABLE bzw. SERVICE (Schussintervall erreicht) setzen. Gesperrte oder
 * ausgemusterte Waffen behalten ihren Status.
 */
export async function returnWeaponLoan(tenantId: string, loanId: string, shots?: number | null): Promise<{ ok: boolean; error?: string }> {
  const n = shots === null || shots === undefined ? null : Math.round(shots);
  if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100_000)) return { ok: false, error: "adm2.weapons.msg.invalidShots" };
  try {
    const res = await db.$transaction(async (tx) => {
      const loan = await tx.weaponLoan.findFirst({ where: { id: loanId, tenantId }, select: { id: true, weaponId: true, returnedAt: true } });
      if (!loan) throw new LoanError("adm2.weapons.msg.loanNotFound");
      if (loan.returnedAt) throw new LoanError("adm2.weapons.msg.alreadyReturned");
      const done = await tx.weaponLoan.updateMany({ where: { id: loan.id, tenantId, returnedAt: null }, data: { returnedAt: new Date(), shots: n } });
      if (done.count === 0) throw new LoanError("adm2.weapons.msg.alreadyReturned");
      const weapon = await tx.clubWeapon.findFirst({ where: { id: loan.weaponId, tenantId }, select: { status: true, serviceEveryShots: true } });
      if (!weapon) return { weaponId: loan.weaponId, status: null as string | null };
      // Weitere offene Leihen derselben Waffe (Altdaten) → Status bleibt «ausgeliehen».
      const stillOpen = await tx.weaponLoan.count({ where: { tenantId, weaponId: loan.weaponId, returnedAt: null } });
      const since = await shotsSinceService(tenantId, loan.weaponId, tx);
      const next = stillOpen > 0 ? weapon.status : statusAfterReturn(weapon.status, since, weapon.serviceEveryShots);
      await tx.clubWeapon.updateMany({
        where: { id: loan.weaponId, tenantId },
        data: { ...(n ? { shotCount: { increment: n } } : {}), ...(next !== weapon.status ? { status: next } : {}) },
      });
      return { weaponId: loan.weaponId, status: next };
    });
    await audit({ tenantId, action: "weapons.loan.return", entity: "WeaponLoan", entityId: loanId, detail: `${n ?? 0} Schuss${res.status === "SERVICE" ? ", Wartung fällig" : ""}` });
    return { ok: true };
  } catch (e) {
    if (e instanceof LoanError) return { ok: false, error: e.message };
    console.error("Vereinswaffen: Rückgabe fehlgeschlagen", e);
    return { ok: false, error: "adm2.weapons.msg.returnSaveFailed" };
  }
}

/** Verfügbare Waffen für Ausleih-Auswahlen (z.B. im Standbuch). */
export async function listAvailableWeapons(tenantId: string): Promise<{ id: string; name: string; caliber: string | null; discipline: string | null }[]> {
  return db.clubWeapon.findMany({
    where: { tenantId, status: "AVAILABLE" },
    select: { id: true, name: true, caliber: true, discipline: true },
    orderBy: [{ discipline: "asc" }, { name: "asc" }],
  });
}

// --- Erinnerungen -----------------------------------------------------------------------------

const REMINDER_ACTION = "weapons.reminder";
/** Keine Erinnerungen in der Nacht (Schweizer Zeit). */
const FROM_HOUR = 8;

async function alreadySent(tenantId: string, key: string) {
  const row = await db.auditLog.findFirst({ where: { tenantId, action: REMINDER_ACTION, entityId: key }, select: { id: true } });
  return !!row;
}

async function markSent(tenantId: string, key: string, detail: string) {
  await audit({ tenantId, action: REMINDER_ACTION, entity: "ClubWeapon", entityId: key, detail });
}

/** Vereine mit aktivem Modul «weapons» (nicht gelöscht). */
async function tenantsWithWeapons() {
  const defaultOn = MODULES.find((m) => m.key === "weapons")?.defaultEnabled ?? false;
  const tenants = await db.tenant.findMany({
    where: {
      deletedAt: null,
      ...(defaultOn ? { NOT: { modules: { some: { moduleKey: "weapons", enabled: false } } } } : { modules: { some: { moduleKey: "weapons", enabled: true } } }),
    },
    select: { id: true },
  });
  return tenants.map((t) => t.id);
}

const listNames = (t: TFunction, names: string[], max = 5) => (names.length > max ? `${names.slice(0, max).join(", ")} ${t("adm2.weapons.notify.and")} ${t("adm2.weapons.notify.more", { n: names.length - max })}` : names.join(", "));

/**
 * Stündlicher Erinnerungs-Hook (REMINDER_HOOKS in src/lib/jobs/registry.ts). Entscheidet selbst, ob etwas fällig ist:
 * - überfällige Leihen → Waffenverantwortliche, einmal pro Tag und Verein
 * - Meldefrist Minderjährige in ≤ 5 Tagen (oder vorbei) und nicht gemeldet → einmal pro Tag und Verein
 * - Wartung fällig (Schuss oder Datum) → einmal pro Woche und Verein
 * Doppelte Benachrichtigungen verhindert ein Eintrag im Audit-Log (Aktion «weapons.reminder»).
 */
export async function runWeaponReminders(now: Date = new Date()): Promise<{ overdue: number; minor: number; service: number }> {
  const result = { overdue: 0, minor: 0, service: 0 };
  const parts = zurichParts(now);
  if (Number(parts.timeStr.slice(0, 2)) < FROM_HOUR) return result;
  const today = parts.dateStr;
  const week = isoWeekKey(today);

  for (const tenantId of await tenantsWithWeapons()) {
    try {
      let managers: string[] | null = null;
      let tn: TFunction | null = null;
      const lt = async () => (tn ??= getT(await getTenantLocale(tenantId)));
      const recipients = async () => (managers ??= await tenantUserIdsWithRole(tenantId, MANAGER_ROLES));

      const open = await db.weaponLoan.findMany({
        where: { tenantId, returnedAt: null },
        select: { id: true, dueAt: true, returnedAt: true, isMinor: true, reportDueAt: true, reportedAt: true, borrowerName: true, user: { select: { name: true } }, weapon: { select: { name: true } } },
      });

      // 1) Überfällige Leihen
      const overdue = open.filter((l) => isLoanOverdue(l, now));
      const overdueKey = `weapons:overdue:${tenantId}:${today}`;
      if (overdue.length && !(await alreadySent(tenantId, overdueKey))) {
        const names = overdue.map((l) => `${l.weapon.name} (${l.user?.name ?? l.borrowerName ?? "?"})`);
        const t = await lt();
        await notify({
          tenantId, userIds: await recipients(), topic: "reminders",
          title: overdue.length === 1 ? t("adm2.weapons.notify.overdueOne") : t("adm2.weapons.notify.overdueMany", { n: overdue.length }),
          body: t("adm2.weapons.notify.overdueBody", { names: listNames(t, names) }),
          url: "/weapons/loans", tag: `weapons-overdue:${tenantId}`, dedupeKey: overdueKey,
        });
        await markSent(tenantId, overdueKey, `${overdue.length} überfällig`);
        result.overdue += overdue.length;
      }

      // 2) Meldefrist Minderjährige (auch bereits zurückgegebene Leihen zählen)
      const minorLoans = await db.weaponLoan.findMany({
        where: { tenantId, isMinor: true, reportedAt: null, reportDueAt: { not: null, lte: new Date(now.getTime() + (MINOR_REPORT_WARN_DAYS + 1) * 86_400_000) } },
        select: { id: true, isMinor: true, reportDueAt: true, reportedAt: true, borrowerName: true, user: { select: { name: true } }, weapon: { select: { name: true } } },
      });
      const minorDue = minorLoans.filter((l) => {
        const s = minorReportState(l, now, MINOR_REPORT_WARN_DAYS).state;
        return s === "soon" || s === "overdue";
      });
      const minorKey = `weapons:minor:${tenantId}:${today}`;
      if (minorDue.length && !(await alreadySent(tenantId, minorKey))) {
        const t = await lt();
        const locale = await getTenantLocale(tenantId);
        const names = minorDue.map((l) => t("adm2.weapons.notify.minorUntil", { name: l.user?.name ?? l.borrowerName ?? "?", date: formatDate(l.reportDueAt!, locale) }));
        await notify({
          tenantId, userIds: await recipients(), topic: "reminders",
          title: t("adm2.weapons.notify.minorTitle"),
          body: t("adm2.weapons.notify.minorBody", { names: listNames(t, names) }),
          url: "/weapons/loans#minors", tag: `weapons-minor:${tenantId}`, dedupeKey: minorKey,
        });
        await markSent(tenantId, minorKey, `${minorDue.length} Meldungen offen`);
        result.minor += minorDue.length;
      }

      // 3) Wartung fällig (wöchentlich)
      const serviceKey = `weapons:service:${tenantId}:${week}`;
      if (!(await alreadySent(tenantId, serviceKey))) {
        const weapons = await db.clubWeapon.findMany({
          where: { tenantId, status: { not: "RETIRED" }, OR: [{ serviceEveryShots: { not: null } }, { nextServiceAt: { not: null } }, { status: "SERVICE" }] },
          select: { id: true, name: true, status: true, serviceEveryShots: true, nextServiceAt: true },
        });
        const since = await shotsSinceServiceMap(tenantId, weapons.map((w) => w.id));
        const due = weapons.filter((w) => serviceInfo({ ...w, shotsSinceService: since.get(w.id) ?? 0 }, today).due);
        if (due.length) {
          const t = await lt();
          await notify({
            tenantId, userIds: await recipients(), topic: "reminders",
            title: due.length === 1 ? t("adm2.weapons.notify.serviceOne") : t("adm2.weapons.notify.serviceMany", { n: due.length }),
            body: t("adm2.weapons.notify.serviceBody", { names: listNames(t, due.map((w) => w.name)) }),
            url: "/weapons?status=due", tag: `weapons-service:${tenantId}`, dedupeKey: serviceKey,
          });
          await markSent(tenantId, serviceKey, `${due.length} Wartungen fällig`);
          result.service += due.length;
        }
      }
    } catch (e) {
      console.error("Vereinswaffen: Erinnerung fehlgeschlagen", tenantId, e);
    }
  }
  return result;
}
