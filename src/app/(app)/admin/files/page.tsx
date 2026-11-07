import type { Metadata } from "next";
import { Files, FolderOpen, HardDrive } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Card, PageHeader, ProgressBar, SectionTitle, StatCard } from "@/components/ui";
import { HARD_MAX_FILE_MB, loadStorageSettings, isStorageProvider } from "@/lib/file-storage";
import { getStorageStats } from "@/modules/files/queries";
import { formatBytes, MB } from "@/modules/files/types";
import { StorageSettingsForm, type StorageChoice } from "@/modules/files/ui/storage-settings-form";
import { getRequestLocale, getT, INTL_LOCALE } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.files.manage") };
}

export default async function AdminFilesPage() {
  const ctx = await requirePermission("tenant.manage");
  const tenantId = ctx.tenant.id;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const num = (n: number) => n.toLocaleString(INTL_LOCALE[locale]);
  const [settings, stats] = await Promise.all([loadStorageSettings(tenantId), getStorageStats(tenantId)]);
  const s3 = settings.credentials.s3;
  const dav = settings.credentials.webdav;

  const activeChoice: StorageChoice =
    settings.provider === "S3" ? (s3?.variant === "HETZNER" ? "S3_HETZNER" : s3?.variant === "COMPAT" ? "S3_COMPAT" : "S3_AWS") : settings.provider === "WEBDAV" ? "WEBDAV" : "LOCAL";
  const count = (p: string) => stats.byProvider.find((r) => r.provider === p)?.count ?? 0;
  const quotaBytes = settings.quotaMb != null ? settings.quotaMb * MB : null;

  return (
    <div>
      <PageHeader title={t("adm1.files.title")} subtitle={t("adm1.files.subtitle")} back={{ href: "/admin", label: t("adm1.common.settings") }} />

      <SectionTitle>{t("adm1.files.usage")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard label={t("adm1.files.files")} value={num(stats.total.count)} icon={<Files className="h-4 w-4" />} />
        <StatCard label={t("adm1.files.used")} value={formatBytes(stats.total.bytes)} hint={quotaBytes ? t("adm1.files.ofQuota", { quota: formatBytes(quotaBytes) }) : t("adm1.files.noQuota")} icon={<HardDrive className="h-4 w-4" />} />
        <StatCard label={t("adm1.files.folders")} value={num(stats.folders)} icon={<FolderOpen className="h-4 w-4" />} className="col-span-2 sm:col-span-1" />
      </div>
      {quotaBytes ? (
        <Card className="mt-2.5 p-4">
          <ProgressBar value={stats.total.bytes} max={quotaBytes} label={t("adm1.files.quotaUsed")} showValue tone={stats.total.bytes / quotaBytes >= 0.9 ? "warn" : "accent"} />
        </Card>
      ) : null}
      {stats.byProvider.length || stats.byContext.length ? (
        <Card className="mt-2.5 divide-y divide-line text-sm">
          {stats.byProvider.map((r) => (
            <div key={r.provider} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{isStorageProvider(r.provider) ? t(`adm1.files.provider.${r.provider}`) : r.provider}</span>
              <span className="tabular-nums text-ink-3">{r.count} · {formatBytes(r.bytes)}</span>
            </div>
          ))}
          {stats.byContext.map((r) => (
            <div key={r.context} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{r.context === "CHAT" ? t("adm1.files.ofChat") : t("adm1.files.ofFiles")}</span>
              <span className="tabular-nums text-ink-3">{r.count} · {formatBytes(r.bytes)}</span>
            </div>
          ))}
        </Card>
      ) : null}

      <SectionTitle>{t("adm1.files.storage")}</SectionTitle>
      <Card className="mb-4 p-4 text-sm text-ink-2">
        <p>{t("adm1.files.storageText")}</p>
        <p className="mt-2">{t("adm1.files.storageSwitch")}</p>
      </Card>
      <StorageSettingsForm
        activeChoice={activeChoice}
        quotaMb={settings.quotaMb}
        maxFileMb={settings.maxFileMb}
        hardMaxFileMb={HARD_MAX_FILE_MB}
        credentialsBroken={settings.credentialsBroken}
        s3={s3 ? { variant: s3.variant, endpoint: s3.endpoint ?? "", region: s3.region, bucket: s3.bucket, accessKeyId: s3.accessKeyId, forcePathStyle: s3.forcePathStyle, prefix: (s3.prefix ?? "").replace(/\/$/, ""), hasSecret: !!s3.secretAccessKey } : null}
        webdav={dav ? { url: dav.url, username: dav.username, hasPassword: !!dav.password } : null}
        fileCounts={{ S3: count("S3"), WEBDAV: count("WEBDAV") }}
      />
    </div>
  );
}
