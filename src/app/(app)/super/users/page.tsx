import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { userAvatarUrl } from "@/components/avatar";
import { Pager, SearchForm, pageParam, textParam } from "../../admin/audit/pager";
import { UserRow } from "./forms";

export const metadata: Metadata = { title: "Benutzer" };

const PAGE_SIZE = 40;

export default async function SuperUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireSuperAdmin();
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
        title="Benutzer"
        subtitle={q ? `${total} Treffer` : `${total} Konten`}
        back={{ href: "/super", label: "Verwaltung" }}
        action={<LinkButton href="/super/audit" variant="secondary" size="sm"><ScrollText className="h-4 w-4" /> Protokoll</LinkButton>}
      />
      <SearchForm action="/super/users" value={q} placeholder="Name, E-Mail oder Verein suchen" />
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
        {users.length === 0 ? <p className="p-4 text-sm text-ink-3">{q ? "Keine Treffer." : "Noch keine Konten."}</p> : null}
      </Card>
      <Pager base="/super/users" page={page} pageSize={PAGE_SIZE} total={total} params={{ q: q || undefined }} />
    </div>
  );
}
