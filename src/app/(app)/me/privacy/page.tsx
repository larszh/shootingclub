import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getAppContext } from "@/lib/tenant";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { soleOwnerTenants } from "@/modules/core/privacy";
import { DeleteAccountCard, ExportCard } from "./forms";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.me.row.privacy") };
}

export default async function PrivacyPage() {
  const ctx = await getAppContext();
  const blockers = await soleOwnerTenants(ctx.user.id);
  const t = getT(await getRequestLocale());

  return (
    <div>
      <PageHeader title={t("shell.me.row.privacy")} subtitle={t("shell.privacy.subtitle")} back={{ href: "/me", label: t("shell.nav.more") }} />

      <Card className="animate-rise flex items-start gap-3 p-4">
        <span className="mt-0.5 text-ok" aria-hidden><ShieldCheck className="h-6 w-6" /></span>
        <div className="min-w-0 text-sm text-ink-2">
          <p className="font-semibold text-ink">{t("shell.privacy.yours")}</p>
          <p>{t("shell.privacy.law")}</p>
        </div>
      </Card>

      <SectionTitle>{t("shell.privacy.download")}</SectionTitle>
      <ExportCard />

      <SectionTitle>{t("shell.privacy.delete")}</SectionTitle>
      <DeleteAccountCard blockers={blockers.map((b) => b.name)} />
    </div>
  );
}
