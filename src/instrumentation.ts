/**
 * Läuft einmal beim Start des Next.js-Servers. Lädt die Übersetzungs-Übersteuerungen und startet die Hintergrundjobs
 * (Mailversand, Aufräumen, Löschfristen) im langlebigen Node-Prozess unter PM2.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Nicht während `next build` (Seiten werden dort vorgerendert, aber kein Server gestartet).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Übersteuerte Übersetzungen (Admin → Übersetzungen) vorladen – unabhängig von den Jobs.
  try {
    const { loadOverrides } = await import("@/lib/i18n/overrides");
    await loadOverrides();
  } catch (err) {
    console.error("[i18n] Übersteuerungen nicht vorgeladen:", err instanceof Error ? err.message : err);
  }
  if (process.env.JOBS_DISABLED === "1" || process.env.JOBS_DISABLED === "true") return;
  const g = globalThis as { __standchefJobsBooted?: boolean };
  if (g.__standchefJobsBooted) return;
  g.__standchefJobsBooted = true;
  try {
    const { startJobRunner } = await import("@/lib/jobs");
    await startJobRunner();
  } catch (err) {
    console.error("[jobs] Start fehlgeschlagen:", err instanceof Error ? err.message : err);
  }
}
