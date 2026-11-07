/**
 * Beitritt mit Freigabe (Tenant.joinApproval): reine Zustandslogik, ohne Server-Abhängigkeiten.
 *
 * Ablauf: Beitritt per Code → Membership.status PENDING (kein Zugang, Warteseite) →
 *   Freigabe: PENDING → ACTIVE
 *   Ablehnung: PENDING → Mitgliedschaft wird gelöscht (die Person kann später erneut anfragen)
 *   Rückzug durch die Person selbst: wie Ablehnung
 * Ohne joinApproval bleibt alles wie bisher: Beitritt per Code ergibt sofort ACTIVE.
 */

export type JoinDecision = "APPROVE" | "REJECT" | "WITHDRAW";

/** Status einer neuen Mitgliedschaft beim Beitritt per Code. */
export function joinStatusFor(tenant: { joinApproval: boolean }): "ACTIVE" | "PENDING" {
  return tenant.joinApproval ? "PENDING" : "ACTIVE";
}

export type JoinTransition = { ok: true; next: "ACTIVE" | "DELETE" } | { ok: false; error: "notPending" | "invalid" };

/** Übergang einer Beitrittsanfrage. Nur PENDING kann entschieden oder zurückgezogen werden. */
export function decideJoin(currentStatus: string | null | undefined, decision: JoinDecision): JoinTransition {
  if (decision !== "APPROVE" && decision !== "REJECT" && decision !== "WITHDRAW") return { ok: false, error: "invalid" };
  if (currentStatus !== "PENDING") return { ok: false, error: "notPending" };
  return { ok: true, next: decision === "APPROVE" ? "ACTIVE" : "DELETE" };
}

export type JoinAttempt =
  | { kind: "create"; status: "ACTIVE" | "PENDING" }
  | { kind: "alreadyMember" }
  | { kind: "alreadyPending" }
  | { kind: "left" };

/** Was beim Beitritt per Code mit einer bestehenden (oder fehlenden) Mitgliedschaft passiert. */
export function joinAttempt(existingStatus: string | null | undefined, tenant: { joinApproval: boolean }): JoinAttempt {
  if (!existingStatus) return { kind: "create", status: joinStatusFor(tenant) };
  if (existingStatus === "LEFT") return { kind: "left" };
  if (existingStatus === "PENDING") return { kind: "alreadyPending" };
  return { kind: "alreadyMember" };
}
