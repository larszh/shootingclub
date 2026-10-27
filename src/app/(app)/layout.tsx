import { getAppContext } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  return (
    <AppShell enabledModules={ctx.tenant?.enabledModules ?? []} tenantName={ctx.tenant?.name ?? null} userInitials={initials(ctx.user.name)}>
      {children}
    </AppShell>
  );
}
