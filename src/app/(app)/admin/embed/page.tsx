import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requirePermission } from "@/lib/tenant";
import { EVENT_KINDS } from "@/modules/events/types";
import { kindLabel } from "@/modules/events/ui/i18n";
import { getBaseUrl } from "@/modules/events/queries";
import { listChampionships, listSelectablePrograms } from "@/modules/championship/queries";
import { EmbedAdmin } from "@/modules/embed/ui/embed-admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.embed.title") };
}

export default async function EmbedAdminPage() {
  const ctx = await requirePermission("tenant.manage");
  const tenantId = ctx.tenant.id;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const [tenant, programs, championships, appUrl] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { embedToken: true, calendarToken: true } }),
    ctx.hasModule("scores") ? listSelectablePrograms(tenantId) : Promise.resolve([]),
    ctx.hasModule("championship") ? listChampionships(tenantId, { includeUnpublished: false }) : Promise.resolve([]),
    getBaseUrl(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("adm2.embed.title")} subtitle={t("adm2.embed.subtitle")} back={{ href: "/admin", label: t("adm2.embed.back") }} />
      <EmbedAdmin
        initialToken={tenant?.embedToken ?? null}
        appUrl={appUrl}
        appOrigin={new URL(appUrl).origin}
        modules={{ events: ctx.hasModule("events"), scores: ctx.hasModule("scores"), championship: ctx.hasModule("championship"), range: ctx.hasModule("range") }}
        hasCalendarFeed={!!tenant?.calendarToken}
        kinds={EVENT_KINDS.map((k) => ({ key: k, label: kindLabel(k, locale, true) }))}
        programs={programs.map((pr) => ({ id: pr.id, label: pr.name }))}
        championships={championships.map((c) => ({ id: c.id, label: `${c.name} (${c.year})` }))}
      />
      <p className="mt-6 flex gap-2 text-xs text-ink-3">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {t("adm2.embed.footer1")} {t("adm2.embed.footer2")}
        </span>
      </p>
    </div>
  );
}
