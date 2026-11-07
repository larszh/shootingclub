import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { listGlobalTargets } from "@/modules/targets/queries";
import { targetSubjectText } from "@/modules/scores/ui/labels";
import { localizeTarget } from "@/modules/targets/target-i18n";
import { TargetPreview } from "@/modules/targets/ui/target-preview";
import { TargetDeleteButton } from "@/modules/targets/ui/target-controls";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.targets") };
}

export default async function SuperTargetsPage() {
  const me = await requireSuperAdmin();
  const locale = await getRequestLocale();
  const tr = getT(locale);
  const targets = await listGlobalTargets(me.id);
  return (
    <div>
      <PageHeader title={tr("adm2.super.targets")} subtitle={tr("adm2.super.tg.subtitle")} back={{ href: "/super", label: tr("adm2.super.back") }} action={<LinkButton href="/super/targets/new" size="sm"><Plus className="h-4 w-4" /> {tr("adm2.super.p.new")}</LinkButton>} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {targets.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="h-14 w-10 rounded border border-line overflow-hidden bg-white shrink-0"><TargetPreview target={t} size="A6" locale={locale} className="h-full w-full" /></div>
            <div className="min-w-0 flex-1"><Link href={`/super/targets/${t.id}/edit`} className="font-medium hover:underline">{localizeTarget(t, locale).name}</Link><div className="text-xs text-ink-3">{targetSubjectText(tr, t.subject)} · {t.paperSizes.join(", ")}</div></div>
            <TargetDeleteButton targetId={t.id} redirectTo="/super/targets" />
          </div>
        ))}
      </Card>
    </div>
  );
}
