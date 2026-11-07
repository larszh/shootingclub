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
import { useT } from "@/components/locale";

export function CreateTenantForm() {
  const [state, action] = useActionState(superCreateTenantAction, null);
  const t = useT();
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Field label={t("adm2.common.name")}><Input name="name" required maxLength={191} /></Field>
          <Field label={t("adm2.super.t.kind")}><Select name="kind" defaultValue="CLUB"><option value="CLUB">{t("adm2.super.t.kind.CLUB")}</option><option value="RANGE">{t("adm2.super.t.kind.RANGE")}</option><option value="PRIVATE">{t("adm2.super.t.kind.PRIVATE")}</option></Select></Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">{t("adm2.super.t.create")}</SubmitButton>
      </form>
    </Card>
  );
}

function DeleteTenantDialog({ open, onClose, id, name, slug }: { open: boolean; onClose: () => void; id: string; name: string; slug: string }) {
  const router = useRouter();
  const t = useT();
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
      toast.success(t("adm2.super.t.deleted", { name }), { description: t("adm2.super.t.deletedHint") });
      close();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("adm2.super.t.deleteQ", { name })}
      description={t("adm2.super.t.deleteText")}
      icon={<Trash2 className="h-5 w-5" />}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>{t("adm2.common.cancel")}</Button>
          <Button type="button" variant="danger" disabled={!matches || pending} onClick={submit}>{pending ? t("adm2.super.t.wait") : t("adm2.common.delete")}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); if (matches && !pending) submit(); }} className="space-y-3">
        <Field label={t("adm2.super.t.typeToConfirm", { slug })}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} data-autofocus maxLength={191} />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
      </form>
    </Dialog>
  );
}

export function TenantRow({ id, name, slug, meta, logoUrl, brandColor, purgeAfter }: { id: string; name: string; slug: string; meta: string; logoUrl?: string | null; brandColor?: string | null; purgeAfter: string | null }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function restore() {
    start(async () => {
      const res = await restoreTenant(id);
      if (res.ok) {
        toast.success(t("adm2.super.t.restored", { name }));
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
          {brandColor ? <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: brandColor }} title={t("adm2.super.t.accent", { color: brandColor })} /> : null}
          {purgeAfter ? <Badge tone="danger">{t("adm2.super.u.deleted")}</Badge> : null}
        </div>
        <div className="text-xs text-ink-3 truncate">{meta}</div>
        {purgeAfter ? <div className="text-xs text-danger mt-0.5">{t("adm2.super.t.purgeOn", { date: purgeAfter })}</div> : null}
      </div>
      {purgeAfter ? (
        <button type="button" disabled={pending} onClick={restore} className="h-11 shrink-0 px-3 rounded-control border border-line text-sm inline-flex items-center gap-1.5">
          <RotateCcw className="h-4 w-4" /> {t("adm2.super.t.restore")}
        </button>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={() => start(() => switchTenantAction(id))} className="h-11 shrink-0 px-3 rounded-control border border-line text-sm inline-flex items-center gap-1.5"><LogIn className="h-4 w-4" /> {t("adm2.super.t.open")}</button>
          <button type="button" disabled={pending} onClick={() => setDeleteOpen(true)} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:text-danger" aria-label={t("adm2.super.t.deleteAria", { name })}><Trash2 className="h-4 w-4" /></button>
          <DeleteTenantDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} id={id} name={name} slug={slug} />
        </>
      )}
    </div>
  );
}
