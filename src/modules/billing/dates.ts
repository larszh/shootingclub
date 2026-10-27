/** Kleine Zeit-Helfer ausserhalb von Komponenten (reine Funktionen dürfen hier «jetzt» lesen). */

export function nowDate() {
  return new Date();
}

export function addDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

export function isOverdue(dueAt: Date, now: Date = new Date()) {
  return dueAt.getTime() < now.getTime();
}
