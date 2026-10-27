"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { formatMoney } from "@/lib/money";
import { zurichToUtc } from "@/lib/time";
import { formatQrReference } from "@/lib/qr-reference";
import { parseCamt } from "./camt";
import { matchCredits } from "./import";
import type { ImportPreviewItem } from "./import-types";
import { appendPaymentNote, NOTE_MAX } from "./types";
import { addDaysFromNow } from "./dates";

const MAX_BYTES = 5 * 1024 * 1024;

export type ImportPreview = {
  token: string;
  fileName: string;
  kind: string;
  iban: string | null;
  skippedDebits: number;
  skippedOther: number;
  items: ImportPreviewItem[];
};

/** Schritt 1: Datei lesen und Vorschau berechnen (es wird noch nichts gespeichert). */
export async function previewCamtImportAction(_prev: ActionResult<ImportPreview> | null, formData: FormData): Promise<ActionResult<ImportPreview>> {
  const ctx = await requirePermission("tenant.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Bitte eine camt-Datei (XML) wählen.");
  if (file.size > MAX_BYTES) return fail("Die Datei ist grösser als 5 MB.");
  const name = file.name || "camt.xml";
  if (!/\.xml$/i.test(name) && !/xml/i.test(file.type)) return fail("Bitte eine XML-Datei hochladen (camt.053 oder camt.054). ZIP-Archive zuerst entpacken.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer());
  } catch {
    return fail("Die Datei konnte nicht gelesen werden.");
  }
  try {
    const parsed = parseCamt(text);
    // Rechnungen der letzten drei Jahre berücksichtigen
    const items = await matchCredits(ctx.tenant.id, parsed.credits, addDaysFromNow(-3 * 366));
    return ok({ token: randomUUID(), fileName: name, kind: parsed.kind, iban: parsed.iban, skippedDebits: parsed.skippedDebits, skippedOther: parsed.skippedOther, items });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Datei konnte nicht ausgewertet werden.");
  }
}

const confirmSchema = z.object({
  fileName: z.string().max(200),
  items: z.array(z.object({
    kind: z.enum(["FEE", "BOOKING"]),
    id: z.string().min(1).max(40),
    bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amountCents: z.number().int().min(1).max(100_000_000),
    currency: z.string().length(3),
    reference: z.string().max(40).nullable(),
    debtorName: z.string().max(140).nullable(),
  })).min(1).max(2000),
});
export type ConfirmImportInput = z.infer<typeof confirmSchema>;

function swissDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

/**
 * Schritt 2: Bestätigte Zuordnungen verbuchen. Idempotent: nur offene Rechnungen des aktiven
 * Vereins werden geändert; bereits bezahlte werden übersprungen.
 */
export async function confirmCamtImportAction(input: ConfirmImportInput): Promise<ActionResult<{ paid: number; skipped: number }>> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail("Ungültige Auswahl.");
  const { fileName, items } = parsed.data;
  let paid = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const it of items) {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const paidAt = zurichToUtc(it.bookingDate, "12:00");
    const line = `Bankimport ${swissDate(it.bookingDate)}: ${formatMoney(it.amountCents, it.currency)}${it.debtorName ? ` von ${it.debtorName}` : ""}${it.reference ? ` (Ref. ${formatQrReference(it.reference)})` : ""}`;

    if (it.kind === "FEE") {
      const inv = await db.feeInvoice.findUnique({ where: { id: it.id }, select: { id: true, tenantId: true, status: true, amountCents: true, currency: true, paymentNote: true } });
      if (!inv || inv.tenantId !== ctx.tenant.id || inv.status !== "OPEN") {
        skipped++;
        continue;
      }
      const diff = inv.amountCents !== it.amountCents ? ` – Betrag abweichend, Rechnung ${formatMoney(inv.amountCents, inv.currency)}` : "";
      const res = await db.feeInvoice.updateMany({
        where: { id: inv.id, tenantId: ctx.tenant.id, status: "OPEN" },
        data: { status: "PAID", paidAt, paymentNote: appendPaymentNote(inv.paymentNote, `${line}${diff}`) },
      });
      if (res.count) paid++;
      else skipped++;
    } else {
      const inv = await db.invoice.findUnique({ where: { id: it.id }, select: { id: true, tenantId: true, status: true, bookingId: true, amountCents: true, currency: true, booking: { select: { adminNote: true } } } });
      if (!inv || inv.tenantId !== ctx.tenant.id || inv.status !== "OPEN") {
        skipped++;
        continue;
      }
      const diff = inv.amountCents !== it.amountCents ? ` (Rechnung ${formatMoney(inv.amountCents, inv.currency)})` : "";
      const adminNote = [inv.booking.adminNote, `${line}${diff}`].filter(Boolean).join(" · ").slice(-NOTE_MAX);
      const [res] = await db.$transaction([
        db.invoice.updateMany({ where: { id: inv.id, tenantId: ctx.tenant.id, status: "OPEN" }, data: { status: "PAID", paidAt } }),
        db.booking.update({ where: { id: inv.bookingId }, data: { paymentStatus: "PAID", paidAt, adminNote } }),
      ]);
      if (res.count) paid++;
      else skipped++;
    }
  }

  console.info(`camt-Import ${fileName} (Tenant ${ctx.tenant.id}): ${paid} verbucht, ${skipped} übersprungen.`);
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
  revalidatePath("/admin/bookings");
  revalidatePath("/bookings");
  return ok({ paid, skipped }, `${paid} ${paid === 1 ? "Zahlung" : "Zahlungen"} verbucht${skipped ? `, ${skipped} übersprungen` : ""}.`);
}
