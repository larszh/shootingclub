import "server-only";
import { randomBytes } from "node:crypto";
import { strToU8, zipSync, type Zippable } from "fflate";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/storage";
import { enqueueMail, renderMail } from "@/lib/mail";
import { getT } from "@/lib/i18n";
import { toCsv } from "@/modules/billing/csv";
import { safeJson } from "@/lib/utils";

/**
 * Datenschutz (revDSG): Datenauskunft als ZIP, Kontolöschung mit Pseudonymisierung
 * und Vereinsarchiv für Inhaber. Rein serverseitig – Server Actions liegen in
 * src/app/(app)/me/privacy/actions.ts.
 */

export const DELETED_USER_NAME = "Gelöschtes Mitglied";

/** Pseudonyme Adresse eines gelöschten Kontos (eindeutig, nie zustellbar). */
export function deletedEmailFor(userId: string) {
  return `deleted+${userId}@standchef.invalid`;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const chf = (cents: number | null | undefined) => (cents == null ? null : (cents / 100).toFixed(2));

/** Zip mit fester Zeitangabe für alle Einträge, kompakt komprimiert. */
export function zipFiles(files: Record<string, string>, now: Date = new Date()): Uint8Array {
  const data: Zippable = {};
  for (const [name, content] of Object.entries(files)) data[name] = [strToU8(content), { level: 6, mtime: now }];
  return zipSync(data);
}

// ---------------------------------------------------------------------------
// Datenauskunft (eigene Daten)
// ---------------------------------------------------------------------------

/** Alle Personendaten eines Benutzers als JSON-taugliches Objekt. */
export async function collectPersonalData(userId: string) {
  const [user, memberships, participations, bookings, feeInvoices, ammoOrders, rsvps, messages, files, prefs, pushCount, sessionCount] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, locale: true, street: true, zip: true, city: true, phone: true, birthDate: true, themePref: true, isSuperAdmin: true, totpEnabledAt: true, passwordSetAt: true, createdAt: true, updatedAt: true, avatarPath: true },
    }),
    db.membership.findMany({
      where: { userId },
      select: { role: true, status: true, memberNumber: true, licenseNumber: true, joinedAt: true, leftAt: true, guardianName: true, guardianEmail: true, guardianPhone: true, createdAt: true, feeAmountOverrideCents: true, tenant: { select: { name: true, slug: true } }, feeCategory: { select: { name: true } }, household: { select: { name: true } } },
    }),
    db.matchParticipant.findMany({
      where: { userId },
      select: {
        note: true, total: true, zeros: true, isOfficial: true, attempt: true, passed: true, verifiedAt: true,
        match: { select: { date: true, title: true, status: true, locationNote: true, tenant: { select: { name: true } }, program: { select: { name: true, scoringMode: true } } } },
        results: { select: { stageIndex: true, shotsJson: true, total: true }, orderBy: { stageIndex: "asc" } },
      },
      orderBy: { match: { date: "desc" } },
    }),
    db.booking.findMany({
      where: { userId },
      select: { startsAt: true, endsAt: true, persons: true, isFlatRate: true, status: true, paymentMethod: true, paymentStatus: true, totalCents: true, discountCents: true, currency: true, note: true, createdAt: true, cancelledAt: true, paidAt: true, tenant: { select: { name: true } }, resource: { select: { name: true } }, invoice: { select: { number: true, issuedAt: true, dueAt: true, status: true, amountCents: true, paidAt: true } } },
      orderBy: { startsAt: "desc" },
    }),
    db.feeInvoice.findMany({
      where: { userId },
      select: { number: true, year: true, memberName: true, memberAddress: true, categoryName: true, amountCents: true, currency: true, issuedAt: true, dueAt: true, status: true, paidAt: true, tenant: { select: { name: true } } },
      orderBy: { issuedAt: "desc" },
    }),
    db.ammoOrder.findMany({
      where: { userId },
      select: { status: true, totalCents: true, currency: true, invoiceNumber: true, invoiceIssuedAt: true, dueAt: true, paymentStatus: true, paidAt: true, issuedAt: true, createdAt: true, note: true, tenant: { select: { name: true } }, items: { select: { productName: true, caliber: true, quantity: true, unitLabel: true, totalCents: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.eventRsvp.findMany({
      where: { userId },
      select: { status: true, guests: true, note: true, updatedAt: true, event: { select: { title: true, startsAt: true, tenant: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.chatMessage.findMany({
      where: { senderId: userId, deletedAt: null },
      select: { body: true, createdAt: true, editedAt: true, conversation: { select: { kind: true, title: true, tenant: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    }),
    db.storedFile.findMany({
      where: { uploadedById: userId },
      select: { name: true, mimeType: true, sizeBytes: true, context: true, createdAt: true, tenant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.notificationPreference.findMany({ where: { userId }, select: { channel: true, topic: true, enabled: true } }),
    db.pushSubscription.count({ where: { userId } }),
    db.session.count({ where: { userId } }),
  ]);
  if (!user) return null;

  return {
    exportedAt: new Date().toISOString(),
    note: "Datenauskunft nach Schweizer Datenschutzgesetz (revDSG). Beträge in Franken.",
    profile: {
      id: user.id, email: user.email, name: user.name, locale: user.locale,
      street: user.street, zip: user.zip, city: user.city, phone: user.phone,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
      theme: user.themePref, superAdmin: user.isSuperAdmin, hasAvatar: !!user.avatarPath,
      twoFactorSince: iso(user.totpEnabledAt), passwordSetAt: iso(user.passwordSetAt),
      createdAt: iso(user.createdAt), updatedAt: iso(user.updatedAt),
      activeSessions: sessionCount, pushDevices: pushCount,
    },
    memberships: memberships.map((m) => ({
      club: m.tenant.name, clubSlug: m.tenant.slug, role: m.role, status: m.status, memberNumber: m.memberNumber, licenseNumber: m.licenseNumber,
      joinedAt: m.joinedAt ? m.joinedAt.toISOString().slice(0, 10) : null, leftAt: m.leftAt ? m.leftAt.toISOString().slice(0, 10) : null,
      feeCategory: m.feeCategory?.name ?? null, feeOverride: chf(m.feeAmountOverrideCents), household: m.household?.name ?? null,
      guardian: m.guardianName || m.guardianEmail || m.guardianPhone ? { name: m.guardianName, email: m.guardianEmail, phone: m.guardianPhone } : null,
      since: iso(m.createdAt),
    })),
    results: participations.map((p) => ({
      club: p.match.tenant.name, date: iso(p.match.date), title: p.match.title, program: p.match.program.name, scoring: p.match.program.scoringMode,
      status: p.match.status, location: p.match.locationNote, total: p.total, zeros: p.zeros, official: p.isOfficial, attempt: p.attempt, passed: p.passed, verifiedAt: iso(p.verifiedAt), note: p.note,
      stages: p.results.map((r) => ({ stage: r.stageIndex + 1, total: r.total, shots: safeJson<number[]>(r.shotsJson, []) })),
    })),
    bookings: bookings.map((b) => ({
      club: b.tenant.name, resource: b.resource.name, startsAt: iso(b.startsAt), endsAt: iso(b.endsAt), persons: b.persons, flatRate: b.isFlatRate,
      status: b.status, payment: b.paymentMethod, paymentStatus: b.paymentStatus, total: chf(b.totalCents), discount: chf(b.discountCents), currency: b.currency,
      note: b.note, createdAt: iso(b.createdAt), cancelledAt: iso(b.cancelledAt), paidAt: iso(b.paidAt),
      invoice: b.invoice ? { number: b.invoice.number, issuedAt: iso(b.invoice.issuedAt), dueAt: iso(b.invoice.dueAt), status: b.invoice.status, amount: chf(b.invoice.amountCents), paidAt: iso(b.invoice.paidAt) } : null,
    })),
    invoices: {
      fees: feeInvoices.map((f) => ({ club: f.tenant.name, number: f.number, year: f.year, name: f.memberName, address: f.memberAddress, category: f.categoryName, amount: chf(f.amountCents), currency: f.currency, issuedAt: iso(f.issuedAt), dueAt: iso(f.dueAt), status: f.status, paidAt: iso(f.paidAt) })),
      ammo: ammoOrders.map((o) => ({ club: o.tenant.name, status: o.status, invoiceNumber: o.invoiceNumber, total: chf(o.totalCents), currency: o.currency, orderedAt: iso(o.createdAt), issuedAt: iso(o.issuedAt), invoiceIssuedAt: iso(o.invoiceIssuedAt), dueAt: iso(o.dueAt), paymentStatus: o.paymentStatus, paidAt: iso(o.paidAt), note: o.note, items: o.items.map((i) => ({ product: i.productName, caliber: i.caliber, quantity: i.quantity, unit: i.unitLabel, total: chf(i.totalCents) })) })),
    },
    rsvps: rsvps.map((r) => ({ club: r.event.tenant.name, event: r.event.title, startsAt: iso(r.event.startsAt), status: r.status, guests: r.guests, note: r.note, updatedAt: iso(r.updatedAt) })),
    chatMessages: messages.map((m) => ({ club: m.conversation.tenant.name, conversation: m.conversation.kind === "GROUP" ? m.conversation.title ?? "Gruppe" : "Direktnachricht", sentAt: iso(m.createdAt), editedAt: iso(m.editedAt), text: m.body })),
    uploadedFiles: files.map((f) => ({ club: f.tenant.name, name: f.name, type: f.mimeType, bytes: f.sizeBytes, area: f.context, uploadedAt: iso(f.createdAt) })),
    notificationPreferences: prefs,
  };
}

/** ZIP mit meine-daten.json und einer kurzen Erklärung. */
export async function buildPersonalExportZip(userId: string): Promise<Uint8Array | null> {
  const data = await collectPersonalData(userId);
  if (!data) return null;
  const readme = [
    "Standchef – Datenauskunft",
    "",
    `Erstellt: ${data.exportedAt}`,
    "",
    "meine-daten.json enthält alle Daten, die Standchef zu deinem Konto speichert:",
    "Profil, Mitgliedschaften, Resultate, Reservationen, Rechnungen (Beiträge, Reservationen, Munition),",
    "Anmeldungen zu Anlässen, deine Chat-Nachrichten (nur Text) und die Liste deiner hochgeladenen Dateien.",
    "",
    "Die Dateien selbst kannst du in der Dateiablage deines Vereins herunterladen.",
  ].join("\r\n");
  return zipFiles({ "meine-daten.json": JSON.stringify(data, null, 2), "LIESMICH.txt": readme });
}

// ---------------------------------------------------------------------------
// Kontolöschung
// ---------------------------------------------------------------------------

/** Vereine, in denen der Benutzer einziger Inhaber ist (Löschung dann nicht möglich). */
export async function soleOwnerTenants(userId: string): Promise<Array<{ id: string; name: string }>> {
  const owned = await db.membership.findMany({
    where: { userId, role: "OWNER", status: { not: "LEFT" }, tenant: { deletedAt: null } },
    select: { tenantId: true, tenant: { select: { name: true } } },
  });
  if (!owned.length) return [];
  const others = await db.membership.groupBy({
    by: ["tenantId"],
    where: { tenantId: { in: owned.map((o) => o.tenantId) }, role: "OWNER", status: { not: "LEFT" }, userId: { not: userId }, user: { deletedAt: null } },
    _count: { _all: true },
  });
  const covered = new Set(others.map((o) => o.tenantId));
  return owned.filter((o) => !covered.has(o.tenantId)).map((o) => ({ id: o.tenantId, name: o.tenant.name }));
}

/**
 * Löscht ein Konto durch Pseudonymisierung. Rechnungen, Buchungen und Resultate bleiben
 * (Aufbewahrungspflicht 10 Jahre, OR 958f) und verweisen auf das pseudonymisierte Konto.
 * Künftige, unbezahlte Buchungen werden storniert, wartende Mails an die alte Adresse verworfen.
 * Prüfungen (Passwort, einziger Inhaber) macht der Aufrufer.
 */
export async function pseudonymizeUser(userId: string): Promise<{ email: string; name: string; locale: string; avatarPath: string | null } | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, locale: true, avatarPath: true, deletedAt: true } });
  if (!user || user.deletedAt) return null;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const randomHash = await hashPassword(randomBytes(32).toString("base64url"));
  // Künftige, nicht bezahlte Buchungen werden storniert (wie cancelBookingAction): das Konto kann
  // sich nicht mehr anmelden, nicht stornieren und ist nicht mehr erreichbar. Die Datensätze und
  // Rechnungen bleiben erhalten (Rechnung → CANCELLED); bezahlte Buchungen klärt der Verein (Rückerstattung).
  const futureBookings = await db.booking.findMany({
    where: { userId, startsAt: { gt: now }, status: { in: ["PENDING", "CONFIRMED"] }, paymentStatus: { notIn: ["PAID", "REFUNDED"] } },
    select: { id: true, adminNote: true },
  });
  const futureBookingIds = futureBookings.map((b) => b.id);
  const cancelNote = "Automatisch storniert: Konto gelöscht.";

  await db.$transaction([
    ...futureBookings.map((b) =>
      db.booking.updateMany({
        where: { id: b.id, status: { in: ["PENDING", "CONFIRMED"] }, paymentStatus: { notIn: ["PAID", "REFUNDED"] } },
        data: { status: "CANCELLED", cancelledAt: now, paymentStatus: "NOT_REQUIRED", adminNote: [b.adminNote, cancelNote].filter(Boolean).join(" ").slice(-191) },
      }),
    ),
    db.invoice.updateMany({ where: { bookingId: { in: futureBookingIds }, status: "OPEN" }, data: { status: "CANCELLED" } }),
    // Noch nicht versandte Mails an die bisherige Adresse entfallen (die Löschbestätigung wird danach eingereiht).
    db.mailMessage.updateMany({ where: { toEmail: user.email, status: "QUEUED" }, data: { status: "SKIPPED", lastError: "Konto gelöscht" } }),
    db.session.deleteMany({ where: { userId } }),
    db.pushSubscription.deleteMany({ where: { userId } }),
    db.authToken.deleteMany({ where: { userId } }),
    db.notificationPreference.deleteMany({ where: { userId } }),
    db.chatMember.deleteMany({ where: { userId } }),
    db.programFavorite.deleteMany({ where: { userId } }),
    db.targetFavorite.deleteMany({ where: { userId } }),
    db.invitation.deleteMany({ where: { email: user.email, acceptedAt: null } }),
    // Mitgliedschaften enden; Beitragsrechnungen bleiben über membershipId verknüpft.
    db.membership.updateMany({ where: { userId, status: { not: "LEFT" } }, data: { status: "LEFT", leftAt: today } }),
    db.membership.updateMany({ where: { userId }, data: { role: "MEMBER", licenseNumber: null, guardianName: null, guardianEmail: null, guardianPhone: null, adminNote: null, householdId: null } }),
    db.user.update({
      where: { id: userId },
      data: {
        name: DELETED_USER_NAME,
        email: deletedEmailFor(userId),
        passwordHash: randomHash,
        isSuperAdmin: false,
        street: null, zip: null, city: null, phone: null, birthDate: null,
        avatarPath: null, calendarToken: null,
        totpSecretEnc: null, totpEnabledAt: null, passwordSetAt: null,
        locale: "de", themePref: "system",
        deletedAt: now,
      },
    }),
  ]);

  if (user.avatarPath) {
    try {
      await deleteStoredFile(user.avatarPath);
    } catch (e) {
      console.warn(`[privacy] Profilbild von ${userId} nicht gelöscht:`, e instanceof Error ? e.message : e);
    }
  }
  return { email: user.email, name: user.name, locale: user.locale, avatarPath: user.avatarPath };
}

/** Bestätigung an die bisherige Adresse (mit Ausnahme von Testadressen). */
export async function sendAccountDeletedMail(to: { email: string; name: string; locale: string }) {
  try {
    if (to.email.endsWith(".invalid")) return;
    const t = getT(to.locale);
    const mail = renderMail({
      locale: to.locale,
      title: t("ops.accountDeleted.title"),
      paragraphs: [t("mail.greeting", { name: to.name }), t("ops.accountDeleted.p1"), t("ops.accountDeleted.p2"), t("ops.accountDeleted.p3")],
      footer: t("mail.footer"),
    });
    await enqueueMail({ kind: "account-deleted", to: to.email, toName: to.name, subject: t("ops.accountDeleted.subject"), html: mail.html, text: mail.text, replyTo: null });
  } catch (e) {
    console.warn("[privacy] Bestätigungsmail nicht eingereiht:", e instanceof Error ? e.message : e);
  }
}

/** Audit-Eintrag für eine Kontolöschung (ohne Personendaten). */
export async function auditAccountDeletion(userId: string, tenantIds: string[]) {
  await audit({ actorId: userId, actorName: DELETED_USER_NAME, action: "user.delete.self", entity: "User", entityId: userId, detail: "Konto pseudonymisiert" });
  for (const tenantId of tenantIds) {
    await audit({ tenantId, actorId: userId, actorName: DELETED_USER_NAME, action: "member.delete.self", entity: "User", entityId: userId, detail: "Konto gelöscht, Mitgliedschaft beendet" });
  }
}

// ---------------------------------------------------------------------------
// Vereinsarchiv (Inhaber)
// ---------------------------------------------------------------------------

const d10 = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const dt = (d: Date | null | undefined) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "");

/** CSV-Dateien mit allen wesentlichen Daten eines Vereins (Mitglieder, Resultate, Anlässe, Buchungen, Rechnungen, Dateien). */
export async function buildTenantArchiveFiles(tenantId: string): Promise<Record<string, string>> {
  const [tenant, members, participants, events, bookings, feeInvoices, ammoOrders, files] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true, city: true, canton: true, createdAt: true } }),
    db.membership.findMany({
      where: { tenantId },
      select: { role: true, status: true, memberNumber: true, licenseNumber: true, joinedAt: true, leftAt: true, guardianName: true, guardianEmail: true, guardianPhone: true, workHoursExempt: true, createdAt: true, feeCategory: { select: { name: true } }, household: { select: { name: true } }, user: { select: { name: true, email: true, phone: true, street: true, zip: true, city: true, birthDate: true, deletedAt: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.matchParticipant.findMany({
      where: { match: { tenantId } },
      select: { guestName: true, total: true, zeros: true, isOfficial: true, attempt: true, passed: true, verifiedAt: true, user: { select: { name: true } }, match: { select: { date: true, title: true, status: true, finishedAt: true, program: { select: { name: true } } } } },
      orderBy: [{ match: { date: "desc" } }, { sortOrder: "asc" }],
    }),
    db.event.findMany({
      where: { tenantId },
      select: { title: true, kind: true, startsAt: true, endsAt: true, allDay: true, location: true, isCancelled: true, capacity: true, _count: { select: { rsvps: true } } },
      orderBy: { startsAt: "desc" },
    }),
    db.booking.findMany({
      where: { tenantId },
      select: { startsAt: true, endsAt: true, persons: true, isFlatRate: true, status: true, paymentMethod: true, paymentStatus: true, basePriceCents: true, discountCents: true, totalCents: true, currency: true, note: true, createdAt: true, paidAt: true, user: { select: { name: true, email: true } }, resource: { select: { name: true } }, invoice: { select: { number: true, issuedAt: true, dueAt: true, status: true, amountCents: true, reference: true, paidAt: true } } },
      orderBy: { startsAt: "desc" },
    }),
    db.feeInvoice.findMany({
      where: { tenantId },
      select: { number: true, year: true, memberName: true, memberEmail: true, categoryName: true, amountCents: true, currency: true, issuedAt: true, dueAt: true, status: true, reference: true, paidAt: true, paymentNote: true, remindedAt: true },
      orderBy: [{ year: "desc" }, { number: "asc" }],
    }),
    db.ammoOrder.findMany({
      where: { tenantId },
      select: { status: true, totalCents: true, currency: true, invoiceNumber: true, invoiceIssuedAt: true, dueAt: true, paymentStatus: true, paidAt: true, reference: true, issuedAt: true, createdAt: true, user: { select: { name: true } }, items: { select: { productName: true, quantity: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.storedFile.findMany({
      where: { tenantId },
      select: { name: true, mimeType: true, sizeBytes: true, provider: true, context: true, createdAt: true, folder: { select: { name: true } }, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!tenant) return {};

  const out: Record<string, string> = {};
  out["mitglieder.csv"] = toCsv([
    ["Name", "E-Mail", "Telefon", "Strasse", "PLZ", "Ort", "Geburtsdatum", "Rolle", "Status", "Mitgliedernummer", "Lizenz", "Eintritt", "Austritt", "Beitragskategorie", "Haushalt", "Gesetzliche Vertretung", "E-Mail Vertretung", "Telefon Vertretung", "Arbeitsstunden befreit", "Erfasst"],
    ...members.map((m) => [
      m.user.name, m.user.deletedAt ? "" : m.user.email, m.user.phone, m.user.street, m.user.zip, m.user.city, d10(m.user.birthDate),
      m.role, m.status, m.memberNumber, m.licenseNumber, d10(m.joinedAt), d10(m.leftAt), m.feeCategory?.name, m.household?.name,
      m.guardianName, m.guardianEmail, m.guardianPhone, m.workHoursExempt ? "ja" : "nein", d10(m.createdAt),
    ]),
  ]);
  out["resultate.csv"] = toCsv([
    ["Datum", "Programm", "Titel", "Schütze", "Gast", "Total", "Nuller", "Amtlich", "Versuch", "Bestanden", "Bestätigt", "Status", "Abgeschlossen"],
    ...participants.map((p) => [
      d10(p.match.date), p.match.program.name, p.match.title, p.user?.name ?? "", p.guestName, p.total, p.zeros,
      p.isOfficial ? "ja" : "nein", p.attempt, p.passed == null ? "" : p.passed ? "ja" : "nein", dt(p.verifiedAt), p.match.status, dt(p.match.finishedAt),
    ]),
  ]);
  out["anlaesse.csv"] = toCsv([
    ["Beginn", "Ende", "Ganztägig", "Titel", "Art", "Ort", "Plätze", "Anmeldungen", "Abgesagt"],
    ...events.map((e) => [dt(e.startsAt), dt(e.endsAt), e.allDay ? "ja" : "nein", e.title, e.kind, e.location, e.capacity, e._count.rsvps, e.isCancelled ? "ja" : "nein"]),
  ]);
  out["reservationen.csv"] = toCsv([
    ["Beginn", "Ende", "Ressource", "Person", "E-Mail", "Personen", "Pauschal", "Status", "Zahlungsart", "Zahlungsstatus", "Grundpreis", "Rabatt", "Total", "Währung", "Rechnung", "Bezahlt am", "Bemerkung", "Erfasst"],
    ...bookings.map((b) => [
      dt(b.startsAt), dt(b.endsAt), b.resource.name, b.user?.name ?? "", b.user?.email.endsWith(".invalid") ? "" : b.user?.email, b.persons, b.isFlatRate ? "ja" : "nein",
      b.status, b.paymentMethod, b.paymentStatus, chf(b.basePriceCents), chf(b.discountCents), chf(b.totalCents), b.currency, b.invoice?.number, dt(b.paidAt), b.note, dt(b.createdAt),
    ]),
  ]);
  out["rechnungen-beitraege.csv"] = toCsv([
    ["Nummer", "Jahr", "Name", "E-Mail", "Kategorie", "Betrag", "Währung", "Ausgestellt", "Fällig", "Status", "Bezahlt am", "QR-Referenz", "Gemahnt", "Zahlungsnotiz"],
    ...feeInvoices.map((f) => [f.number, f.year, f.memberName, f.memberEmail, f.categoryName, chf(f.amountCents), f.currency, d10(f.issuedAt), d10(f.dueAt), f.status, d10(f.paidAt), f.reference, d10(f.remindedAt), f.paymentNote]),
  ]);
  out["rechnungen-reservationen.csv"] = toCsv([
    ["Nummer", "Person", "Ressource", "Betrag", "Ausgestellt", "Fällig", "Status", "Bezahlt am", "QR-Referenz"],
    ...bookings.filter((b) => b.invoice).map((b) => [b.invoice!.number, b.user?.name ?? "", b.resource.name, chf(b.invoice!.amountCents), d10(b.invoice!.issuedAt), d10(b.invoice!.dueAt), b.invoice!.status, d10(b.invoice!.paidAt), b.invoice!.reference]),
  ]);
  out["rechnungen-munition.csv"] = toCsv([
    ["Rechnungsnummer", "Person", "Bestellt", "Ausgegeben", "Artikel", "Betrag", "Währung", "Status", "Zahlungsstatus", "Rechnung vom", "Fällig", "Bezahlt am", "QR-Referenz"],
    ...ammoOrders.map((o) => [o.invoiceNumber, o.user?.name ?? "", dt(o.createdAt), dt(o.issuedAt), o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", "), chf(o.totalCents), o.currency, o.status, o.paymentStatus, d10(o.invoiceIssuedAt), d10(o.dueAt), d10(o.paidAt), o.reference]),
  ]);
  out["dateien.csv"] = toCsv([
    ["Name", "Ordner", "Typ", "Grösse (Bytes)", "Speicher", "Bereich", "Hochgeladen von", "Hochgeladen am"],
    ...files.map((f) => [f.name, f.folder?.name ?? "", f.mimeType, f.sizeBytes, f.provider, f.context, f.uploadedBy?.name ?? "", dt(f.createdAt)]),
  ]);
  out["LIESMICH.txt"] = [
    `Vereinsarchiv ${tenant.name} (${tenant.slug})`,
    `Erstellt: ${new Date().toISOString()}`,
    "",
    "CSV-Dateien mit Semikolon und UTF-8 (öffnen direkt in Excel/Numbers/LibreOffice).",
    "Zeitangaben in UTC. Beträge in Franken.",
    "Die Dateien der Dateiablage selbst sind nicht enthalten, nur deren Liste (dateien.csv).",
    "",
    "Enthält Personendaten: bitte sicher aufbewahren und nicht weitergeben.",
  ].join("\r\n");
  return out;
}
