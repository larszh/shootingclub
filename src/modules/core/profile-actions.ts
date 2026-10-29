"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { todayZurich } from "@/lib/time";
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

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name: mindestens 2 Zeichen").max(191, "Name zu lang"),
  phone: z.string().trim().max(40, "Telefon: höchstens 40 Zeichen").regex(/^[+\d\s()/.-]*$/, "Telefon: nur Ziffern, Leerzeichen und + ( ) / . -"),
  birthDate: z.string().trim().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ungültiges Datum"),
  street: z.string().trim().max(80, "Strasse zu lang"),
  zip: z.string().trim().max(12, "PLZ zu lang"),
  city: z.string().trim().max(80, "Ort zu lang"),
});

/** Eigenes Profil: Name, Telefon, Geburtsdatum, Adresse. */
export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    street: formData.get("street") ?? "",
    zip: formData.get("zip") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return fail(parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.", fe);
  }
  const v = parsed.data;
  let birthDate: Date | null = null;
  if (v.birthDate) {
    birthDate = new Date(`${v.birthDate}T00:00:00Z`);
    const today = todayZurich();
    if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== v.birthDate || v.birthDate > today || v.birthDate < "1900-01-01") {
      return fail("Bitte ein gültiges Geburtsdatum eingeben.", { birthDate: "Ungültiges Datum" });
    }
  }
  await db.user.update({
    where: { id: user.id },
    data: { name: v.name, phone: v.phone || null, birthDate, street: v.street || null, zip: v.zip || null, city: v.city || null },
  });
  revalidatePath("/", "layout");
  return ok(undefined, "Gespeichert.");
}
