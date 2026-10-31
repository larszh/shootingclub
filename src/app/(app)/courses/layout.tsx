import { requireCourses } from "@/modules/courses/guard";

/** Kurse: Modul aktiv. Kursleitung (courses.manage) verwaltet, Teilnehmende sehen ihren eigenen Stand. */
export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  await requireCourses();
  return <>{children}</>;
}
