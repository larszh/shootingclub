import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { getAmmoSettings } from "@/modules/ammo/queries";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { AmmoSettingsForm } from "@/modules/ammo/ui/settings-form";
import { Alert, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.meta.settings") };
}

export default async function AmmoSettingsPage() {
  const ctx = await requireAmmoAdmin();
  const t = getT(await getRequestLocale());
  const settings = await getAmmoSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title={t("adm1.common.settings")} subtitle={t("adm1.ammo.settings.subtitle")} back={{ href: "/admin/ammo", label: t("adm1.ammo.title") }} />
      <AdminAmmoTabs />
      <Alert tone="info" icon={<Info className="h-4 w-4" />} className="mb-4">
        {t("money.ammo.legal")} {t("adm1.ammo.settings.profilePrefix")} <Link href="/admin/billing/settings" className="font-medium underline">{t("adm1.ammo.settings.profileLink")}</Link>{t("adm1.ammo.settings.profileSuffix")}
      </Alert>
      <AmmoSettingsForm settings={settings} />
    </div>
  );
}
