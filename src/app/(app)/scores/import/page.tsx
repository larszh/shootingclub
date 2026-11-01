import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { todayZurich, formatDateTimeZurich, formatDateZurich } from "@/lib/time";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { listPrograms, listTenantMembers } from "@/modules/scores/queries";
import { listScoreImports } from "@/modules/scores/import/queries";
import { SCORE_PRESETS } from "@/modules/scores/import/parse";
import { ScoreImportWizard } from "./wizard";

export const metadata: Metadata = { title: "Resultate importieren" };

const FORMAT_LABEL: Record<string, string> = Object.fromEntries(Object.values(SCORE_PRESETS).map((p) => [p.format, p.label]));

export default async function ScoreImportPage() {
  const ctx = await requireModule("scores");
  // Schreibt Resultate anderer Mitglieder: nur Trainer und Vorstand
  if (!ctx.can("match.viewAll") && !ctx.can("tenant.programs.manage")) redirect("/?denied=1");
  const [programs, members, history] = await Promise.all([listPrograms(ctx), listTenantMembers(ctx.tenant.id), listScoreImports(ctx.tenant.id)]);

  return (
    <div>
      <PageHeader title="Resultate importieren" subtitle="Aus elektronischen Trefferanzeigen (Meyton, SIUS, ShotMarker) oder CSV" back={{ href: "/scores", label: "Schiessen" }} />
      <ScoreImportWizard
        programs={programs.map((p) => ({ id: p.id, name: p.name, scoringMode: p.scoringMode, stages: p.stages, max: p.totals.max, scope: p.scope }))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        today={todayZurich()}
      />

      <SectionTitle>Bisherige Importe</SectionTitle>
      {history.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 px-4 py-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{h.fileName}</div>
                <div className="truncate text-xs text-ink-3">
                  {[FORMAT_LABEL[h.format] ?? h.format, formatDateTimeZurich(h.createdAt), h.createdByName, `${h.rows} Zeilen`].filter(Boolean).join(" · ")}
                </div>
                {h.matches.length ? (
                  <div className="mt-1 flex flex-wrap gap-x-3">
                    {h.matches.map((m) => (
                      <Link key={m.id} href={`/scores/matches/${m.id}`} className="inline-flex min-h-11 items-center text-sm text-accent underline-offset-2 hover:underline">
                        {m.title ?? "Durchgang"} · {formatDateZurich(m.date, { weekday: undefined })} · {m.participants} Teilnehmende
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-3">Durchgang gelöscht</p>
                )}
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="Noch keine Importe" text="Importierte Dateien erscheinen hier mit Link zum Durchgang." />
      )}
    </div>
  );
}
