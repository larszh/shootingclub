"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { isNavigationError, isNetworkError } from "@/lib/ui-feedback";
import { getT, type Locale } from "@/lib/i18n/core";
import { payFeeInvoiceOnlineAction } from "./actions";

export function PayFeeInvoiceButton({ invoiceId, label, locale = "de" }: { invoiceId: string; label: string; locale?: Locale }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const r = await payFeeInvoiceOnlineAction(invoiceId);
              if (r && !r.ok) setErr(r.error);
            } catch (e) {
              if (isNavigationError(e)) throw e;
              setErr(isNetworkError(e) ? t("money.err.offline") : t("money.err.generic"));
            }
          })
        }
      >
        <CreditCard className="h-5 w-5" aria-hidden /> {pending ? t("money.pay.redirecting") : label}
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}
