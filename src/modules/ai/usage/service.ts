/**
 * KI-Verbrauch aus AiUsage lesen (nur Zählwerte, keine Inhalte).
 */
import "server-only";
import { db } from "@/lib/db";
import { PLATFORM_FEATURES, TENANT_FEATURES } from "@/lib/ai/types";
import { buildUsageTable, monthRangeZurich, sumTokens, estimateChf, type UsageGroup, type UsageTable } from "./logic";

type Ref = { scope: "platform" } | { scope: "tenant"; tenantId: string };

type SumRow = { _count: { _all: number }; _sum: { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null } };

function counts(r: SumRow) {
  return {
    requests: r._count._all,
    inputTokens: r._sum.inputTokens ?? 0,
    outputTokens: r._sum.outputTokens ?? 0,
    cacheReadTokens: r._sum.cacheReadTokens ?? 0,
    cacheWriteTokens: r._sum.cacheWriteTokens ?? 0,
  };
}

const SUM = { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true } as const;

function whereFor(ref: Ref, month: string) {
  const { from, to } = monthRangeZurich(month);
  const createdAt = { gte: from, lt: to };
  return ref.scope === "platform" ? { scope: "PLATFORM", createdAt } : { scope: "TENANT", tenantId: ref.tenantId, createdAt };
}

/** Verbrauch eines Monats nach Funktion. */
export async function usageByFeature(ref: Ref, month: string): Promise<UsageTable> {
  const rows = await db.aiUsage.groupBy({ by: ["feature", "model", "ok"], where: whereFor(ref, month), _count: { _all: true }, _sum: SUM });
  const groups: UsageGroup[] = rows.map((r) => ({ key: r.feature, model: r.model, ok: r.ok, ...counts(r) }));
  return buildUsageTable(groups, ref.scope === "platform" ? PLATFORM_FEATURES : TENANT_FEATURES);
}

/** Summen pro Monat (neuester zuerst) für die Übersicht. */
export async function usageByMonth(ref: Ref, months: readonly string[]): Promise<UsageTable> {
  const groups: UsageGroup[] = [];
  const perMonth = await Promise.all(
    months.map((m) => db.aiUsage.groupBy({ by: ["model", "ok"], where: whereFor(ref, m), _count: { _all: true }, _sum: SUM }).then((rows) => ({ m, rows }))),
  );
  for (const { m, rows } of perMonth) for (const r of rows) groups.push({ key: m, model: r.model, ok: r.ok, ...counts(r) });
  const table = buildUsageTable(groups, months);
  // Monate ohne Verbrauch als Nullzeile zeigen.
  const have = new Set(table.rows.map((r) => r.key));
  for (const m of months) if (!have.has(m)) table.rows.push({ key: m, requests: 0, failed: 0, tokens: 0, chf: 0 });
  table.rows.sort((a, b) => months.indexOf(a.key) - months.indexOf(b.key));
  return table;
}

/** Rolle → Tabellen-Schlüssel (OWNER/ADMIN/TRAINER/MEMBER/NONE). */
function roleKey(role: string | null | undefined): string {
  return role === "OWNER" || role === "ADMIN" || role === "TRAINER" || role === "MEMBER" ? role : "NONE";
}

/** Vereins-Verbrauch eines Monats nach heutiger Rolle der Benutzer (keine Namen). */
export async function tenantUsageByRole(tenantId: string, month: string): Promise<UsageTable> {
  const rows = await db.aiUsage.groupBy({ by: ["userId", "model", "ok"], where: whereFor({ scope: "tenant", tenantId }, month), _count: { _all: true }, _sum: SUM });
  const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => !!v))];
  const memberships = userIds.length
    ? await db.membership.findMany({ where: { tenantId, userId: { in: userIds } }, select: { userId: true, role: true, status: true } })
    : [];
  const roleOf = new Map(memberships.filter((m) => m.status !== "LEFT" && m.status !== "PENDING").map((m) => [m.userId, m.role]));
  const groups: UsageGroup[] = rows.map((r) => ({ key: roleKey(r.userId ? roleOf.get(r.userId) : null), model: r.model, ok: r.ok, ...counts(r) }));
  return buildUsageTable(groups, ["OWNER", "ADMIN", "TRAINER", "MEMBER", "NONE"]);
}

export type ClubUsageRow = { tenantId: string; name: string; requests: number; failed: number; tokens: number; chf: number };

/** Summen pro Verein für einen Monat (Super-Admin; Vereine nutzen eigene Schlüssel). */
export async function clubUsageTotals(month: string): Promise<{ rows: ClubUsageRow[]; total: Omit<ClubUsageRow, "tenantId" | "name"> }> {
  const { from, to } = monthRangeZurich(month);
  const rows = await db.aiUsage.groupBy({
    by: ["tenantId", "model", "ok"],
    where: { scope: "TENANT", tenantId: { not: null }, createdAt: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: SUM,
  });
  const byTenant = new Map<string, ClubUsageRow>();
  const total = { requests: 0, failed: 0, tokens: 0, chf: 0 };
  for (const r of rows) {
    if (!r.tenantId) continue;
    const c = counts(r);
    const tok = sumTokens(c);
    const chf = estimateChf(c, r.model);
    const row = byTenant.get(r.tenantId) ?? { tenantId: r.tenantId, name: "", requests: 0, failed: 0, tokens: 0, chf: 0 };
    row.requests += c.requests;
    if (!r.ok) row.failed += c.requests;
    row.tokens += tok;
    row.chf += chf;
    byTenant.set(r.tenantId, row);
    total.requests += c.requests;
    if (!r.ok) total.failed += c.requests;
    total.tokens += tok;
    total.chf += chf;
  }
  const ids = [...byTenant.keys()];
  const tenants = ids.length ? await db.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  const out = [...byTenant.values()].map((r) => ({ ...r, name: names.get(r.tenantId) ?? r.tenantId }));
  out.sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name, "de-CH"));
  return { rows: out, total };
}
