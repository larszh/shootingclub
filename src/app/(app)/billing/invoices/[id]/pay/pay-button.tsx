"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { isNavigationError, isNetworkError } from "@/lib/ui-feedback";
import { payFeeInvoiceOnlineAction } from "./actions";

export function PayFeeInvoiceButton({ invoiceId, label }: { invoiceId: string; label: string }) {
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
              setErr(isNetworkError(e) ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.");
            }
          })
        }
      >
        <CreditCard className="h-5 w-5" aria-hidden /> {pending ? "Weiterleitung…" : label}
      </Button>
      {err ? <div className="mt-2"><Alert>{err}</Alert></div> : null}
    </div>
  );
}
