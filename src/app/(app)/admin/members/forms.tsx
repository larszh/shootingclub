"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addMemberByEmailAction, removeMemberAction, updateMemberRoleAction } from "@/modules/core/tenant-actions";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { Avatar } from "@/components/avatar";

export function AddMemberForm() {
  const [state, action] = useActionState(addMemberByEmailAction, null);
  return (
    <Card className="animate-rise p-4">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-[1fr_130px] gap-3">
          <Field label="E-Mail eines bestehenden Kontos"><Input name="email" type="email" required placeholder="name@beispiel.ch" /></Field>
          <Field label="Rolle">
            <Select name="role" defaultValue="MEMBER">
              {TENANT_ROLES.filter((r) => r !== "OWNER").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
        </div>
        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton variant="secondary" size="sm">Hinzufügen</SubmitButton>
      </form>
    </Card>
  );
}

export function MemberRow({ membershipId, name, email, role, isSelf, canSetOwner, avatarUrl }: { membershipId: string; name: string; email: string; role: string; isSelf: boolean; canSetOwner: boolean; avatarUrl?: string | null }) {
  const [pending, start] = useTransition();
  const locked = isSelf || (role === "OWNER" && !canSetOwner);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={name} src={avatarUrl} size={40} tone="soft" />
      <div className="min-w-0 flex-1"><div className="font-medium truncate">{name}{isSelf ? <span className="text-ink-3 text-xs"> (du)</span> : null}</div><div className="text-xs text-ink-3 truncate">{email}</div></div>
      <select value={role} disabled={pending || locked} onChange={(e) => start(() => updateMemberRoleAction(membershipId, e.target.value).then(() => undefined))} className="h-10 max-w-[7.5rem] rounded-control border border-line bg-surface px-2 text-sm disabled:opacity-60" aria-label={`Rolle von ${name}`}>
        {TENANT_ROLES.map((r) => <option key={r} value={r} disabled={r === "OWNER" && !canSetOwner}>{ROLE_LABELS[r]}</option>)}
      </select>
      <button type="button" disabled={pending || locked || role === "OWNER"} onClick={async () => { if ((await confirmDialog({ title: `${name} aus dem Verein entfernen?`, tone: "danger", confirmLabel: "Entfernen" }))) start(() => removeMemberAction(membershipId).then(() => undefined)); }} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-ink-3 hover:text-danger disabled:opacity-30" aria-label={`${name} entfernen`}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
