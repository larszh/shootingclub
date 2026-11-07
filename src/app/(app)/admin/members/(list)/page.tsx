import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { db } from "@/lib/db";
import { LinkButton, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getRequestLocale, getT } from "@/lib/i18n";
import { listMembers, memberFilterOptions } from "@/modules/members/queries";
import { filtersToQuery, parseMemberFilters } from "@/modules/members/types";
import { MembersNav } from "../nav";
import { MemberFilterBar } from "./filters";
import { MemberList } from "./member-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.members.title") };
}

export default async function MembersAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("members.view");
  const canManage = ctx.can("members.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const filters = parseMemberFilters(await searchParams);
  const [list, options, openInvites, householdCount] = await Promise.all([
    listMembers(ctx.tenant.id, filters),
    memberFilterOptions(ctx.tenant.id),
    canManage ? db.invitation.count({ where: { tenantId: ctx.tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } } }) : Promise.resolve(0),
    canManage ? db.household.count({ where: { tenantId: ctx.tenant.id } }) : Promise.resolve(0),
  ]);
  const activeCount = Object.entries(options.statusCounts).reduce((s, [k, n]) => (k === "LEFT" || k === "PENDING" ? s : s + n), 0);
  const query = filtersToQuery({ ...filters, page: 1 });
  const pageHref = (p: number) => `/admin/members${filtersToQuery({ ...filters, page: p })}`;

  return (
    <div>
      <PageHeader
        title={t("adm1.members.title")}
        subtitle={t(activeCount === 1 ? "adm1.members.subtitle.one" : "adm1.members.subtitle.other", { n: activeCount, club: ctx.tenant.name })}
        back={ctx.can("tenant.manage") ? { href: "/admin", label: t("adm1.home.title") } : { href: "/me", label: t("adm1.home.more") }}
        action={canManage ? <LinkButton href="/admin/members/invitations" size="sm"><UserPlus className="h-4 w-4" /> {t("adm1.home.inviteTile")}</LinkButton> : undefined}
      />
      <MembersNav active="list" canApprove={ctx.can("members.approve")} tenantId={ctx.tenant.id} canManage={canManage} counts={{ invitations: openInvites, households: householdCount }} />

      <MemberFilterBar
        locale={locale}
        filters={filters}
        categories={options.categories.map((c) => ({ id: c.id, name: c.name }))}
        households={options.households}
        statusCounts={options.statusCounts}
      />

      <MemberList
        locale={locale}
        key={query}
        rows={list.items}
        total={list.total}
        query={query}
        canManage={canManage}
        categories={options.categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      {list.pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t("adm1.pager.label")}>
          <PageLink href={pageHref(list.page - 1)} disabled={list.page <= 1} label={t("adm1.pager.prevLabel")}><ChevronLeft className="h-4 w-4" /> {t("adm1.pager.prev")}</PageLink>
          <span className="text-sm text-ink-3 tabular-nums">{t("adm1.pager.pageOf", { page: list.page, pages: list.pages })}</span>
          <PageLink href={pageHref(list.page + 1)} disabled={list.page >= list.pages} label={t("adm1.pager.nextLabel")}>{t("adm1.pager.next")} <ChevronRight className="h-4 w-4" /></PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex h-11 items-center gap-1 rounded-control border border-line bg-surface px-4 text-sm font-medium";
  if (disabled) return <span className={cn(cls, "opacity-40")} aria-disabled>{children}</span>;
  return <Link href={href} className={cn(cls, "press hover:bg-surface-2")} aria-label={label}>{children}</Link>;
}
