"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  createAdapter,
  DEFAULT_MAX_FILE_MB,
  encodeCredentials,
  HARD_MAX_FILE_MB,
  hetznerEndpoint,
  loadStorageSettings,
  StorageError,
  type S3Credentials,
  type StorageCredentialsBundle,
  type StorageProviderKey,
  type WebdavCredentials,
} from "@/lib/file-storage";
import { normalisePrefix } from "@/lib/file-storage/s3";
import { canSeeFolder, loadFolderTree } from "./queries";
import { deleteTenantFile } from "./service";
import { cleanFileName, fileExtension, fileNameSchema, folderNameSchema, folderRoleSchema, idSchema } from "./types";

type Ctx = Awaited<ReturnType<typeof requireModule>>;

function revalidateFiles() {
  revalidatePath("/files");
  revalidatePath("/admin/files");
}

function firstIssue(err: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    if (!fe[k]) fe[k] = i.message;
  }
  return fail(Object.values(fe)[0] ?? "Bitte Eingaben prüfen.", fe);
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

async function filesCtx() {
  return requireModule("files");
}

function canManage(ctx: Ctx) {
  return ctx.can("files.manage");
}

function canEditFile(ctx: Ctx, file: { uploadedById: string | null }) {
  return canManage(ctx) || (!!file.uploadedById && file.uploadedById === ctx.user.id && ctx.can("files.upload"));
}

async function visibleFolder(ctx: Ctx, folderId: string) {
  const tree = await loadFolderTree(ctx.tenant.id);
  const node = tree.get(folderId);
  if (!node || !canSeeFolder(node, ctx.tenant.role, ctx.user.isSuperAdmin)) return null;
  return { node, tree };
}

async function loadEditableFile(ctx: Ctx, fileId: string) {
  const file = await db.storedFile.findFirst({ where: { id: fileId, tenantId: ctx.tenant.id, context: "FILES" } });
  if (!file) return { error: "Die Datei existiert nicht mehr." } as const;
  if (file.folderId && !(await visibleFolder(ctx, file.folderId))) return { error: "Die Datei existiert nicht mehr." } as const;
  if (!canEditFile(ctx, file)) return { error: "Du darfst nur eigene Dateien bearbeiten." } as const;
  return { file } as const;
}

// ---------------------------------------------------------------------------
// Ordner
// ---------------------------------------------------------------------------

const folderSchema = z.object({
  name: folderNameSchema,
  minRole: folderRoleSchema,
});

export async function createFolderAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await filesCtx();
  if (!canManage(ctx)) return fail("Nur Admins dürfen Ordner anlegen.");
  const parsed = folderSchema.safeParse({ name: str(fd, "name"), minRole: str(fd, "minRole") || "MEMBER" });
  if (!parsed.success) return firstIssue(parsed.error);
  const parentRaw = str(fd, "parentId").trim();
  let parentId: string | null = null;
  if (parentRaw) {
    const v = await visibleFolder(ctx, parentRaw);
    if (!v) return fail("Der übergeordnete Ordner existiert nicht mehr.");
    if (v.node.path.length >= 8) return fail("Höchstens 8 Ordner-Ebenen.");
    parentId = v.node.id;
  }
  const exists = await db.fileFolder.findFirst({ where: { tenantId: ctx.tenant.id, parentId, name: parsed.data.name }, select: { id: true } });
  if (exists) return fail("Diesen Ordner gibt es hier schon.", { name: "Name bereits vorhanden." });
  const folder = await db.fileFolder.create({
    data: { tenantId: ctx.tenant.id, parentId, name: parsed.data.name, minRole: parsed.data.minRole, createdById: ctx.user.id },
  });
  revalidateFiles();
  return ok({ id: folder.id }, "Ordner angelegt.");
}

export async function updateFolderAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await filesCtx();
  if (!canManage(ctx)) return fail("Nur Admins dürfen Ordner bearbeiten.");
  const id = idSchema.safeParse(str(fd, "id"));
  if (!id.success) return fail("Ordner fehlt.");
  const parsed = folderSchema.safeParse({ name: str(fd, "name"), minRole: str(fd, "minRole") || "MEMBER" });
  if (!parsed.success) return firstIssue(parsed.error);
  const v = await visibleFolder(ctx, id.data);
  if (!v) return fail("Der Ordner existiert nicht mehr.");
  const dup = await db.fileFolder.findFirst({ where: { tenantId: ctx.tenant.id, parentId: v.node.parentId, name: parsed.data.name, NOT: { id: v.node.id } }, select: { id: true } });
  if (dup) return fail("Diesen Namen gibt es hier schon.", { name: "Name bereits vorhanden." });
  await db.fileFolder.updateMany({ where: { id: v.node.id, tenantId: ctx.tenant.id }, data: { name: parsed.data.name, minRole: parsed.data.minRole } });
  revalidateFiles();
  return ok(undefined, "Ordner gespeichert.");
}

