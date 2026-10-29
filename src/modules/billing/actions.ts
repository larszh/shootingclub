"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireBillingAdmin } from "./guard";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { z } from "zod";
import { categorySchema, isValidIban, joinNoteLines, profileSchema, reminderCount, runSchema, withReminderCount } from "./types";
import { ensureReference, tenantQrIban } from "./reference";
import { isQrIban } from "@/lib/qr-reference";
import { todayZurich, zurichParts } from "@/lib/time";
import { dueDateInDays } from "./dates";
import { feeInvoicesToCreate, householdInvoiceCovering, householdMemberAuditRows, type FeeSnapshot } from "./fee-run";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatDate, formatMoneyLocale, getT } from "@/lib/i18n/core";
import { getTenantLocale } from "@/lib/i18n";


const revalidate = () => { revalidatePath("/admin/billing"); revalidatePath("/billing"); revalidatePath("/admin/bookings"); };

// --- Benachrichtigungen (nie blockierend) -------------------------------------

type InvoiceNoticeRow = { id: string; tenantId: string; userId: string | null; number: string; categoryName: string; year: number; amountCents: number; currency: string; dueAt: Date };

/** Neue Beitragsrechnungen: Push + E-Mail (Thema «invoices») mit Link auf /payments. */
async function notifyFeeInvoices(rows: InvoiceNoticeRow[], kind: "issued" | "reminder") {
  const tenantName = rows.length ? (await db.tenant.findUnique({ where: { id: rows[0]!.tenantId }, select: { name: true } }))?.name ?? "" : "";
  const today = todayZurich();
  for (const inv of rows) {
    if (!inv.userId) continue;
    const amount = formatMoneyLocale(inv.amountCents, "de", inv.currency);
    const date = formatDate(inv.dueAt, "de");
    const title = `${inv.categoryName} ${inv.year}`;
    const vars = { title, number: inv.number, amount, date, club: tenantName };
    // Betrag und Datum in der Sprache des Empfängers
    const localeVars = (locale: string) => ({ amount: formatMoneyLocale(inv.amountCents, locale, inv.currency), date: formatDate(inv.dueAt, locale) });
    await notify({
      tenantId: inv.tenantId,
      userIds: [inv.userId],
      topic: kind === "issued" ? "invoices" : "reminders",
      title: kind === "issued" ? `Neue Rechnung: ${title}` : "Zahlungserinnerung",
      body: kind === "issued"
        ? `Rechnung ${inv.number} über ${amount}, zahlbar bis ${date}.`
        : `Die Rechnung ${inv.number} über ${amount} ist noch offen (fällig seit ${date}).`,
      url: "/payments",
      tag: `invoice:${inv.id}`,
      i18n: {
        title: `notify.invoice.${kind}.title`,
        body: `notify.invoice.${kind}.body`,
        emailSubject: `notify.invoice.${kind}.subject`,
        vars,
        localeVars,
      },
      dedupeKey: kind === "issued" ? `fee-invoice:${inv.id}` : `fee-reminder:${inv.id}:${today}`,
    });
  }
}

function notifyFeeInvoicesInBackground(rows: InvoiceNoticeRow[], kind: "issued" | "reminder") {
  if (!rows.length) return;
  void notifyFeeInvoices(rows, kind).catch((e) => console.error("Rechnungs-Benachrichtigung fehlgeschlagen:", (e as Error).message));
}

// --- Rechnungsprofil --------------------------------------------------------

export async function saveBillingProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBillingAdmin({ orBookings: true, orAmmo: true });
  const parsed = profileSchema.safeParse({
    payeeName: formData.get("payeeName") || undefined,
    payeeStreet: formData.get("payeeStreet") || undefined,
    payeeZip: formData.get("payeeZip") || undefined,
    payeeCity: formData.get("payeeCity") || undefined,
    iban: formData.get("iban") || undefined,
    currency: formData.get("currency") || "CHF",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const p = parsed.data;
  if (p.iban && !isValidIban(p.iban)) return fail("Die IBAN ist ungültig (Prüfziffer stimmt nicht).");
  const data = { payeeName: p.payeeName ?? null, payeeStreet: p.payeeStreet ?? null, payeeZip: p.payeeZip ?? null, payeeCity: p.payeeCity ?? null, iban: p.iban ?? null, currency: p.currency };
  await db.billingProfile.upsert({ where: { tenantId: ctx.tenant.id }, create: { tenantId: ctx.tenant.id, ...data }, update: data });
  revalidate();
  return ok(undefined, p.iban && isQrIban(p.iban)
    ? "Gespeichert. QR-IBAN erkannt: Rechnungen erhalten ab jetzt eine QR-Referenz."
    : "Rechnungsprofil gespeichert.");
}

// --- Kategorien -------------------------------------------------------------

export async function saveCategoryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    amountCents: parseMoneyToCents(String(formData.get("amount") ?? "")),
    description: formData.get("description") || undefined,
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const c = parsed.data;
  const data = { name: c.name, amountCents: c.amountCents, description: c.description ?? null, isActive: c.isActive };
  if (id) {
    const ex = await db.feeCategory.findUnique({ where: { id } });
    if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
    await db.feeCategory.update({ where: { id }, data });
  } else {
    const count = await db.feeCategory.count({ where: { tenantId: ctx.tenant.id } });
    await db.feeCategory.create({ data: { ...data, tenantId: ctx.tenant.id, sortOrder: count } });
  }
  revalidate();
  return ok(undefined, "Kategorie gespeichert.");
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const ex = await db.feeCategory.findUnique({ where: { id }, include: { _count: { select: { memberships: true } } } });
  if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (ex._count.memberships > 0) return fail("Kategorie ist Mitgliedern zugeordnet. Zuerst umhängen oder deaktivieren.");
  await db.feeCategory.delete({ where: { id } });
  revalidate();
  return ok();
}

