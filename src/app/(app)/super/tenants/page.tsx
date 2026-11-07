import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate as fmtDate } from "@/lib/i18n/core";
import { tenantLogoUrl } from "@/components/avatar";
import { normalizeHex } from "@/lib/brand";
import { Pager, SearchForm, pageParam, textParam } from "../../admin/audit/pager";
import { CreateTenantForm, TenantRow } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.tenants") };
}

const PAGE_SIZE = 30;
const KINDS = ["CLUB", "RANGE", "PRIVATE"];

export default async function SuperTenantsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; show?: string }> }) {
  await requireSuperAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const formatDate = (d: Date) => fmtDate(d, locale);
  const sp = await searchParams;
  const q = textParam(sp.q);
  const page = pageParam(sp.page);
  const show = sp.show === "deleted" ? "deleted" : "all";

  const where: Prisma.TenantWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { city: { contains: q } }, { joinCode: { contains: q } }] } : {}),
    ...(show === "deleted" ? { deletedAt: { not: null } } : {}),
  };
  const [total, tenants, deletedCount] = await Promise.all([
    db.tenant.count({ where }),
    db.tenant.findMany({
      where,
      select: { id: true, slug: true, name: true, kind: true, joinCode: true, logoPath: true, brandColor: true, createdAt: true, updatedAt: true, deletedAt: true, purgeAfter: true, _count: { select: { memberships: true, matches: true } } },
      orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.tenant.count({ where: { deletedAt: { not: null } } }),
  ]);

  return (
    <div>
      <PageHeader
        title={t("adm2.super.tenants")}
        subtitle={q ? t("adm2.super.t.subtitleHits", { n: total }) : t("adm2.super.t.subtitle", { n: total })}
        back={{ href: "/super", label: t("adm2.super.back") }}
        action={<LinkButton href="/super/audit" variant="secondary" size="sm"><ScrollText className="h-4 w-4" /> {t("adm2.super.u.audit")}</LinkButton>}
      />
      <SectionTitle>{t("adm2.super.t.new")}</SectionTitle>
      <CreateTenantForm />
      <SectionTitle action={deletedCount ? (
        <a href={show === "deleted" ? "/super/tenants" : "/super/tenants?show=deleted"} className="text-sm text-accent inline-flex items-center min-h-11">
          {show === "deleted" ? t("adm2.super.t.showAll") : t("adm2.super.t.marked", { n: deletedCount })}
        </a>
      ) : undefined}>{show === "deleted" ? t("adm2.super.t.markedTitle") : t("adm2.super.t.all")}</SectionTitle>
      <SearchForm action="/super/tenants" value={q} placeholder={t("adm2.super.t.search")} hidden={{ show: show === "deleted" ? "deleted" : undefined }} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {tenants.map((tn) => (
          <TenantRow
            key={tn.id}
            id={tn.id}
            name={tn.name}
            slug={tn.slug}
            logoUrl={tenantLogoUrl(tn)}
            brandColor={normalizeHex(tn.brandColor)}
            purgeAfter={tn.deletedAt ? formatDate(tn.purgeAfter ?? tn.deletedAt) : null}
            meta={t("adm2.super.t.meta", { kind: KINDS.includes(tn.kind) ? t(`adm2.super.t.kind.${tn.kind}`) : tn.kind, slug: tn.slug, members: tn._count.memberships, matches: tn._count.matches, date: formatDate(tn.createdAt), code: tn.joinCode ?? "" })}
          />
        ))}
        {tenants.length === 0 ? <p className="p-4 text-sm text-ink-3">{q ? t("adm2.super.u.noHits") : t("adm2.super.t.none")}</p> : null}
      </Card>
      <Pager base="/super/tenants" page={page} pageSize={PAGE_SIZE} total={total} params={{ q: q || undefined, show: show === "deleted" ? "deleted" : undefined }} />
    </div>
  );
}