/** Löscht den Ordner mit allen Unterordnern und Dateien (auch im Speicher). */
export async function deleteFolderAction(folderId: string): Promise<ActionResult<{ parentId: string | null }>> {
  const ctx = await filesCtx();
  if (!canManage(ctx)) return fail("Nur Admins dürfen Ordner löschen.");
  const id = idSchema.safeParse(folderId);
  if (!id.success) return fail("Ordner fehlt.");
  const v = await visibleFolder(ctx, id.data);
  if (!v) return fail("Der Ordner existiert nicht mehr.");
  const ids = [...v.tree.values()].filter((n) => n.path.some((p) => p.id === v.node.id)).map((n) => n.id);
  const files = await db.storedFile.findMany({ where: { tenantId: ctx.tenant.id, folderId: { in: ids } }, select: { id: true } });
  let failed = 0;
  for (const f of files) {
    const r = await deleteTenantFile(f.id, ctx.tenant.id);
    if (!r.storageDeleted) failed++;
  }
  await db.fileFolder.deleteMany({ where: { id: v.node.id, tenantId: ctx.tenant.id } });
  revalidateFiles();
  return ok({ parentId: v.node.parentId }, failed ? `Ordner gelöscht. ${failed} Datei(en) konnten im Speicher nicht entfernt werden.` : "Ordner gelöscht.");
}

// ---------------------------------------------------------------------------
// Dateien
// ---------------------------------------------------------------------------

export async function renameFileAction(fileId: string, rawName: string): Promise<ActionResult> {
  const ctx = await filesCtx();
  const id = idSchema.safeParse(fileId);
  if (!id.success) return fail("Datei fehlt.");
  const name = fileNameSchema.safeParse(rawName);
  if (!name.success) return fail(name.error.issues[0]?.message ?? "Ungültiger Name.");
  const r = await loadEditableFile(ctx, id.data);
  if ("error" in r) return fail(r.error ?? "Nicht erlaubt.");
  let next = cleanFileName(name.data);
  // Endung beibehalten, wenn sie beim Umbenennen vergessen wurde
  const oldExt = fileExtension(r.file.name);
  if (oldExt && !fileExtension(next)) next = cleanFileName(`${next}.${oldExt}`);
  await db.storedFile.updateMany({ where: { id: r.file.id, tenantId: ctx.tenant.id }, data: { name: next } });
  revalidateFiles();
  return ok(undefined, "Umbenannt.");
}

export async function moveFileAction(fileId: string, targetFolderId: string | null): Promise<ActionResult> {
  const ctx = await filesCtx();
  const id = idSchema.safeParse(fileId);
  if (!id.success) return fail("Datei fehlt.");
  const r = await loadEditableFile(ctx, id.data);
  if ("error" in r) return fail(r.error ?? "Nicht erlaubt.");
  let folderId: string | null = null;
  if (targetFolderId) {
    const v = await visibleFolder(ctx, targetFolderId);
    if (!v) return fail("Der Zielordner existiert nicht mehr.");
    folderId = v.node.id;
  }
  if (folderId === r.file.folderId) return ok(undefined, "Die Datei liegt schon dort.");
  await db.storedFile.updateMany({ where: { id: r.file.id, tenantId: ctx.tenant.id }, data: { folderId } });
  revalidateFiles();
  return ok(undefined, "Verschoben.");
}

export async function deleteFileAction(fileId: string): Promise<ActionResult> {
  const ctx = await filesCtx();
  const id = idSchema.safeParse(fileId);
  if (!id.success) return fail("Datei fehlt.");
  const r = await loadEditableFile(ctx, id.data);
  if ("error" in r) return fail(r.error ?? "Nicht erlaubt.");
  const res = await deleteTenantFile(r.file.id, ctx.tenant.id);
  revalidateFiles();
  return ok(undefined, res.storageDeleted ? "Gelöscht." : "Gelöscht. Der Speicher war nicht erreichbar, die Datei liegt dort evtl. noch.");
}

// ---------------------------------------------------------------------------
// Speicher-Einstellungen (Verwaltung)
// ---------------------------------------------------------------------------

