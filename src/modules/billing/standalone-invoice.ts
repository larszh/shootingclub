import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { formatDate, formatMoneyLocale } from "@/lib/i18n/core";
import { isPlaceholderEmail } from "@/modules/members/types";
import { ensureReference, tenantQrIban } from "./reference";
import { dueDateInDays } from "./dates";

/**
 * Einzelne Beitragsrechnung (FeeInvoice) ausserhalb des Jahreslaufs, z.B. Ersatzabgabe für fehlende
 * Arbeitsstunden. Gleiche Nummernfolge wie der Jahreslauf (Präfix des Jahreslaufs, sonst «MB-»),
 * gleiche QR-Referenz-Logik. Die Rechnung hängt bewusst NICHT an der Mitgliedschaft (membershipId = null),
 * damit sie den Mitgliederbeitrag desselben Jahres nicht als «bereits verrechnet» erscheinen lässt;
 * zugeordnet ist sie über userId (Zahlungen des Mitglieds, Offene Posten).
 */

type Client = typeof db | Prisma.TransactionClient;

export type StandaloneFeeInvoiceInput = {
  tenantId: string;
  userId: string;
  year: number;
  /** Bezeichnung auf der Rechnung, max. 191 Zeichen */
  categoryName: string;
  amountCents: number;
  /** Zahlbar in Tagen (Standard: Frist des Jahreslaufs, sonst 30) */
  dueDays?: number;
};

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Präfix und Zahlungsfrist des Jahreslaufs (falls vorhanden). */
export async function standaloneInvoiceDefaults(client: Client, tenantId: string, year: number) {
  const [run, profile] = await Promise.all([
    client.feeRun.findUnique({ where: { tenantId_year: { tenantId, year } }, select: { invoicePrefix: true, dueDays: true } }),
    client.billingProfile.findUnique({ where: { tenantId }, select: { currency: true, payeeName: true, iban: true } }),
  ]);
  return {
    prefix: run?.invoicePrefix || "MB-",
    dueDays: run?.dueDays ?? 30,
    currency: profile?.currency ?? "CHF",
    profileComplete: !!(profile?.payeeName && profile.iban),
  };
}

/**
 * Legt eine Einzelrechnung an (innerhalb einer Transaktion möglich). Fortlaufende Nummer wie im
 * Jahreslauf; bei Nummernkollision wird bis zu fünfmal neu nummeriert. Die QR-Referenz und die
 * Benachrichtigung folgen nach dem Commit mit `finalizeStandaloneFeeInvoices`.
 */
export async function createStandaloneFeeInvoice(client: Client, input: StandaloneFeeInvoiceInput) {
  const user = await client.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true, street: true, zip: true, city: true } });
  if (!user) throw new Error("Benutzer nicht gefunden");
  const d = await standaloneInvoiceDefaults(client, input.tenantId, input.year);
  const dueAt = dueDateInDays(input.dueDays ?? d.dueDays);
  const address = [user.street, [user.zip, user.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") || null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await client.feeInvoice.count({ where: { tenantId: input.tenantId, number: { startsWith: `${d.prefix}${input.year}-` } } });
    const number = `${d.prefix}${input.year}-${String(count + 1 + attempt).padStart(4, "0")}`;
    try {
      return await client.feeInvoice.create({
        data: {
          tenantId: input.tenantId, runId: null, membershipId: null, userId: input.userId, categoryId: null, year: input.year, number,
          memberName: user.name.slice(0, 191), memberEmail: isPlaceholderEmail(user.email) ? null : user.email, memberAddress: address,
          categoryName: input.categoryName.slice(0, 191), amountCents: input.amountCents, currency: d.currency, dueAt,
        },
      });
    } catch (e) {
      if (attempt === 4 || !isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Keine freie Rechnungsnummer gefunden.");
}

type CreatedInvoice = { id: string; tenantId: string; userId: string | null; number: string; reference: string | null; categoryName: string; amountCents: number; currency: string; dueAt: Date };

/** Nach dem Commit: QR-Referenz vergeben (bei QR-IBAN) und das Mitglied benachrichtigen (Thema «invoices»). */
export async function finalizeStandaloneFeeInvoices(tenantId: string, invoices: CreatedInvoice[]) {
  if (!invoices.length) return;
  const qrIban = await tenantQrIban(tenantId);
  if (qrIban) for (const inv of invoices) await ensureReference("FEE", inv, qrIban);
  const club = (await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }))?.name ?? "";
  for (const inv of invoices) {
    if (!inv.userId) continue;
    const amount = formatMoneyLocale(inv.amountCents, "de", inv.currency);
    const date = formatDate(inv.dueAt, "de");
    await notify({
      tenantId,
      userIds: [inv.userId],
      topic: "invoices",
      title: `Neue Rechnung: ${inv.categoryName}`,
      body: `Rechnung ${inv.number} über ${amount}, zahlbar bis ${date}.`,
      url: "/payments",
      tag: `invoice:${inv.id}`,
      i18n: {
        title: "notify.invoice.issued.title",
        body: "notify.invoice.issued.body",
        emailSubject: "notify.invoice.issued.subject",
        vars: { title: inv.categoryName, number: inv.number, amount, date, club },
        localeVars: (locale) => ({ amount: formatMoneyLocale(inv.amountCents, locale, inv.currency), date: formatDate(inv.dueAt, locale) }),
      },
      dedupeKey: `fee-invoice:${inv.id}`,
    });
  }
}
