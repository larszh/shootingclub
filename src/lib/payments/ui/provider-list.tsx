import "server-only";
import { appUrl } from "@/lib/mail";
import { listProviderConfigsForAdmin } from "@/lib/payments";
import { PAYMENT_PROVIDERS } from "@/lib/payments/catalog";
import { PaymentProviderForm } from "./provider-form";

/** Alle Zahlungsanbieter mit Formular (Server-Komponente). */
export async function PaymentProviderList({ tenantId }: { tenantId: string }) {
  const configs = await listProviderConfigsForAdmin(tenantId);
  const base = appUrl("/").replace(/\/$/, "");
  return (
    <div className="space-y-4">
      {PAYMENT_PROVIDERS.map((p) => {
        const c = configs.find((x) => x.provider === p.key);
        return (
          <PaymentProviderForm
            key={p.key}
            provider={p.key}
            label={p.label}
            hint={p.hint}
            configured={!!c}
            enabled={c?.enabled ?? false}
            tenantId={tenantId}
            appUrl={base}
            values={c?.values}
          />
        );
      })}
    </div>
  );
}
