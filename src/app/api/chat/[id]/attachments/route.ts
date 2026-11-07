import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiConversationAccess, json, sameOrigin } from "@/modules/chat/api";
import { createMessage, messageSelect, toMessageDTO } from "@/modules/chat/service";
import { clientIdSchema, messageBodySchema } from "@/modules/chat/types";
import { deleteTenantFile, fileErrorMessage, FileServiceError, readUploadForm, saveTenantFile } from "@/modules/files/service";
import { loadStorageSettings } from "@/lib/file-storage";
import { getRequestLocale, getT, normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Nachricht mit Anhang senden (multipart/form-data: file, clientId, optional body).
 * Die Grösse begrenzt saveTenantFile (Einstellung der Dateiablage, Standard 25 MB).
 * Idempotent: gleiche clientId → bestehende Nachricht, die Datei wird nicht nochmals gespeichert.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: getT(await getRequestLocale())("misc.chat.badOrigin") }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: getT(await getRequestLocale())("misc.chat.notSignedIn") }, 401);
  const locale = normalizeLocale(user.locale);
  const t = getT(locale);
  const { id } = await params;
  const access = await apiConversationAccess(user, id);
  if (!access) return json({ error: t("misc.chat.conversationGone") }, 404);

  // Begrenzt lesen: bricht ab, sobald mehr als die erlaubte Dateigrösse ankommt
  // (auch ohne Content-Length, z.B. bei chunked Uploads).
  const settings = await loadStorageSettings(access.conversation.tenantId);
  let form: FormData;
  try {
    form = await readUploadForm(req, settings.maxFileMb);
  } catch (e) {
    return json({ error: fileErrorMessage(e, locale) }, e instanceof FileServiceError ? e.status : 400);
  }
  const clientId = clientIdSchema.safeParse(String(form.get("clientId") ?? ""));
  if (!clientId.success) return json({ error: t("misc.chat.invalidClientId") }, 400);
  const body = messageBodySchema.safeParse(String(form.get("body") ?? ""));
  if (!body.success) return json({ error: (locale === "de" ? body.error.issues[0]?.message : undefined) ?? t("misc.chat.invalidMessage") }, 400);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: t("misc.chat.chooseFile") }, 400);

  // Schon gesendet (z.B. Wiederholung nach Verbindungsabbruch)?
  const existing = await db.chatMessage.findUnique({ where: { clientId: clientId.data }, select: messageSelect });
  if (existing) {
    if (existing.senderId !== user.id || existing.conversationId !== access.conversation.id) return json({ error: t("misc.chat.invalidClientId") }, 409);
    return json({ message: toMessageDTO(existing) });
  }

  let stored: { id: string };
  try {
    stored = await saveTenantFile({
      tenantId: access.conversation.tenantId,
      userId: user.id,
      name: file.name || t("misc.chat.attachment"),
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      context: "CHAT",
    });
  } catch (e) {
    const status = typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : 400;
    return json({ error: fileErrorMessage(e, locale) }, status);
  }

  const res = await createMessage({ userId: user.id, access, clientId: clientId.data, body: body.data, fileId: stored.id });
  if (!res.ok || !res.data.created) {
    // Nachricht existierte bereits oder Fehler: gespeicherte Datei wieder entfernen.
    await deleteTenantFile(stored.id, access.conversation.tenantId).catch(() => undefined);
  }
  if (!res.ok) return json({ error: res.error }, res.status);
  return json({ message: res.data.message }, res.data.created ? 201 : 200);
}
