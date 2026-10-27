import "server-only";
import { db } from "@/lib/db";
import { createQrReference, isQrIban, numericPrefixFrom } from "@/lib/qr-reference";

/**
 * QR-Referenzen für Rechnungen.
 *
 * Aufbau der 26-stelligen Basis (danach folgt die Prüfziffer):
 *   6 Stellen  Kennzahl des Vereins (aus der Tenant-ID abgeleitet)
 *   1 Stelle   Art: 1 = Reservation, 2 = Mitgliederbeitrag
 *   1 Stelle   Ausweichziffer (0, nur bei Kollision höher)
 *  18 Stellen  Ziffern der Rechnungsnummer (z.B. MB-2026-0042 → …000000000020260042)
 *
 * So bleibt die Referenz pro Verein eindeutig und lässt sich beim Bankimport
 * eindeutig einer Rechnung zuordnen.
 */
export type ReferenceKind = "BOOKING" | "FEE";
const KIND_DIGIT: Record<ReferenceKind, string> = { BOOKING: "1", FEE: "2" };

export function referenceBase(tenantId: string, kind: ReferenceKind, invoiceNumber: string, attempt = 0) {
  const digits = invoiceNumber.replace(/\D/g, "").slice(-18).padStart(18, "0");
  return `${numericPrefixFrom(tenantId, 6)}${KIND_DIGIT[kind]}${attempt % 10}${digits}`;
}

/** IBAN des Rechnungsprofils, falls es eine QR-IBAN ist, sonst null. */
export async function tenantQrIban(tenantId: string) {
  const p = await db.billingProfile.findUnique({ where: { tenantId }, select: { iban: true } });
  return p?.iban && isQrIban(p.iban) ? p.iban : null;
}

async function referenceTaken(kind: ReferenceKind, tenantId: string, reference: string, exceptId: string) {
  const where = { tenantId, reference, NOT: { id: exceptId } };
  const hit = kind === "FEE" ? await db.feeInvoice.findFirst({ where, select: { id: true } }) : await db.invoice.findFirst({ where, select: { id: true } });
  return !!hit;
}

async function assignReference(kind: ReferenceKind, inv: { id: string; tenantId: string; number: string }) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const reference = createQrReference(referenceBase(inv.tenantId, kind, inv.number, attempt));
    if (await referenceTaken(kind, inv.tenantId, reference, inv.id)) continue;
    if (kind === "FEE") await db.feeInvoice.update({ where: { id: inv.id }, data: { reference } });
    else await db.invoice.update({ where: { id: inv.id }, data: { reference } });
    return reference;
  }
  throw new Error("Keine eindeutige QR-Referenz gefunden.");
}

type RefInvoice = { id: string; tenantId: string; number: string; reference: string | null };

/**
 * Liefert die QR-Referenz einer Rechnung. Hat der Verein eine QR-IBAN und die Rechnung noch keine
 * Referenz (z.B. ältere Rechnung), wird sie jetzt erzeugt und gespeichert. Ohne QR-IBAN: null.
 * `qrIban` kann übergeben werden, um die Profilabfrage zu sparen (undefined = selbst laden).
 */
export async function ensureReference(kind: ReferenceKind, inv: RefInvoice, qrIban?: string | null): Promise<string | null> {
  const iban = qrIban === undefined ? await tenantQrIban(inv.tenantId) : qrIban && isQrIban(qrIban) ? qrIban : null;
  if (!iban) return inv.reference ?? null;
  if (inv.reference) return inv.reference;
  try {
    return await assignReference(kind, inv);
  } catch (e) {
    console.error("QR-Referenz konnte nicht erzeugt werden:", e);
    return null;
  }
}

/** Für mehrere offene Rechnungen gleichzeitig (z.B. Sammeldruck, Mitgliederansicht). */
export async function ensureReferences<T extends RefInvoice>(kind: ReferenceKind, list: T[], tenantId: string): Promise<T[]> {
  const iban = await tenantQrIban(tenantId);
  if (!iban) return list;
  const out: T[] = [];
  for (const inv of list) out.push(inv.reference ? inv : { ...inv, reference: await ensureReference(kind, inv, iban) });
  return out;
}
