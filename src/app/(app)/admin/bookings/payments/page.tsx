import { requirePermission } from "@/lib/tenant";
import { Card, PageHeader } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { listProviderConfigs } from "@/modules/bookings/queries";
import { PAYMENT_PROVIDERS } from "@/modules/bookings/types";
import { ProviderForm } from "@/modules/bookings/ui/provider-form";

export const metadata = { title: "Zahlungsanbieter" };

export default async function PaymentProvidersPage() {
  const ctx = await requirePermission("tenant.manage");
  const configs = await listProviderConfigs(ctx.tenant.id);
  const appUrl = (process.env.APP_URL ?? "https://standchef.ch").replace(/\/$/, "");
  return (
    <div>
      <PageHeader title="Zahlungsanbieter" subtitle="Jeder Verein nutzt sein eigenes Konto. Zugangsdaten werden verschlüsselt gespeichert." back={{ href: "/admin/bookings", label: "Reservationen" }} />
      <AdminBookingTabs />
      <Card className="animate-rise p-4 mb-4 text-sm text-ink-2">
        <p>Das Geld fliesst direkt auf das Konto des Vereins beim jeweiligen Anbieter. Standchef speichert nur die Zugangsdaten für die Zahlungsseite. Nach dem Einrichten unter «Einstellungen» die Online-Zahlung aktivieren und den Anbieter wählen.</p>
      </Card>
      <div className="space-y-4">
        {PAYMENT_PROVIDERS.map((p) => {
          const c = configs.find((x) => x.provider === p.key);
          return <ProviderForm key={p.key} provider={p.key} label={p.label} hint={p.hint} configured={!!c} enabled={c?.enabled ?? false} tenantId={ctx.tenant.id} appUrl={appUrl} />;
        })}
      </div>
    </div>
  );
}
