"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, RotateCcw, Trash2 } from "lucide-react";
import { superCreateTenantAction, switchTenantAction } from "@/modules/core/tenant-actions";
import { requestTenantDeletion, restoreTenant } from "@/modules/core/super-actions";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/form";
import { TenantLogo } from "@/components/logo";
import { toast } from "@/lib/ui-feedback";

export function CreateTenantForm() {
  const [state, action] = useActionState(superCreateTenantAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Field label="Name"><Input name="name" required maxLength={191} /></Field>
          <Field label="Art"><Select name="kind" defaultValue="CLUB"><option value="CLUB">Verein</option><option value="RANGE">Anlage</option><option value="PRIVATE">Privat</option></Select></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Anlegen</SubmitButton>
      </form>
    </Card>
  );
}

function DeleteTenantDialog({ open, onClose, id, name, slug }: { open: boolean; onClose: () => void; id: string; name: string; slug: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim().toLowerCase() === slug.toLowerCase();

  function close() {
    setTyped("");
    setError(null);
    onClose();
  }

  function submit() {
    start(async () => {
      const res = await requestTenantDeletion(id, typed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`«${name}» wird in 30 Tagen endgültig gelöscht.`, { description: "Bis dahin lässt sich der Verein wiederherstellen." });
      close();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`«${name}» löschen?`}
      description="Der Verein ist sofort für alle Mitglieder gesperrt. Nach 30 Tagen werden alle Daten und Dateien endgültig gelöscht. Bis dahin kannst du ihn wiederherstellen."
      icon={<Trash2 className="h-5 w-5" />}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>Abbrechen</Button>
          <Button type="button" variant="danger" disabled={!matches || pending} onClick={submit}>{pending ? "Bitte warten…" : "Löschen"}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); if (matches && !pending) submit(); }} className="space-y-3">
        <Field label={`Zur Bestätigung «${slug}» eintippen`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} data-autofocus maxLength={191} />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
      </form>
    </Dialog>
  );
}

export function TenantRow({ id, name, slug, meta, logoUrl, brandColor, purgeAfter }: { id: string; name: string; slug: string; meta: string; logoUrl?: string | null; brandColor?: string | null; purgeAfter: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function restore() {
    start(async () => {
      const res = await restoreTenant(id);
      if (res.ok) {
        toast.success(`«${name}» ist wiederhergestellt.`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <TenantLogo src={logoUrl} size={40} />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">
          {name}
          {brandColor ? <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: brandColor }} title={`Akzentfarbe ${brandColor}`} /> : null}
          {purgeAfter ? <Badge tone="danger">Gelöscht</Badge> : null}
        </div>
        <div className="text-xs text-ink-3 truncate">{meta}</div>
        {purgeAfter ? <div className="text-xs text-danger mt-0.5">Löschung geplant am {purgeAfter}</div> : null}
      </div>
      {purgeAfter ? (
        <button type="button" disabled={pending} onClick={restore} className="h-11 shrink-0 px-3 rounded-control border border-line text-sm inline-flex items-center gap-1.5">
          <RotateCcw className="h-4 w-4" /> Wiederherstellen
        </button>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={() => start(() => switchTenantAction(id))} className="h-11 shrink-0 px-3 rounded-control border border-line text-sm inline-flex items-center gap-1.5"><LogIn className="h-4 w-4" /> Öffnen</button>
          <button type="button" disabled={pending} onClick={() => setDeleteOpen(true)} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:text-danger" aria-label={`Tenant «${name}» löschen`}><Trash2 className="h-4 w-4" /></button>
          <DeleteTenantDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} id={id} name={name} slug={slug} />
        </>
      )}
    </div>
  );
}
