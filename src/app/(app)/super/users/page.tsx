import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { userAvatarUrl } from "@/components/avatar";
import { Pager, SearchForm, pageParam, textParam } from "../../admin/audit/pager";
import { UserRow } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.users") };
}

const PAGE_SIZE = 40;

export default async function SuperUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const sp = await searchParams;
  const q = textParam(sp.q);
  const page = pageParam(sp.page);
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { memberships: { some: { tenant: { name: { contains: q } } } } }] }
    : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: { id: true, name: true, email: true, isSuperAdmin: true, avatarPath: true, updatedAt: true, deletedAt: true, totpEnabledAt: true, memberships: { select: { tenant: { select: { name: true } } }, take: 6 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return (
    <div>
      <PageHeader
        title={t("adm2.super.users")}
        subtitle={q ? t("adm2.super.u.hits", { n: total }) : t("adm2.super.u.accounts", { n: total })}
        back={{ href: "/super", label: t("adm2.super.back") }}
        action={<LinkButton href="/super/audit" variant="secondary" size="sm"><ScrollText className="h-4 w-4" /> {t("adm2.super.u.audit")}</LinkButton>}
      />
      <SearchForm action="/super/users" value={q} placeholder={t("adm2.super.u.search")} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {users.map((u) => (
          <UserRow
            key={u.id}
            id={u.id}
            name={u.name}
            email={u.email}
            isSuperAdmin={u.isSuperAdmin}
            isSelf={u.id === me.id}
            deleted={!!u.deletedAt}
            twoFactor={!!u.totpEnabledAt}
            tenants={u.memberships.map((m) => m.tenant.name)}
            avatarUrl={userAvatarUrl(u)}
          />
        ))}
        {users.length === 0 ? <p className="p-4 text-sm text-ink-3">{q ? t("adm2.super.u.noHits") : t("adm2.super.u.none")}</p> : null}
      </Card>
      <Pager base="/super/users" page={page} pageSize={PAGE_SIZE} total={total} params={{ q: q || undefined }} />
    </div>
  );
}
