"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { acceptInvitationAction, switchAccountForInvitationAction } from "@/modules/core/auth-actions";
import { Alert, Button } from "@/components/ui";
import { Spinner } from "@/components/ui/form";

export function AcceptInvitationButton({ token, label }: { token: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-4 space-y-3">
      {error ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{error}</Alert> : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() =>
          start(async () => {
            const res = await acceptInvitationAction(token);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? <span className="inline-flex items-center gap-2"><Spinner /> Einen Moment…</span> : label}
      </Button>
    </div>
  );
}

export function SwitchAccountButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="lg" className="mt-4 w-full" disabled={pending} onClick={() => start(() => switchAccountForInvitationAction(token))}>
      {pending ? <span className="inline-flex items-center gap-2"><Spinner /> Abmelden…</span> : "Abmelden & anders anmelden"}
    </Button>
  );
}
