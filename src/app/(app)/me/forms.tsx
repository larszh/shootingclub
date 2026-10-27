"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { switchTenantAction, updateProfileAction } from "@/modules/core/tenant-actions";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton, Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function TenantSwitcher({ activeId, tenants }: { activeId: string | null; tenants: Array<{ id: string; name: string; role: string }> }) {
  const [pending, start] = useTransition();
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {tenants.map((t) => {
        const active = t.id === activeId;
        return (
          <button key={t.id} type="button" disabled={pending || active} onClick={() => start(() => switchTenantAction(t.id))}
            className={cn("flex w-full items-center gap-3 px-4 h-14 text-left transition-colors", active ? "bg-surface-2" : "hover:bg-surface-2")}>
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", active ? "bg-ink text-bg border-ink" : "border-line")}>
              {active ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{t.name}</span>
              <span className="block text-xs text-ink-3">{t.role}</span>
            </span>
            {pending && !active ? <Spinner /> : null}
          </button>
        );
      })}
      <Link href="/onboarding?force=1" className="flex items-center gap-3 px-4 h-13 text-ink-2 hover:bg-surface-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line"><Plus className="h-3.5 w-3.5" /></span>
        <span className="font-medium">Weiterem Verein beitreten / neu anlegen</span>
      </Link>
    </Card>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <Field label="Anzeigename"><Input name="name" defaultValue={name} required /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Speichern</SubmitButton>
      </form>
    </Card>
  );
}
