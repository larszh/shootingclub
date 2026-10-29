import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Statusprüfung für Monitoring (Uptime-Kuma, CloudPanel). Ohne Anmeldung, ohne Details. */
export async function GET() {
  let dbOk = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 3_000);
      }),
    ]);
    dbOk = true;
  } catch {
    dbOk = false;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return Response.json(
    { ok: dbOk, db: dbOk, time: new Date().toISOString() },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
