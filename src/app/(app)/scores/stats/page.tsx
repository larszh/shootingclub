import type { Metadata } from "next";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { userStats } from "@/modules/scores/queries";
import { formatScore } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistik" };

export default async function StatsPage() {
  const ctx = await requireModule("scores");
  const stats = await userStats(ctx);
  return (
    <div>
      <PageHeader title="Meine Statistik" subtitle={ctx.tenant.name} back={{ href: "/scores", label: "Schiessen" }} />
      <div className="stagger grid grid-cols-2 gap-2.5">
        <Card className="p-4"><div className="text-3xl font-semibold tabular-nums">{stats.matches}</div><div className="text-xs text-ink-3">Durchgänge</div></Card>
        <Card className="p-4"><div className="text-3xl font-semibold tabular-nums">{stats.totalShots}</div><div className="text-xs text-ink-3">Schüsse erfasst</div></Card>
      </div>
      <SectionTitle>Bestleistung pro Programm</SectionTitle>
      {stats.byProgram.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {stats.byProgram.map((p) => {
            const pct = p.max ? Math.round((p.best / p.max) * 100) : 0;
            return (
              <div key={p.name} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="font-medium truncate">{p.name}</div><div className="text-xs text-ink-3">{p.count}× geschossen · zuletzt {formatScore(p.last, p.decimal)}</div></div>
                  <div className="text-right"><div className="text-lg font-semibold tabular-nums">{formatScore(p.best, p.decimal)}</div><div className="text-[11px] text-ink-3">von {p.max}</div></div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </Card>
      ) : (
        <EmptyState title="Noch keine Resultate" text="Sobald du Durchgänge erfasst, erscheinen hier deine Bestleistungen." />
      )}
    </div>
  );
}
