import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Alert, Card, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { loadStorageSettings } from "@/lib/file-storage";
import { getFilesView } from "@/modules/files/queries";
import { tenantStorageUsage } from "@/modules/files/service";
import { formatBytes, MB } from "@/modules/files/types";
import { FileBrowser, type BrowserFile } from "@/modules/files/ui/file-browser";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.files.title") };
}

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ folder?: string | string[]; q?: string | string[] }> }) {
  const ctx = await requireModule("files");
  const sp = await searchParams;
  const folderId = typeof sp.folder === "string" && sp.folder ? sp.folder : null;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tenantId = ctx.tenant.id;
  const locale = await getRequestLocale();
  const t = getT(locale);

  const [view, settings, usage] = await Promise.all([
    getFilesView({ tenantId, role: ctx.tenant.role, isSuperAdmin: ctx.user.isSuperAdmin, folderId, q, locale }),
    loadStorageSettings(tenantId),
    tenantStorageUsage(tenantId),
  ]);

  const canManage = ctx.can("files.manage");
  const canUpload = ctx.can("files.upload");
  const isAdmin = ctx.can("tenant.manage");
  const files: BrowserFile[] = view.files.map((f) => ({ ...f, canEdit: canManage || (canUpload && f.uploadedById === ctx.user.id) }));
  const quotaBytes = settings.quotaMb != null ? settings.quotaMb * MB : null;
  const remainingBytes = quotaBytes != null ? Math.max(0, quotaBytes - usage.bytes) : null;
  const pct = quotaBytes ? (usage.bytes / quotaBytes) * 100 : 0;

  return (
    <div>
      <PageHeader
        title={view.current ? view.current.name : t("shell.files.title")}
        subtitle={view.current ? t("shell.files.title") : t("shell.files.subtitle", { club: ctx.tenant.name })}
        back={view.current ? { href: view.current.parentId ? `/files?folder=${encodeURIComponent(view.current.parentId)}` : "/files", label: view.current.path.length > 1 ? view.current.path[view.current.path.length - 2]!.name : t("shell.files.title") } : undefined}
        action={isAdmin ? <LinkButton href="/admin/files" variant="secondary" size="sm" aria-label={t("shell.files.manageStorage")}><Settings className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{t("shell.files.storage")}</span></LinkButton> : null}
      />

      {view.folderMissing ? <Alert tone="warn" className="mb-4">{t("shell.files.folderMissing")}</Alert> : null}

      {quotaBytes != null && (canUpload || isAdmin) ? (
        <Card className="animate-rise mb-4 p-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{t("shell.files.space")}</span>
            <span className="tabular-nums text-ink-3">{t("shell.files.spaceOf", { used: formatBytes(usage.bytes), total: formatBytes(quotaBytes) })}</span>
          </div>
          <ProgressBar value={usage.bytes} max={quotaBytes} label={t("shell.files.spaceUsed")} tone={pct >= 90 ? "warn" : "accent"} />
          {pct >= 90 ? <p className="mt-1.5 text-xs text-warn">{t("shell.files.almostFull")}</p> : null}
        </Card>
      ) : null}

      <FileBrowser
        tenantId={tenantId}
        current={view.current}
        subfolders={view.subfolders}
        files={files}
        moveTargets={view.moveTargets}
        canUpload={canUpload}
        canManage={canManage}
        maxFileMb={settings.maxFileMb}
        remainingBytes={remainingBytes}
        q={view.q}
        locale={locale}
      />
    </div>
  );
}
