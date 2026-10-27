"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { regenerateJoinCodeAction, setModuleEnabledAction, updateTenantAction } from "@/modules/core/tenant-actions";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function JoinCodeCard({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const copy = async () => {
    const text = link.startsWith("http") ? link : `${window.location.origin}${link}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-ink-3">Beitrittscode</div>
          <div className="font-mono text-2xl tracking-[0.3em] font-semibold">{code}</div>
        </div>
        <button type="button" onClick={copy} className="press h-10 px-3 rounded-control border border-line inline-flex items-center gap-2 text-sm font-medium">{copied ? <><Check className="h-4 w-4 text-ok" /> Kopiert</> : <><Copy className="h-4 w-4" /> Link</>}</button>
        <button type="button" disabled={pending} onClick={() => { if (confirm("Neuen Code erzeugen? Der alte wird ungültig.")) start(() => regenerateJoinCodeAction().then(() => undefined)); }} className="press h-10 w-10 rounded-control border border-line inline-flex items-center justify-center text-ink-3" aria-label="Neuer Code"><RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} /></button>
      </div>
      <p className="mt-2 text-xs text-ink-3">Mitglieder geben den Code bei der Registrierung oder unter «Mehr» ein.</p>
    </Card>
  );
}

export function ModuleToggle({ moduleKey, name, description, enabled, planned }: { moduleKey: string; name: string; description: string; enabled: boolean; planned: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium flex items-center gap-2">{name}{planned ? <Badge tone="outline">bald</Badge> : null}</div>
        <div className="text-xs text-ink-3">{description}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={pending} onClick={() => { const next = !on; setOn(next); start(() => setModuleEnabledAction(moduleKey, next).then(() => undefined)); }}
        className={cn("relative h-7 w-12 rounded-full transition-colors", on ? "bg-ink" : "bg-line")}>
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function TenantSettingsForm({ tenant }: { tenant: { name: string; kind: string; city: string | null; canton: string | null } }) {
  const [state, action] = useActionState(updateTenantAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <Field label="Name"><Input name="name" defaultValue={tenant.name} required /></Field>
        <Field label="Art">
          <Select name="kind" defaultValue={tenant.kind}>
            <option value="CLUB">Verein</option>
            <option value="RANGE">Schiessanlage / Indoor-Stand</option>
            <option value="PRIVATE">Privat / Gruppe</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ort" className="col-span-2"><Input name="city" defaultValue={tenant.city ?? ""} /></Field>
          <Field label="Kanton"><Input name="canton" defaultValue={tenant.canton ?? ""} maxLength={2} className="uppercase" /></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Speichern</SubmitButton>
      </form>
    </Card>
  );
}
