import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { getMatch, listPrograms, listTenantMembers } from "@/modules/scores/queries";
import { toScoreMatch } from "@/modules/scores/sync";
import type { SnapshotResponse } from "@/lib/offline/types";

export const dynamic = "force-dynamic";

const OPEN_MATCH_LIMIT = 15;

/**
 * Daten für den Offline-Betrieb des aktiven Vereins: Programme, Mitglieder und die offenen
 * Durchgänge des Benutzers. Wird vom Client in IndexedDB abgelegt.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401, headers });

  // Benutzer ist angemeldet: getAppContext leitet nicht um.
  const ctx = await getAppContext();
  const body: SnapshotResponse = {
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    tenant: ctx.tenant ? { id: ctx.tenant.id, name: ctx.tenant.name } : null,
    scores: null,
    generatedAt: new Date().toISOString(),
  };

  if (ctx.tenant && ctx.hasModule("scores")) {
    const tctx = ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> };
    const [programs, members, openIds] = await Promise.all([
      listPrograms(tctx),
      listTenantMembers(tctx.tenant.id),
      db.match.findMany({
        where: { tenantId: tctx.tenant.id, status: "OPEN", OR: [{ createdById: user.id }, { participants: { some: { userId: user.id } } }] },
        select: { id: true },
        orderBy: { date: "desc" },
        take: OPEN_MATCH_LIMIT,
      }),
    ]);
    const matches = (await Promise.all(openIds.map((m) => getMatch(tctx, m.id)))).filter((m) => m !== null);
    body.scores = {
      canCreate: ctx.can("match.create"),
      programs: programs.map((p) => ({ id: p.id, name: p.name, discipline: p.discipline, scoringMode: p.scoringMode, stages: p.stages, totals: p.totals, favorite: p.favorite })),
      members: members.map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl })),
      openMatches: matches.map(toScoreMatch),
    };
  }
  return NextResponse.json(body, { headers });
}
