import "server-only";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";

/** Modul «Kurse» aktiv (alle Mitglieder: eigene Kurse sehen). */
export async function requireCourses() {
  return requireModule("courses");
}

/** Modul aktiv und Recht «courses.manage» (Kursleitung, Trainer). */
export async function requireCoursesManage() {
  const ctx = await requireModule("courses");
  if (!ctx.can("courses.manage")) redirect("/courses?denied=1");
  return ctx;
}

/** Qualifikationsschiessen: «qualifications.manage» oder «courses.manage». */
export async function requireQualificationAccess() {
  const ctx = await requireModule("courses");
  if (!ctx.can("qualifications.manage") && !ctx.can("courses.manage")) redirect("/courses?denied=1");
  return ctx;
}