// --- Zuordnung pro Mitglied ---------------------------------------------------

export async function setMemberFeeAction(membershipId: string, input: { categoryId: string | null; overrideAmount?: string | null; memberNumber?: string | null }): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const m = await db.membership.findUnique({ where: { id: membershipId } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (input.categoryId) {
    const c = await db.feeCategory.findUnique({ where: { id: input.categoryId } });
    if (!c || c.tenantId !== ctx.tenant.id) return fail("Kategorie nicht gefunden");
  }
  const override = input.overrideAmount === undefined ? undefined : input.overrideAmount === null || input.overrideAmount.trim() === "" ? null : parseMoneyToCents(input.overrideAmount);
  if (override != null && (override < 0 || override > 100_000_00)) return fail("Ungültiger Betrag");
  if (input.memberNumber && input.memberNumber.trim().length > 40) return fail("Mitgliedernummer ist zu lang (max. 40 Zeichen).");
  await db.membership.update({
    where: { id: membershipId },
    data: {
      feeCategoryId: input.categoryId,
      ...(override !== undefined ? { feeAmountOverrideCents: override } : {}),
      ...(input.memberNumber !== undefined ? { memberNumber: input.memberNumber?.trim() || null } : {}),
    },
  });
  revalidate();
  return ok();
}

// --- Jahreslauf ---------------------------------------------------------------

type Tx = Prisma.TransactionClient;

async function nextNumber(tx: Tx, tenantId: string, prefix: string, year: number, offset: number) {
  const count = await tx.feeInvoice.count({ where: { tenantId, number: { startsWith: `${prefix}${year}-` } } });
  return `${prefix}${year}-${String(count + 1 + offset).padStart(4, "0")}`;
}

type MemberSnapshot = FeeSnapshot;

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Legt eine Rechnung an (innerhalb der Transaktion mit gesperrtem Jahreslauf). Wiederholt nur bei Nummernkollision. */
async function createInvoiceFor(tx: Tx, tenantId: string, run: { id: string; year: number; invoicePrefix: string; dueAt: Date }, m: MemberSnapshot, billing: { currency: string }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await nextNumber(tx, tenantId, run.invoicePrefix, run.year, attempt);
    try {
      return await tx.feeInvoice.create({
        data: {
          tenantId, runId: run.id, membershipId: m.id, userId: m.userId, categoryId: m.categoryId, year: run.year, number,
          memberName: m.name, memberEmail: m.email || null, memberAddress: m.address, categoryName: m.categoryName, amountCents: m.amountCents,
          currency: billing.currency, dueAt: run.dueAt,
        },
      });
    } catch (e) {
      if (attempt === 4 || !isUniqueViolation(e)) throw e;
    }
  }
  return null;
}

/**
 * Erstellt Rechnungen für einen Jahreslauf. Die FeeRun-Zeile wird gesperrt, damit parallele Läufe
 * (zwei Tabs, zwei Admins) nacheinander laufen und dieselben Mitglieder nicht doppelt verrechnen.
 * `pick` bestimmt innerhalb der Sperre, wer eine Rechnung erhält.
 */
async function createInvoicesLocked(tenantId: string, actor: { id: string; name: string }, run: { id: string; year: number; invoicePrefix: string; dueAt: Date }, pick: (tx: Tx) => Promise<MemberSnapshot[]>) {
  const billing = await billingDefaults(tenantId);
  const created = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`FeeRun\` WHERE id = ${run.id} FOR UPDATE`;
    const out = [];
    for (const m of await pick(tx)) {
      const inv = await createInvoiceFor(tx, tenantId, run, m, billing);
      if (!inv) continue;
      // Haushaltsrechnung: festhalten, welche Mitgliedschaften sie enthält (bestimmt die Abdeckung bei späteren Läufen).
      if (m.covers?.length) await tx.auditLog.createMany({ data: householdMemberAuditRows(tenantId, inv, m.covers, actor) });
      out.push(inv);
    }
    return out;
  }, { maxWait: 15_000, timeout: 120_000 });
  // Bei QR-IBAN direkt eine eindeutige QR-Referenz vergeben (nach dem Commit).
  if (billing.qrIban) for (const inv of created) await ensureReference("FEE", inv, billing.qrIban);
  notifyFeeInvoicesInBackground(created, "issued");
  return created;
}

