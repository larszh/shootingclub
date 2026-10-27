"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useTransition } from "react";
import { LogIn, Trash2 } from "lucide-react";
import { superCreateTenantAction, superDeleteTenantAction, switchTenantAction } from "@/modules/core/tenant-actions";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { TenantLogo } from "@/components/logo";

export function CreateTenantForm() {
  const [state, action] = useActionState(superCreateTenantAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Field label="Name"><Input name="name" required /></Field>
          <Field label="Art"><Select name="kind" defaultValue="CLUB"><option value="CLUB">Verein</option><option value="RANGE">Anlage</option><option value="PRIVATE">Privat</option></Select></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Anlegen</SubmitButton>
      </form>
    </Card>
  );
}

export function TenantRow({ id, name, meta, logoUrl, brandColor }: { id: string; name: string; meta: string; logoUrl?: string | null; brandColor?: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <TenantLogo src={logoUrl} size={40} />
      <div className="min-w-0 flex-1"><div className="font-medium truncate flex items-center gap-2">{name}{brandColor ? <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: brandColor }} title={`Akzentfarbe ${brandColor}`} /> : null}</div><div className="text-xs text-ink-3 truncate">{meta}</div></div>
      <button type="button" disabled={pending} onClick={() => start(() => switchTenantAction(id))} className="h-9 px-3 rounded-control border border-line text-sm inline-flex items-center gap-1.5"><LogIn className="h-4 w-4" /> Öffnen</button>
      <button type="button" disabled={pending} onClick={async () => { if ((await confirmDialog({ title: `Tenant «${name}» mit allen Daten löschen?`, tone: "danger" }))) start(() => superDeleteTenantAction(id).then(() => undefined)); }} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:text-danger" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
