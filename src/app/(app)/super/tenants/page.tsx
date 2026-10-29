import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { tenantLogoUrl } from "@/components/avatar";
import { normalizeHex } from "@/lib/brand";
import { Pager, SearchForm, pageParam, textParam } from "../../admin/audit/pager";
import { CreateTenantForm, TenantRow } from "./forms";

export const metadata: Metadata = { title: "Tenants" };

const PAGE_SIZE = 30;
const KIND_LABEL: Record<string, string> = { CLUB: "Verein", RANGE: "Anlage", PRIVATE: "Privat" };

export default async function SuperTenantsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; show?: string }> }) {
  await requireSuperAdmin();
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
        title="Tenants"
        subtitle={`${total} ${q ? "Treffer" : "Vereine, Anlagen und Gruppen"}`}
        back={{ href: "/super", label: "Verwaltung" }}
        action={<LinkButton href="/super/audit" variant="secondary" size="sm"><ScrollText className="h-4 w-4" /> Protokoll</LinkButton>}
      />
      <SectionTitle>Neu</SectionTitle>
      <CreateTenantForm />
      <SectionTitle action={deletedCount ? (
        <a href={show === "deleted" ? "/super/tenants" : "/super/tenants?show=deleted"} className="text-sm text-accent inline-flex items-center min-h-11">
          {show === "deleted" ? "Alle zeigen" : `Zur Löschung vorgemerkt (${deletedCount})`}
        </a>
      ) : undefined}>{show === "deleted" ? "Zur Löschung vorgemerkt" : "Alle"}</SectionTitle>
      <SearchForm action="/super/tenants" value={q} placeholder="Name, Kürzel, Ort oder Code suchen" hidden={{ show: show === "deleted" ? "deleted" : undefined }} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {tenants.map((t) => (
          <TenantRow
            key={t.id}
            id={t.id}
            name={t.name}
            slug={t.slug}
            logoUrl={tenantLogoUrl(t)}
            brandColor={normalizeHex(t.brandColor)}
            purgeAfter={t.deletedAt ? formatDate(t.purgeAfter ?? t.deletedAt) : null}
            meta={`${KIND_LABEL[t.kind] ?? t.kind} · ${t.slug} · ${t._count.memberships} Mitglieder · ${t._count.matches} Durchgänge · seit ${formatDate(t.createdAt)} · Code ${t.joinCode}`}
          />
        ))}
        {tenants.length === 0 ? <p className="p-4 text-sm text-ink-3">{q ? "Keine Treffer." : "Noch keine Tenants."}</p> : null}
      </Card>
      <Pager base="/super/tenants" page={page} pageSize={PAGE_SIZE} total={total} params={{ q: q || undefined, show: show === "deleted" ? "deleted" : undefined }} />
    </div>
  );
}