async function billingDefaults(tenantId: string) {
  const [profile, qrIban] = await Promise.all([db.billingProfile.findUnique({ where: { tenantId }, select: { currency: true } }), tenantQrIban(tenantId)]);
  return { currency: profile?.currency ?? "CHF", qrIban };
}

/** Upsert des Jahreslaufs; legen zwei Anfragen ihn gleichzeitig an, gewinnt eine und die andere aktualisiert. */
async function upsertRun(args: Prisma.FeeRunUpsertArgs) {
  try {
    return await db.feeRun.upsert(args);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return db.feeRun.upsert(args);
  }
}

/** Legt den Jahreslauf an (falls nötig) und erstellt Rechnungen für alle Mitglieder mit Beitrag ohne Rechnung in diesem Jahr. */
export async function createRunAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const parsed = runSchema.safeParse({
    year: formData.get("year"),
    title: formData.get("title"),
    invoicePrefix: formData.get("invoicePrefix") || "MB-",
    dueDays: formData.get("dueDays") || 30,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const r = parsed.data;
  const profile = await db.billingProfile.findUnique({ where: { tenantId: ctx.tenant.id } });
  if (!profile?.payeeName || !profile.iban) return fail("Bitte zuerst das Rechnungsprofil (Zahlungsempfänger und IBAN) ausfüllen.");

  const dueAt = dueDateInDays(r.dueDays);
  const run = await upsertRun({
    where: { tenantId_year: { tenantId: ctx.tenant.id, year: r.year } },
    create: { tenantId: ctx.tenant.id, year: r.year, title: r.title, dueAt, invoicePrefix: r.invoicePrefix, dueDays: r.dueDays, note: r.note ?? null },
    update: { title: r.title, invoicePrefix: r.invoicePrefix, dueDays: r.dueDays, note: r.note ?? null },
  });
  // «Haushalte zusammenfassen» (Standard an): eine Rechnung pro Haushalt an den Zahler.
  const combineHouseholds = formData.get("combineHouseholds") !== "off";
  const created = (await createInvoicesLocked(ctx.tenant.id, ctx.user, { ...run, dueAt }, (tx) => feeInvoicesToCreate(tx, ctx.tenant.id, r.year, combineHouseholds))).length;
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "billing.run", entity: "FeeRun", entityId: run.id,
    detail: `${r.title} ${r.year}: ${created} ${created === 1 ? "Rechnung" : "Rechnungen"} erstellt${combineHouseholds ? " (Haushalte zusammengefasst)" : ""}`,
  });
  revalidate();
  redirect(`/admin/billing/runs/${run.id}?created=${created}`);
}

/** Einzelrechnung für ein Mitglied (z.B. Eintritt unter dem Jahr). */
export async function createSingleInvoiceAction(membershipId: string, year: number): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: true, feeCategory: true, feeInvoices: { where: { year, status: { not: "CANCELLED" } } } } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (m.feeInvoices.length) return fail("Für dieses Jahr existiert bereits eine Rechnung.");
  // Mitglied ist schon in der Haushaltsrechnung eines anderen Haushaltsmitglieds enthalten.
  const covered = await householdInvoiceCovering(db, ctx.tenant.id, m.id, year);
  if (covered) return fail(covered.number ? `Bereits in der Haushaltsrechnung ${covered.number} enthalten.` : "Bereits in einer Haushaltsrechnung enthalten.");
  const amount = m.feeAmountOverrideCents ?? m.feeCategory?.amountCents ?? null;
  if (amount === null || amount <= 0) return fail("Kein Beitrag definiert (Kategorie oder individueller Betrag).");
  const profile = await db.billingProfile.findUnique({ where: { tenantId: ctx.tenant.id } });
  if (!profile?.payeeName || !profile.iban) return fail("Bitte zuerst das Rechnungsprofil ausfüllen.");
  // Titel und Bezeichnung erscheinen auf der Rechnung: in der Sprache des Vereins.
  const memberFee = getT(await getTenantLocale(ctx.tenant.id))("invoice.memberFee");
  const run = await upsertRun({
    where: { tenantId_year: { tenantId: ctx.tenant.id, year } },
    create: { tenantId: ctx.tenant.id, year, title: `${memberFee} ${year}`, dueAt: dueDateInDays(30) },
    update: {},
  });
  const dueAt = dueDateInDays(run.dueDays);
  const snapshot: MemberSnapshot = {
    id: m.id, userId: m.userId, name: m.user.name, email: m.user.email,
    address: [m.user.street, [m.user.zip, m.user.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") || null,
    categoryId: m.feeCategoryId, categoryName: m.feeCategory?.name ?? memberFee, amountCents: amount,
  };
  const created = await createInvoicesLocked(ctx.tenant.id, ctx.user, { ...run, dueAt }, async (tx) => {
    // Innerhalb der Sperre nochmals prüfen, ob inzwischen eine Rechnung entstanden ist.
    const exists = await tx.feeInvoice.count({ where: { membershipId: m.id, year, status: { not: "CANCELLED" } } });
    return exists || (await householdInvoiceCovering(tx, ctx.tenant.id, m.id, year)) ? [] : [snapshot];
  });
  if (!created.length) return fail("Für dieses Jahr existiert bereits eine Rechnung.");
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "billing.invoice.create", entity: "Membership", entityId: m.id,
    detail: `${m.user.name}: Rechnung ${created[0]!.number} (${snapshot.categoryName} ${year})`,
  });
  revalidate();
  return ok(undefined, "Rechnung erstellt.");
}

