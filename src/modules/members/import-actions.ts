"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { throttle } from "@/lib/auth";
import { requirePermission } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { todayZurich } from "@/lib/time";
import { sendSetPasswordMail } from "@/modules/core/invitations";
import {
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_PRESETS,
  defaultDecision,
  detectPreset,
  findDuplicate,
  indexExisting,
  mapRows,
  normalizeHeader,
  readCsvBytes,
  suggestMapping,
  type CsvEncoding,
  type Delimiter,
  type ImportDecision,
  type ImportField,
  type ImportPresetId,
  type ImportRecord,
  type MappedRow,
} from "./import";
import { isXlsx, readXlsxBytes } from "./xlsx";
import { dateOnly, isPlaceholderEmail, placeholderEmail, toDbDate } from "./types";

const BATCH = 100;

// --- 1. Datei lesen ---------------------------------------------------------------

export type ParsedImport = {
  fileName: string;
  headers: string[];
  rows: string[][];
  encoding: CsvEncoding | "xlsx";
  delimiter: Delimiter;
  preset: ImportPresetId;
  mapping: ImportField[];
};

export async function parseImportFileAction(formData: FormData): Promise<ActionResult<ParsedImport>> {
  const ctx = await requirePermission("members.manage");
  const limited = throttle(`members-import:${ctx.tenant.id}`, 60, 60 * 60_000);
  if (limited) return fail(limited);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Bitte eine Datei auswählen.");
  if (file.size > IMPORT_MAX_BYTES) return fail("Die Datei ist grösser als 2 MB. Bitte in mehrere Dateien aufteilen.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const xlsx = isXlsx(bytes);
    if (!xlsx && /\.(xls|numbers|ods)$/i.test(file.name)) return fail("Dieses Format wird nicht unterstützt. Bitte als CSV oder .xlsx speichern.");
    const table = xlsx ? readXlsxBytes(bytes) : readCsvBytes(bytes);
    const preset = detectPreset(table.headers);
    return ok({
      fileName: file.name.slice(0, 120),
      headers: table.headers,
      rows: table.rows,
      encoding: xlsx ? "xlsx" : table.encoding,
      delimiter: table.delimiter,
      preset,
      mapping: suggestMapping(table.headers, preset),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
  }
}

/** Vorschlag für eine andere Vorlage (z.B. Wechsel von «Excel» zu «ClubDesk»). */
export async function suggestMappingAction(headers: string[], preset: string): Promise<ActionResult<ImportField[]>> {
  await requirePermission("members.manage");
  if (!Array.isArray(headers) || headers.length > 200 || !(preset in IMPORT_PRESETS)) return fail("Ungültige Eingabe");
  return ok(suggestMapping(headers.map((h) => String(h).slice(0, 200)), preset as ImportPresetId));
}

// --- 2. Prüfen ---------------------------------------------------------------------

const tableSchema = z.object({
  rows: z.array(z.array(z.string().max(5000)).max(200)).min(1, "Keine Zeilen").max(IMPORT_MAX_ROWS),
  mapping: z.array(z.enum(IMPORT_FIELDS)).max(200),
});

export type PreviewRow = {
  line: number;
  name: string;
  email: string | null;
  info: string; // kurze Zusammenfassung (Nr., Status, Ort)
  errors: string[];
  warnings: string[];
  /** Bestehendes Mitglied im Verein */
  duplicate: { name: string; reason: "email" | "nameBirth" } | null;
  /** Konto existiert (anderer Verein): wird verknüpft, Personendaten bleiben unverändert */
  linksAccount: boolean;
  decision: ImportDecision;
};

type Analysis = {
  mapped: MappedRow[];
  dups: Array<ReturnType<typeof findDuplicate>>;
  accounts: Map<string, { id: string; deletedAt: Date | null }>;
  categories: Map<string, string>;
};

async function analyze(tenantId: string, rows: string[][], mapping: ImportField[]): Promise<Analysis> {
  const mapped = mapRows(rows, mapping, todayZurich());
  const [members, cats] = await Promise.all([
    db.membership.findMany({ where: { tenantId }, select: { id: true, userId: true, user: { select: { name: true, email: true, birthDate: true } } } }),
    db.feeCategory.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const { byEmail, byNameBirth } = indexExisting(members.map((m) => ({ membershipId: m.id, userId: m.userId, name: m.user.name, email: m.user.email, birthDate: dateOnly(m.user.birthDate) })));
  const dups = mapped.map((r) => findDuplicate(r.record, byEmail, byNameBirth));

  // Konten aus anderen Vereinen mit derselben E-Mail (E-Mail ist plattformweit eindeutig)
  const emails = [...new Set(mapped.map((r, i) => (!dups[i] && r.record.email ? r.record.email : null)).filter((e): e is string => !!e))];
  const accounts = new Map<string, { id: string; deletedAt: Date | null }>();
  for (let i = 0; i < emails.length; i += 1000) {
    const found = await db.user.findMany({ where: { email: { in: emails.slice(i, i + 1000) } }, select: { id: true, email: true, deletedAt: true } });
    for (const u of found) accounts.set(u.email.toLowerCase(), { id: u.id, deletedAt: u.deletedAt });
  }
  const categories = new Map(cats.map((c) => [normalizeHeader(c.name), c.id]));

  mapped.forEach((r, i) => {
    if (r.record.category && !categories.has(normalizeHeader(r.record.category))) {
      r.warnings.push(`Kategorie «${r.record.category.slice(0, 40)}» gibt es nicht – keine Kategorie zugeordnet`);
    }
    const acc = !dups[i] && r.record.email ? accounts.get(r.record.email) : undefined;
    if (acc?.deletedAt) r.errors.push("Zu dieser E-Mail gibt es ein gelöschtes Konto – ohne E-Mail erfassen oder andere Adresse verwenden");
  });
  return { mapped, dups, accounts, categories };
}

export async function analyzeImportAction(input: { rows: string[][]; mapping: string[] }): Promise<ActionResult<{ rows: PreviewRow[] }>> {
  const ctx = await requirePermission("members.manage");
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Daten");
  const { rows, mapping } = parsed.data;
  if (!mapping.some((f) => f === "name" || f === "firstName" || f === "lastName")) return fail("Bitte mindestens eine Spalte als Name, Vorname oder Nachname zuordnen.");
  const a = await analyze(ctx.tenant.id, rows, mapping);
  return ok({
    rows: a.mapped.map((r, i) => {
      const dup = a.dups[i] ?? null;
      const info = [r.record.memberNumber ? `Nr. ${r.record.memberNumber}` : null, r.record.city, r.record.birthDate ? r.record.birthDate.split("-").reverse().join(".") : null].filter(Boolean).join(" · ");
      return {
        line: r.line,
        name: r.record.name || "(ohne Name)",
        email: r.record.email,
        info,
        errors: r.errors,
        warnings: r.warnings,
        duplicate: dup ? { name: dup.name, reason: dup.reason } : null,
        linksAccount: !dup && !!r.record.email && a.accounts.has(r.record.email),
        decision: defaultDecision(r, dup),
      };
    }),
  });
}

// --- 3. Übernehmen -----------------------------------------------------------------------

const commitSchema = tableSchema.extend({
  decisions: z.array(z.enum(["create", "update", "skip"])).max(IMPORT_MAX_ROWS),
  sendInvites: z.boolean(),
  fileName: z.string().max(200).optional(),
});

export type ImportSummary = { created: number; linked: number; updated: number; skipped: number; failed: number; invited: number; failedLines: number[] };

function newUserId() {
  // cuid-ähnlich: Buchstabe + Zeitanteil + Zufall (für Platzhalter-E-Mail und ID identisch)
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}

/** Nur gesetzte Werte übernehmen – leere Zellen überschreiben nichts. */
function defined<T extends Record<string, unknown>>(o: T): { [K in keyof T]?: NonNullable<T[K]> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "")) as { [K in keyof T]?: NonNullable<T[K]> };
}

function memberFields(r: ImportRecord, categoryId: string | null) {
  return defined({
    memberNumber: r.memberNumber,
    licenseNumber: r.licenseNumber,
    status: r.status,
    joinedAt: toDbDate(r.joinedAt),
    leftAt: toDbDate(r.leftAt),
    feeCategoryId: categoryId,
    adminNote: r.note,
  });
}

function userFields(r: ImportRecord) {
  return defined({ phone: r.phone, street: r.street, zip: r.zip, city: r.city, birthDate: toDbDate(r.birthDate) });
}

export async function commitImportAction(input: { rows: string[][]; mapping: string[]; decisions: string[]; sendInvites: boolean; fileName?: string }): Promise<ActionResult<ImportSummary>> {
  const ctx = await requirePermission("members.manage");
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Daten");
  const { rows, mapping, decisions, sendInvites } = parsed.data;
  if (decisions.length !== rows.length) return fail("Die Auswahl passt nicht zu den Zeilen. Bitte die Vorschau neu laden.");
  const limited = throttle(`members-import-commit:${ctx.tenant.id}`, 10, 60 * 60_000);
  if (limited) return fail(limited);

  // Server prüft alles nochmals selbst (nichts vom Browser übernehmen ausser der Wahl pro Zeile).
  const a = await analyze(ctx.tenant.id, rows, mapping);
  const tenantId = ctx.tenant.id;
  const today = toDbDate(todayZurich());
  const summary: ImportSummary = { created: 0, linked: 0, updated: 0, skipped: 0, failed: 0, invited: 0, failedLines: [] };
  const toInvite: string[] = [];
  const createdEmails = new Set<string>();

  const work = a.mapped.map((row, i) => ({ row, dup: a.dups[i] ?? null, decision: decisions[i]! }));
  for (let start = 0; start < work.length; start += BATCH) {
    const batch = work.slice(start, start + BATCH);
    const batchStats = { created: 0, linked: 0, updated: 0, skipped: 0 };
    const batchInvites: string[] = [];
    try {
      await db.$transaction(async (tx) => {
        for (const { row, dup, decision } of batch) {
          const r = row.record;
          if (decision === "skip" || row.errors.length || (decision === "update" && !dup)) {
            batchStats.skipped++;
            continue;
          }
          const categoryId = r.category ? a.categories.get(normalizeHeader(r.category)) ?? null : null;

          if (dup && decision === "update") {
            await tx.user.update({ where: { id: dup.userId }, data: userFields(r) });
            // Platzhalter-Adresse durch echte E-Mail ersetzen (nur Konten ohne Passwort)
            if (r.email) {
              const u = await tx.user.findUnique({ where: { id: dup.userId }, select: { email: true, passwordSetAt: true } });
              if (u && isPlaceholderEmail(u.email) && !u.passwordSetAt && !(await tx.user.findUnique({ where: { email: r.email }, select: { id: true } }))) {
                await tx.user.update({ where: { id: dup.userId }, data: { email: r.email } });
              }
            }
            await tx.membership.update({ where: { id: dup.membershipId }, data: memberFields(r, categoryId) });
            batchStats.updated++;
            continue;
          }

          // Neu (oder trotz Dublette bewusst neu erfassen: nur ohne gleiche E-Mail möglich)
          if (r.email && createdEmails.has(r.email)) {
            batchStats.skipped++;
            continue;
          }
          const existingUser = r.email ? await tx.user.findUnique({ where: { email: r.email }, select: { id: true, deletedAt: true } }) : null;
          if (existingUser) {
            if (existingUser.deletedAt) {
              batchStats.skipped++;
              continue;
            }
            const already = await tx.membership.findUnique({ where: { userId_tenantId: { userId: existingUser.id, tenantId } }, select: { id: true } });
            if (already) {
              await tx.membership.update({ where: { id: already.id }, data: memberFields(r, categoryId) });
              batchStats.updated++;
            } else {
              // Konto aus einem anderen Verein: nur Mitgliedschaft anlegen, Personendaten bleiben unverändert.
              await tx.membership.create({ data: { userId: existingUser.id, tenantId, role: "MEMBER", status: r.status ?? "ACTIVE", joinedAt: today, ...memberFields(r, categoryId) } });
              batchStats.linked++;
            }
            continue;
          }
          const id = newUserId();
          await tx.user.create({
            data: {
              id,
              email: r.email ?? placeholderEmail(id),
              name: r.name,
              passwordHash: "", // kein Login möglich, bis ein Passwort gesetzt ist
              passwordSetAt: null,
              ...userFields(r),
            },
          });
          await tx.membership.create({ data: { userId: id, tenantId, role: "MEMBER", status: r.status ?? "ACTIVE", ...memberFields(r, categoryId), ...(r.joinedAt ? {} : { joinedAt: today }) } });
          if (r.email) {
            createdEmails.add(r.email);
            if ((r.status ?? "ACTIVE") !== "LEFT") batchInvites.push(id);
          }
          batchStats.created++;
        }
      }, { maxWait: 15_000, timeout: 120_000 });
      summary.created += batchStats.created;
      summary.linked += batchStats.linked;
      summary.updated += batchStats.updated;
      summary.skipped += batchStats.skipped;
      toInvite.push(...batchInvites);
    } catch (e) {
      console.error("Mitglieder-Import: Block fehlgeschlagen", (e as Error).message);
      summary.failed += batch.length;
      summary.failedLines.push(...batch.map((b) => b.row.line));
    }
  }

  if (sendInvites) {
    for (const userId of toInvite) {
      try {
        await sendSetPasswordMail(userId, tenantId);
        summary.invited++;
      } catch (e) {
        console.error("Einladungsmail nach Import fehlgeschlagen:", (e as Error).message);
      }
    }
  }

  await audit({
    tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "members.import", entity: "Membership",
    detail: `${parsed.data.fileName ? `${parsed.data.fileName}: ` : ""}${summary.created} neu, ${summary.linked} verknüpft, ${summary.updated} aktualisiert, ${summary.skipped} übersprungen, ${summary.failed} fehlgeschlagen, ${summary.invited} Einladungen`,
  });
  revalidatePath("/admin/members", "layout");
  revalidatePath("/members");
  return ok(summary);
}
