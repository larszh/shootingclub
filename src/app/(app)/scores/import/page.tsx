import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { formatDate, formatDateTime } from "@/lib/i18n/core";
import { getRequestLocale, getT } from "@/lib/i18n";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { listPrograms, listTenantMembers } from "@/modules/scores/queries";
import { listScoreImports } from "@/modules/scores/import/queries";
import { SCORE_PRESETS, SCORE_PRESET_IDS } from "@/modules/scores/import/parse";
import { getImportAssistState } from "@/modules/ai/coach/service";
import { ScoreImportWizard } from "./wizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("aicoach.imp.title") };
}

export default async function ScoreImportPage() {
  const ctx = await requireModule("scores");
  // Schreibt Resultate anderer Mitglieder: nur Trainer und Vorstand
  if (!ctx.can("match.viewAll") && !ctx.can("tenant.programs.manage")) redirect("/?denied=1");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [programs, members, history, ai] = await Promise.all([
    listPrograms(ctx),
    listTenantMembers(ctx.tenant.id),
    listScoreImports(ctx.tenant.id),
    getImportAssistState(ctx),
  ]);
  const formatLabel: Record<string, string> = Object.fromEntries(SCORE_PRESET_IDS.map((id) => [SCORE_PRESETS[id].format, t(`aicoach.imp.preset.${id}.label`)]));

  return (
    <div>
      <PageHeader title={t("aicoach.imp.title")} subtitle={t("aicoach.imp.subtitle")} back={{ href: "/scores", label: t("aicoach.imp.back") }} />
      <ScoreImportWizard
        programs={programs.map((p) => ({ id: p.id, name: p.name, scoringMode: p.scoringMode, stages: p.stages, max: p.totals.max, scope: p.scope }))}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        today={todayZurich()}
        ai={ai}
      />

      <SectionTitle>{t("aicoach.imp.history")}</SectionTitle>
      {history.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 px-4 py-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{h.fileName}</div>
                <div className="truncate text-xs text-ink-3">
                  {[formatLabel[h.format] ?? h.format, formatDateTime(h.createdAt, locale), h.createdByName, t("aicoach.imp.historyRows", { n: h.rows })].filter(Boolean).join(" · ")}
                </div>
                {h.matches.length ? (
                  <div className="mt-1 flex flex-wrap gap-x-3">
                    {h.matches.map((m) => (
                      <Link key={m.id} href={`/scores/matches/${m.id}`} className="inline-flex min-h-11 items-center text-sm text-accent underline-offset-2 hover:underline">
                        {m.title ?? t("aicoach.imp.match")} · {formatDate(m.date, locale)} · {t("aicoach.imp.participants", { n: m.participants })}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-3">{t("aicoach.imp.matchDeleted")}</p>
                )}
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={t("aicoach.imp.noHistory")} text={t("aicoach.imp.noHistoryText")} />
      )}
    </div>
  );
}
