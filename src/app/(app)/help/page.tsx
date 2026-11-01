import type { Metadata } from "next";
import { getAppContext } from "@/lib/tenant";
import type { Permission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { Faq } from "./faq";
import { toEntry, type FaqSource } from "./faq-types";
import { MEMBER_FAQ } from "./faq-member";
import { ADMIN_FAQ } from "./faq-admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.common.help") };
}

/** Alle Fragen in Anzeige-Reihenfolge (die Ansicht gruppiert nach Zielgruppe). */
const SOURCES: FaqSource[] = [...MEMBER_FAQ, ...ADMIN_FAQ];

/**
 * Anleitungen für Funktionen, die schon unterhalb der Admin-Rolle erlaubt sind (z.B. Trainer/Schützenmeister).
 * Wer die Berechtigung hat, sieht die Anleitung auch ohne «tenant.manage».
 */
const ENTRY_PERMISSION: Partial<Record<string, Permission>> = {
  "amtlich-bestaetigen": "results.verify",
  standbuch: "range.duty",
  vereinswaffen: "weapons.loan",
  "kurse-admin": "courses.manage",
  "live-rangliste": "match.viewAll",
  "resultat-import": "match.viewAll",
  "schuetzenstube-theke": "kiosk.sell",
  "schuetzenstube-admin": "kiosk.manage",
  buchhaltung: "accounting.export",
};

export default async function HelpPage() {
  const ctx = await getAppContext();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const isAdmin = ctx.tenant ? ctx.can("tenant.manage") : ctx.user.isSuperAdmin;
  const entries = SOURCES.filter((e) => {
    if (e.audience === "member" || isAdmin) return true;
    const perm = ENTRY_PERMISSION[e.id];
    return !!perm && ctx.can(perm);
  }).map((e) => toEntry(e, locale));
  const showAudienceFilter = entries.some((e) => e.audience === "admin");

  return (
    <div>
      <PageHeader title={t("shell.common.help")} subtitle={t("shell.help.subtitle")} back={{ href: "/me", label: t("shell.nav.more") }} />
      <Faq entries={entries} isAdmin={showAudienceFilter} />
      <p className="mt-8 text-center text-sm text-ink-3">
        {ctx.tenant ? t("shell.help.askAdminOf", { club: ctx.tenant.name }) : t("shell.help.askAdmin")}
      </p>
    </div>
  );
}
