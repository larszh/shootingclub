"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, UserMinus } from "lucide-react";
import {
  addAssociationAdminAction,
  regenerateAssociationCodeAction,
  removeAssociationAdminAction,
  setAssociationAdminRoleAction,
  setAssociationDeletedAction,
  updateAssociationAction,
} from "@/modules/association/actions";
import { ASSOCIATION_ADMIN_ROLES, ASSOCIATION_ADMIN_ROLE_LABELS } from "@/modules/association/access";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { CopyButton } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";

export function EditAssociationForm({ id, name, region }: { id: string; name: string; region: string | null }) {
  const [state, action] = useActionState(updateAssociationAction, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Gespeichert.");
  }, [state]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <Field label="Name" error={err?.name}><Input name="name" defaultValue={name} required maxLength={191} /></Field>
        <Field label="Region / Kanton" error={err?.region}><Input name="region" defaultValue={region ?? ""} maxLength={191} /></Field>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary">Speichern</SubmitButton>
      </form>
    </Card>
  );
}

export function CodeCard({ id, code }: { id: string; code: string }) {
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-3">Beitrittscode für Vereine</div>
          <div className="font-mono text-2xl tracking-[0.25em] font-semibold">{code}</div>
        </div>
        <CopyButton text={code} label="Kopieren" copiedMessage="Code kopiert" iconOnly />
        <ActionButton
          variant="secondary"
         
          className="h-11 w-11 px-0"
          aria-label="Neuer Code"
          action={() => regenerateAssociationCodeAction(id)}
          confirm={{ title: "Neuen Code erzeugen?", message: "Der alte Code wird sofort ungültig. Bestehende Verbindungen bleiben.", tone: "danger", confirmLabel: "Neu erzeugen" }}
          refresh
        >
          <RefreshCw className="h-4 w-4" />
        </ActionButton>
      </div>
      <p className="mt-2 text-xs text-ink-3">Vereine geben den Code unter Einstellungen → Verband ein. Jeder Beitritt muss im Verbandsbereich freigegeben werden.</p>
    </Card>
  );
}

export function AddAdminForm({ associationId }: { associationId: string }) {
  const [state, action] = useActionState(addAssociationAdminAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Gespeichert.");
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <Card className="animate-rise p-4">
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="associationId" value={associationId} />
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="E-Mail eines bestehenden Kontos" error={err?.email}><Input name="email" type="email" required maxLength={191} autoComplete="off" inputMode="email" /></Field>
          <Field label="Rolle" error={err?.role}>
            <Select name="role" defaultValue="ADMIN">
              {ASSOCIATION_ADMIN_ROLES.map((r) => <option key={r} value={r}>{ASSOCIATION_ADMIN_ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary">Zugang geben</SubmitButton>
      </form>
    </Card>
  );
}

export function AdminRow({ id, name, email, role, deleted }: { id: string; name: string; email: string; role: string; deleted: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function change(next: string) {
    start(async () => {
      const res = await setAssociationAdminRoleAction(id, next);
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">{name}{deleted ? <Badge tone="danger">Konto gelöscht</Badge> : null}</div>
        <div className="text-xs text-ink-3 truncate">{email}</div>
      </div>
      <Select aria-label={`Rolle von ${name}`} value={role} disabled={pending} onChange={(e) => change(e.target.value)} className="w-36 shrink-0">
        {ASSOCIATION_ADMIN_ROLES.map((r) => <option key={r} value={r}>{ASSOCIATION_ADMIN_ROLE_LABELS[r]}</option>)}
      </Select>
      <ActionButton
        variant="ghost"
       
        className="h-11 w-11 px-0 shrink-0"
        aria-label={`Zugang von ${name} entfernen`}
        action={() => removeAssociationAdminAction(id)}
        confirm={{ title: `Zugang von ${name} entfernen?`, tone: "danger", confirmLabel: "Entfernen" }}
        refresh
      >
        <UserMinus className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}

export function DeleteAssociationButton({ id, name, deleted }: { id: string; name: string; deleted: boolean }) {
  return deleted ? (
    <ActionButton variant="secondary" action={() => setAssociationDeletedAction(id, false)} refresh>Wiederherstellen</ActionButton>
  ) : (
    <ActionButton
      variant="danger"
      action={() => setAssociationDeletedAction(id, true)}
      confirm={{ title: `«${name}» löschen?`, message: "Der Verbandsbereich wird gesperrt und kein Verein kann mehr beitreten. Die Verbindungen bleiben gespeichert; du kannst den Verband wiederherstellen.", tone: "danger", confirmLabel: "Löschen" }}
      refresh
    >
      <Trash2 className="h-4 w-4" /> Verband löschen
    </ActionButton>
  );
}
