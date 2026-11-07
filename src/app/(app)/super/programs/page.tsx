import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { listGlobalPrograms } from "@/modules/scores/queries";
import { disciplineLabel, formatDistances } from "@/modules/scores/types";
import { officialKindText, tOr } from "@/modules/scores/ui/labels";
import { getRequestLocale, getT } from "@/lib/i18n";
import { ProgramArchiveButton } from "@/modules/scores/ui/admin-controls";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.programs") };
}

export default async function SuperProgramsPage() {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const programs = await listGlobalPrograms();
  return (
    <div>
      <PageHeader title={t("adm2.super.programs")} subtitle={t("adm2.super.p.subtitle")} back={{ href: "/super", label: t("adm2.super.back") }} action={<LinkButton href="/super/programs/new" size="sm"><Plus className="h-4 w-4" /> {t("adm2.super.p.new")}</LinkButton>} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {programs.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/super/programs/${p.id}/edit`} className="font-medium hover:underline">{p.name}</Link>
              <div className="text-xs text-ink-3">{tOr(t, `shooting.discipline.${p.discipline}`, disciplineLabel(p.discipline))} · {formatDistances(p.totals.distances)} · {t("adm2.super.p.shots", { n: p.totals.shots })}{p.isArchived ? t("adm2.super.p.archivedSuffix") : ""}</div>
            </div>
            {p.officialKind ? <Badge tone="accent">{officialKindText(t, p.officialKind)}</Badge> : null}
            {p.isArchived ? <Badge tone="warn">{t("adm2.super.p.archive")}</Badge> : null}
            <ProgramArchiveButton programId={p.id} archived={p.isArchived} />
          </div>
        ))}
      </Card>
    </div>
  );
}
