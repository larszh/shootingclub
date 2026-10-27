"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroyOtherSessions, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { readImageFromForm, storeAvatarImage } from "@/lib/image-upload";
import { deleteStoredFile } from "@/lib/storage";
import { fail, ok, type ActionResult } from "@/lib/action-result";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Profilbild hochladen (FormData-Feld «file», vom ImageUploader bereits auf 512×512 verkleinert). */
export async function uploadAvatarAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const img = await readImageFromForm(formData);
  if ("error" in img) return fail(img.error);
  const prev = await db.user.findUnique({ where: { id: user.id }, select: { avatarPath: true } });
  const rel = await storeAvatarImage("user", user.id, img);
  try {
    await db.user.update({ where: { id: user.id }, data: { avatarPath: rel } });
  } catch {
    await deleteStoredFile(rel);
    return fail("Speichern fehlgeschlagen. Bitte nochmals versuchen.");
  }
  if (prev?.avatarPath && prev.avatarPath !== rel) await deleteStoredFile(prev.avatarPath);
  revalidatePath("/", "layout");
  return ok(undefined, "Profilbild gespeichert.");
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const user = await requireUser();
  const prev = await db.user.findUnique({ where: { id: user.id }, select: { avatarPath: true } });
  if (!prev?.avatarPath) return ok();
  await db.user.update({ where: { id: user.id }, data: { avatarPath: null } });
  await deleteStoredFile(prev.avatarPath);
  revalidatePath("/", "layout");
  return ok(undefined, "Profilbild entfernt.");
}

const THEMES = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEMES)[number];

export async function setThemePrefAction(theme: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.enum(THEMES).safeParse(theme);
  if (!parsed.success) return fail("Ungültige Auswahl");
  await db.user.update({ where: { id: user.id }, data: { themePref: parsed.data } });
  revalidatePath("/", "layout");
  return ok();
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Bitte aktuelles Passwort eingeben"),
    next: z.string().min(8, "Mindestens 8 Zeichen").max(200, "Zu lang"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Die Passwörter stimmen nicht überein", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Das neue Passwort muss sich vom alten unterscheiden", path: ["next"] });

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current") ?? "",
    next: formData.get("next") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return fail(parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.", fe);
  }
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return fail("Das aktuelle Passwort stimmt nicht.", { current: "Stimmt nicht" });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  const loggedOut = await destroyOtherSessions(user.id);
  return ok(
    undefined,
    loggedOut > 0
      ? `Passwort geändert. ${loggedOut === 1 ? "Ein anderes Gerät wurde" : `${loggedOut} andere Geräte wurden`} abgemeldet.`
      : "Passwort geändert.",
  );
}
