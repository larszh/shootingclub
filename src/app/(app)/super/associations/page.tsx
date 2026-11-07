import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Landmark } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { getRequestLocale, getT } from "@/lib/i18n";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { listAllAssociations } from "@/modules/association/queries";
import { CreateAssociationForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.associations") };
}

export default async function SuperAssociationsPage() {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const associations = await listAllAssociations();
  return (
    <div>
      <PageHeader title={t("adm2.super.associations")} subtitle={t("adm2.super.as.subtitle")} back={{ href: "/super", label: t("adm2.super.back") }} />
      <SectionTitle>{t("adm2.super.t.new")}</SectionTitle>
      <CreateAssociationForm />
      <SectionTitle>{t("adm2.super.t.all")}</SectionTitle>
      {associations.length === 0 ? (
        <EmptyState icon={<Landmark className="h-6 w-6" />} title={t("adm2.super.as.none")} text={t("adm2.super.as.noneText")} />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {associations.map((a) => (
            <Link key={a.id} href={`/super/associations/${a.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
              <Landmark className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  {a.name}
                  {a.deletedAt ? <Badge tone="danger">{t("adm2.super.u.deleted")}</Badge> : null}
                </div>
                <div className="text-xs text-ink-3 truncate">
                  {a.region ? `${a.region} · ` : ""}{t("adm2.super.as.code")} <span className="font-mono">{a.code}</span> · {t(a._count.members === 1 ? "adm2.super.as.clubs.one" : "adm2.super.as.clubs.other", { n: a._count.members })} · {t(a._count.admins === 1 ? "adm2.super.as.access.one" : "adm2.super.as.access.other", { n: a._count.admins })}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
