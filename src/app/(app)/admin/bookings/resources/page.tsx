import Link from "next/link";
import { Handshake, Pencil, Plus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { listBlocks, listResources } from "@/modules/bookings/queries";
import { shareCountsByResource } from "@/modules/sharing/queries";
import { resourceKindLabelT } from "@/modules/bookings/i18n";
import { BlockForm, DeleteBlockButton, ResourceRowActions } from "@/modules/bookings/ui/block-form";
import { todayZurich } from "@/lib/time";
import { formatDateTime, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bk.resources") };
}

export default async function ResourcesPage() {
  const ctx = await requirePermission("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [resources, blocks, shareCounts] = await Promise.all([listResources(ctx.tenant.id, { includeInactive: true }), listBlocks(ctx.tenant.id), shareCountsByResource(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title={t("adm1.bk.resources")} subtitle={t("adm1.bk.resourcesSubtitle")} back={{ href: "/admin/bookings", label: t("adm1.bk.title") }}
        action={<LinkButton href="/admin/bookings/resources/new" size="sm"><Plus className="h-4 w-4" /> {t("adm1.bk.new")}</LinkButton>} />
      <AdminBookingTabs />
      {resources.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/admin/bookings/resources/${r.id}`} className="min-w-0 flex-1 hover:underline-offset-2">
                <div className="font-medium flex flex-wrap items-center gap-2">{r.name}{!r.isActive ? <Badge tone="warn">{t("adm1.bk.inactive")}</Badge> : null}{r.durationOptions ? <Badge tone="outline">{t("adm1.bk.ownPrices")}</Badge> : null}{shareCounts[r.id] ? <Badge tone="outline"><Handshake className="mr-1 h-3 w-3" aria-hidden />{t(shareCounts[r.id] === 1 ? "adm1.bk.partners.one" : "adm1.bk.partners.other", { n: shareCounts[r.id]! })}</Badge> : null}</div>
                <div className="text-xs text-ink-3">{resourceKindLabelT(r.kind, t)} · {t(r.capacity === 1 ? "bookings.places.one" : "bookings.places.many", { count: r.capacity })}{r.maxPersons ? ` · ${t("adm1.bk.maxPersons", { n: r.maxPersons })}` : ""}{r.description ? ` · ${r.description}` : ""} · <span className="text-ink-2">{t("adm1.bk.share")}</span></div>
              </Link>
              <Link href={`/admin/bookings/resources/${r.id}/edit`} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:bg-surface-2" aria-label={t("adm1.common.edit")}><Pencil className="h-4 w-4" /></Link>
              <ResourceRowActions id={r.id} isActive={r.isActive} />
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title={t("adm1.bk.noResources")} text={t("adm1.bk.noResourcesExample")} action={<LinkButton href="/admin/bookings/resources/new" size="sm">{t("adm1.bk.createResource")}</LinkButton>} />
      )}

      <SectionTitle>{t("adm1.bk.blocks")}</SectionTitle>
      <BlockForm resources={resources.map((r) => ({ id: r.id, name: r.name }))} today={todayZurich()} />
      {blocks.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden mt-2.5">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="font-medium">{b.resource?.name ?? t("adm1.bk.allResources")}{b.reason ? <span className="text-ink-3 font-normal"> · {b.reason}</span> : null}</div><div className="text-xs text-ink-3">{t("adm1.bk.fromTo", { from: formatDateTime(b.startsAt, locale), to: formatDateTime(b.endsAt, locale) })}</div></div>
              <DeleteBlockButton id={b.id} />
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
