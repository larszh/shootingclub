"use client";

import { useActionState, useState, useTransition } from "react";
import { RotateCw, Send, Trash2 } from "lucide-react";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui";
import { CopyButton } from "@/components/ui/controls";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { confirmDialog, toast } from "@/lib/ui-feedback";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { inviteMemberAction, resendInvitationAction, revokeInvitationAction } from "@/modules/members/actions";
import { addMemberByEmailAction } from "@/modules/core/tenant-actions";

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, action, pending] = useActionState(inviteMemberAction, null);
  // Nach Erfolg leeres Formular: neuer key pro erfolgreichem Ergebnis
  const formKey = state?.ok ? state.data?.url ?? "ok" : "form";
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card className="animate-rise p-4">
      <form key={formKey} onSubmit={submitKeepingValues(action)} className="space-y-3">
        <Field label="E-Mail" error={fe.email}><Input name="email" type="email" required placeholder="name@beispiel.ch" autoComplete="off" /></Field>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="Name (optional)" error={fe.name}><Input name="name" maxLength={191} placeholder="Vorname Nachname" /></Field>
          <Field label="Rolle" error={fe.role}>
            <Select name="role" defaultValue="MEMBER">
              {TENANT_ROLES.filter((r) => r !== "OWNER" && (canInviteAdmin || r !== "ADMIN")).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        {state?.ok ? (
          <Alert tone="ok">
            {state.message}
            {state.data?.url ? (
              <span className="mt-2 flex items-center gap-2 text-ink-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{state.data.url}</span>
                <CopyButton text={state.data.url} label="Link kopieren" copiedMessage="Link kopiert" />
              </span>
            ) : null}
          </Alert>
        ) : null}
        <SubmitButton pending={pending} pendingText="Wird gesendet…"><Send className="h-4 w-4" /> Einladung senden</SubmitButton>
      </form>
    </Card>
  );
}

export function InvitationRow({ id, email, name, role, meta, expired }: { id: string; email: string; name: string | null; role: string; meta: string; expired: boolean }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const resend = () => start(async () => {
    const res = await resendInvitationAction(id);
    if (res.ok) toast.success(res.message ?? "Erneut verschickt.");
    else toast.error(res.error);
  });
  const revoke = async () => {
    if (!(await confirmDialog({ title: `Einladung an ${email} zurückziehen?`, message: "Der Link funktioniert danach nicht mehr.", tone: "danger", confirmLabel: "Zurückziehen" }))) return;
    start(async () => {
      const res = await revokeInvitationAction(id);
      if (res.ok) {
        setGone(true);
        toast.success(res.message ?? "Zurückgezogen.");
      } else toast.error(res.error);
    });
  };
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2", pending && "opacity-60")}>
      <div className="min-w-0 flex-1 py-1">
        <div className="truncate font-medium">{name || email}</div>
        <div className="truncate text-xs text-ink-3">{name ? `${email} · ` : ""}{meta}</div>
      </div>
      {expired ? <Badge tone="warn">Abgelaufen</Badge> : <Badge>{role}</Badge>}
      {pending ? <Spinner /> : null}
      <button type="button" disabled={pending} onClick={resend} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Einladung an ${email} erneut senden`} title="Erneut senden">
        <RotateCw className="h-4 w-4" />
      </button>
      <button type="button" disabled={pending} onClick={revoke} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger" aria-label={`Einladung an ${email} zurückziehen`} title="Zurückziehen">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AddExistingForm() {
  const [state, action, pending] = useActionState(addMemberByEmailAction, null);
  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-3">
        <p className="text-sm text-ink-3">Für Personen, die schon ein Standchef-Konto haben (z.B. aus einem anderen Verein). Sie werden ohne Mail sofort Mitglied.</p>
        <div className="grid grid-cols-[1fr_130px] gap-3">
          <Field label="E-Mail des Kontos"><Input name="email" type="email" required placeholder="name@beispiel.ch" /></Field>
          <Field label="Rolle">
            <Select name="role" defaultValue="MEMBER">
              {TENANT_ROLES.filter((r) => r !== "OWNER").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" pending={pending}>Hinzufügen</SubmitButton>
      </form>
    </Card>
  );
}