const CHOICES = ["LOCAL", "S3_AWS", "S3_HETZNER", "S3_COMPAT", "WEBDAV"] as const;

const optInt = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), msg);

const settingsSchema = z.object({
  choice: z.enum(CHOICES, { message: "Bitte einen Speicherort wählen." }),
  quotaMb: optInt(1, 10_000_000, "Kontingent: ganze Zahl in MB (leer = unbegrenzt)."),
  maxFileMb: optInt(1, HARD_MAX_FILE_MB, `Max. Dateigrösse: 1 bis ${HARD_MAX_FILE_MB} MB.`),
  endpoint: z.string().trim().max(191, "Endpoint: höchstens 191 Zeichen."),
  region: z.string().trim().max(64, "Region: höchstens 64 Zeichen.").regex(/^[A-Za-z0-9-]*$/, "Region: nur Buchstaben, Ziffern und Bindestrich."),
  hetznerRegion: z.string().trim(),
  bucket: z.string().trim().max(63, "Bucket: höchstens 63 Zeichen.").regex(/^[a-z0-9.-]*$/, "Bucket: nur Kleinbuchstaben, Ziffern, Punkt und Bindestrich."),
  accessKeyId: z.string().trim().max(191, "Access Key: höchstens 191 Zeichen."),
  secretAccessKey: z.string().trim().max(191, "Secret Key: höchstens 191 Zeichen."),
  forcePathStyle: z.boolean(),
  prefix: z.string().trim().max(100, "Präfix: höchstens 100 Zeichen."),
  url: z.string().trim().max(191, "Adresse: höchstens 191 Zeichen."),
  username: z.string().trim().max(191, "Benutzername: höchstens 191 Zeichen."),
  password: z.string().trim().max(191, "Passwort: höchstens 191 Zeichen."),
});

function s3Location(c: S3Credentials | undefined) {
  return c ? [c.endpoint ?? "", c.region, c.bucket, normalisePrefixSafe(c.prefix)].join("|") : "";
}
function normalisePrefixSafe(p: string | undefined) {
  try {
    return normalisePrefix(p);
  } catch {
    return p ?? "";
  }
}