export async function setFeeInvoiceStatusAction(id: string, status: "OPEN" | "PAID" | "CANCELLED", note?: string): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  if (!["OPEN", "PAID", "CANCELLED"].includes(status)) return fail("Ungültiger Status");
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) return fail("Notiz ist ungültig oder zu lang.");
  const inv = await db.feeInvoice.findUnique({ where: { id } });
  if (!inv || inv.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (inv.status === status && note === undefined) return ok();
  const paidAt = status === "PAID" ? (inv.status === "PAID" && inv.paidAt ? inv.paidAt : new Date()) : null;
  // Eine neue Notiz ersetzt die sichtbare Notiz, der interne Mahnzähler bleibt erhalten.
  const reminders = reminderCount(inv.paymentNote, null);
  const paymentNote = note !== undefined ? joinNoteLines(reminders && /Gemahnt:/.test(inv.paymentNote ?? "") ? `Gemahnt: ${reminders}×` : null, [note.trim()]) : undefined;
  await db.feeInvoice.update({ where: { id }, data: { status, paidAt, ...(paymentNote !== undefined ? { paymentNote } : {}) } });
  revalidate();
  return ok();
}

const idsSchema = z.array(z.string().min(1).max(40)).min(1).max(2000);

/**
 * Markiert offene Rechnungen als gemahnt: remindedAt = heute, Mahnzähler +1.
 * Wurde eine Rechnung heute schon gemahnt, zählt ein erneuter Klick nicht doppelt.
 */
export async function markRemindedAction(ids: string[]): Promise<ActionResult> {
  const ctx = await requireBillingAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fail("Ungültige Auswahl");
  const list = await db.feeInvoice.findMany({
    where: { id: { in: parsed.data }, tenantId: ctx.tenant.id, status: "OPEN" },
    select: { id: true, paymentNote: true, remindedAt: true, tenantId: true, userId: true, number: true, categoryName: true, year: true, amountCents: true, currency: true, dueAt: true },
  });
  const reminded: typeof list = [];
  const today = todayZurich();
  const now = new Date();
  let changed = 0;
  for (const inv of list) {
    if (inv.remindedAt && zurichParts(inv.remindedAt).dateStr === today) continue;
    const count = reminderCount(inv.paymentNote, inv.remindedAt) + 1;
    await db.feeInvoice.update({ where: { id: inv.id }, data: { remindedAt: now, paymentNote: withReminderCount(inv.paymentNote, count) } });
    reminded.push(inv);
    changed++;
  }
  // Mitglied erhält die Erinnerung per Push/E-Mail (Thema «reminders»)
  notifyFeeInvoicesInBackground(reminded, "reminder");
  revalidate();
  return ok(undefined, changed ? `${changed} ${changed === 1 ? "Rechnung" : "Rechnungen"} als gemahnt markiert.` : "Heute bereits gemahnt.");
}

/** Mehrere offene Rechnungen auf einmal als bezahlt markieren (z.B. Barzahlung an der GV). */
export async function bulkMarkFeeInvoicesPaidAction(ids: string[]): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireBillingAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fail("Bitte mindestens eine Rechnung wählen.");
  const res = await db.feeInvoice.updateMany({
    where: { id: { in: parsed.data }, tenantId: ctx.tenant.id, status: "OPEN" },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidate();
  return ok({ count: res.count }, `${res.count} ${res.count === 1 ? "Rechnung" : "Rechnungen"} als bezahlt markiert.`);
}
