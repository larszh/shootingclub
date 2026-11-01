import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { EVENT_KINDS, kindMeta } from "@/modules/events/types";
import { getBaseUrl } from "@/modules/events/queries";
import { listChampionships, listSelectablePrograms } from "@/modules/championship/queries";
import { EmbedAdmin } from "@/modules/embed/ui/embed-admin";

export const metadata: Metadata = { title: "Website-Widgets" };

export default async function EmbedAdminPage() {
  const ctx = await requirePermission("tenant.manage");
  const tenantId = ctx.tenant.id;
  const [tenant, programs, championships, appUrl] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { embedToken: true, calendarToken: true } }),
    ctx.hasModule("scores") ? listSelectablePrograms(tenantId) : Promise.resolve([]),
    ctx.hasModule("championship") ? listChampionships(tenantId, { includeUnpublished: false }) : Promise.resolve([]),
    getBaseUrl(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Website-Widgets" subtitle="Kalender, Schiesszeiten und Ranglisten auf eurer Vereinswebsite" back={{ href: "/admin", label: "Verwaltung" }} />
      <EmbedAdmin
        initialToken={tenant?.embedToken ?? null}
        appUrl={appUrl}
        appOrigin={new URL(appUrl).origin}
        modules={{ events: ctx.hasModule("events"), scores: ctx.hasModule("scores"), championship: ctx.hasModule("championship"), range: ctx.hasModule("range") }}
        hasCalendarFeed={!!tenant?.calendarToken}
        kinds={EVENT_KINDS.map((k) => ({ key: k, label: kindMeta(k).plural }))}
        programs={programs.map((pr) => ({ id: pr.id, label: pr.name }))}
        championships={championships.map((c) => ({ id: c.id, label: `${c.name} (${c.year})` }))}
      />
      <p className="mt-6 flex gap-2 text-xs text-ink-3">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Die Widgets brauchen keine Anmeldung und setzen keine Cookies. Suchmaschinen indexieren sie nicht. Änderungen erscheinen nach spätestens 5 Minuten.
          Wer den Code kennt, sieht die Inhalte – teile ihn nur für die Website.
        </span>
      </p>
    </div>
  );
}