export async function saveStorageSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await filesCtx();
  if (!ctx.can("tenant.manage")) return fail("Nur Admins dürfen den Speicher einstellen.");
  const intent = str(fd, "intent") === "test" ? "test" : "save";
  const parsed = settingsSchema.safeParse({
    choice: str(fd, "choice"),
    quotaMb: str(fd, "quotaMb"),
    maxFileMb: str(fd, "maxFileMb"),
    endpoint: str(fd, "endpoint"),
    region: str(fd, "region"),
    hetznerRegion: str(fd, "hetznerRegion"),
    bucket: str(fd, "bucket"),
    accessKeyId: str(fd, "accessKeyId"),
    secretAccessKey: str(fd, "secretAccessKey"),
    forcePathStyle: fd.get("forcePathStyle") === "on",
    prefix: str(fd, "prefix"),
    url: str(fd, "url"),
    username: str(fd, "username"),
    password: str(fd, "password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;
  const tenantId = ctx.tenant.id;
  const current = await loadStorageSettings(tenantId);
  const bundle: StorageCredentialsBundle = { ...current.credentials };
  let provider: StorageProviderKey = "LOCAL";
  const fe: Record<string, string> = {};

  if (input.choice.startsWith("S3_")) {
    provider = "S3";
    const variant = input.choice === "S3_AWS" ? "AWS" : input.choice === "S3_HETZNER" ? "HETZNER" : "COMPAT";
    let endpoint = "";
    let region = input.region;
    let forcePathStyle = input.forcePathStyle;
    if (variant === "HETZNER") {
      if (!["fsn1", "nbg1", "hel1"].includes(input.hetznerRegion)) fe.hetznerRegion = "Bitte einen Standort wählen.";
      region = input.hetznerRegion;
      endpoint = hetznerEndpoint(input.hetznerRegion);
      forcePathStyle = false;
    } else if (variant === "COMPAT") {
      endpoint = input.endpoint;
      if (!endpoint) fe.endpoint = "Endpoint fehlt.";
      if (!region) region = "us-east-1";
    } else {
      forcePathStyle = false;
      if (!region) fe.region = "Region fehlt (z.B. eu-central-2 für Zürich).";
    }
    if (!input.bucket) fe.bucket = "Bucket fehlt.";
    if (!input.accessKeyId) fe.accessKeyId = "Access Key fehlt.";
    const secret = input.secretAccessKey || current.credentials.s3?.secretAccessKey || "";
    if (!secret) fe.secretAccessKey = "Secret Key fehlt.";
    let prefix = "";
    try {
      prefix = normalisePrefix(input.prefix);
    } catch (e) {
      fe.prefix = e instanceof StorageError ? e.message : "Ungültiges Präfix.";
    }
    if (Object.keys(fe).length) return fail(Object.values(fe)[0]!, fe);
    bundle.s3 = { variant, endpoint: endpoint || undefined, region, bucket: input.bucket, accessKeyId: input.accessKeyId, secretAccessKey: secret, forcePathStyle, prefix: prefix || undefined };
  } else if (input.choice === "WEBDAV") {
    provider = "WEBDAV";
    if (!input.url) fe.url = "WebDAV-Adresse fehlt.";
    if (!input.username) fe.username = "Benutzername fehlt.";
    const password = input.password || current.credentials.webdav?.password || "";
    if (!password) fe.password = "App-Passwort fehlt.";
    if (Object.keys(fe).length) return fail(Object.values(fe)[0]!, fe);
    const w: WebdavCredentials = { url: input.url.replace(/\/+$/, ""), username: input.username, password };
    bundle.webdav = w;
  }

  // Verbindung immer prüfen: beim Test ohne zu speichern, beim Speichern vorher.
  try {
    await createAdapter(tenantId, provider, bundle).test();
  } catch (e) {
    const msg = e instanceof StorageError ? e.message : "Unbekannter Fehler beim Verbindungstest.";
    return fail(intent === "test" ? `Verbindung fehlgeschlagen: ${msg}` : `Nicht gespeichert, die Verbindung funktioniert nicht: ${msg}`);
  }
  if (intent === "test") return ok(undefined, "Verbindung erfolgreich: Testdatei geschrieben, gelesen und gelöscht.");

  // Bestehende Dateien liegen am bisherigen Ort. Ort ändern nur mit Bestätigung.
  if (fd.get("acknowledge") !== "on") {
    const s3Moved = provider === "S3" && current.credentials.s3 && s3Location(current.credentials.s3) !== s3Location(bundle.s3);
    const davMoved = provider === "WEBDAV" && current.credentials.webdav && current.credentials.webdav.url !== bundle.webdav?.url;
    if (s3Moved || davMoved) {
      const existing = await db.storedFile.count({ where: { tenantId, provider } });
      if (existing > 0) {
        const msg = `Im bisherigen ${provider === "S3" ? "S3-Speicher" : "Nextcloud-Ordner"} liegen ${existing} Datei(en). Sie bleiben nur lesbar, wenn du sie selbst an den neuen Ort kopierst. Bitte bestätigen.`;
        return fail(msg, { acknowledge: msg });
      }
    }
  }

  const quotaMb = input.quotaMb;
  const maxFileMb = input.maxFileMb ?? DEFAULT_MAX_FILE_MB;
  const credentialsEnc = Object.keys(bundle).length ? encodeCredentials(bundle) : null;
  await db.storageConfig.upsert({
    where: { tenantId },
    create: { tenantId, provider, quotaMb, maxFileMb, credentialsEnc },
    update: { provider, quotaMb, maxFileMb, credentialsEnc },
  });
  revalidateFiles();
  return ok(undefined, "Gespeichert. Neue Dateien werden ab sofort dort abgelegt.");
}

/** Entfernt gespeicherte Zugangsdaten eines nicht aktiven Anbieters. */
export async function forgetStorageCredentialsAction(which: "S3" | "WEBDAV"): Promise<ActionResult> {
  const ctx = await filesCtx();
  if (!ctx.can("tenant.manage")) return fail("Nur Admins dürfen den Speicher einstellen.");
  const current = await loadStorageSettings(ctx.tenant.id);
  if (current.provider === which) return fail("Der aktive Speicher kann nicht entfernt werden. Zuerst einen anderen wählen.");
  const inUse = await db.storedFile.count({ where: { tenantId: ctx.tenant.id, provider: which } });
  if (inUse > 0) return fail(`Es liegen noch ${inUse} Datei(en) dort. Ohne Zugangsdaten wären sie nicht mehr abrufbar.`);
  const bundle = { ...current.credentials };
  if (which === "S3") delete bundle.s3;
  else delete bundle.webdav;
  await db.storageConfig.updateMany({ where: { tenantId: ctx.tenant.id }, data: { credentialsEnc: Object.keys(bundle).length ? encodeCredentials(bundle) : null } });
  revalidateFiles();
  return ok(undefined, "Zugangsdaten entfernt.");
}
