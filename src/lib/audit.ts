import "server-only";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/auth";

export type AuditEntry = {
  tenantId?: string | null;
  actorId?: string | null;
  /** Name zum Zeitpunkt der Aktion (bleibt lesbar, auch wenn das Konto später gelöscht wird). */
  actorName?: string | null;
  /** z.B. member.role.change, auth.password.reset, tenant.delete.request */
  action: string;
  entity?: string;
  entityId?: string;
  /** Kurzer Text ohne heikle Daten (keine Passwörter, Tokens, Bankdaten). */
  detail?: string;
};

const clip = (s: string | null | undefined, max: number) => (s == null ? null : s.length > max ? s.slice(0, max - 1) + "…" : s);

async function requestIp(): Promise<string | null> {
  try {
    const ip = await clientIp();
    return ip === "unknown" ? null : ip;
  } catch {
    // Ausserhalb eines Requests (z.B. in einem Hintergrundjob) gibt es keine Header.
    return null;
  }
}

/**
 * Schreibt einen Eintrag ins Audit-Log. Wirft nie: ein Fehler beim Protokollieren
 * darf die eigentliche Aktion nicht verhindern.
 * Fehlt actorName, wird er aus dem Benutzer (actorId) nachgeschlagen.
 */
export async function audit(e: AuditEntry): Promise<void> {
  try {
    let actorName = e.actorName ?? null;
    if (!actorName && e.actorId) {
      const u = await db.user.findUnique({ where: { id: e.actorId }, select: { name: true } });
      actorName = u?.name ?? null;
    }
    await db.auditLog.create({
      data: {
        tenantId: e.tenantId ?? null,
        actorId: e.actorId ?? null,
        actorName: clip(actorName, 191),
        action: clip(e.action, 191) ?? "unknown",
        entity: clip(e.entity, 191),
        entityId: clip(e.entityId, 191),
        detail: clip(e.detail, 2000),
        ip: clip(await requestIp(), 64),
      },
    });
  } catch (err) {
    console.error("[audit] Eintrag fehlgeschlagen:", e.action, err instanceof Error ? err.message : err);
  }
}
