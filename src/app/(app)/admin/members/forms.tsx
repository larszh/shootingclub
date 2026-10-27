"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addMemberByEmailAction, removeMemberAction, updateMemberRoleAction } from "@/modules/core/tenant-actions";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { initials } from "@/lib/utils";

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

export function MemberRow({ membershipId, name, email, role, isSelf, canSetOwner }: { membershipId: string; name: string; email: string; role: string; isSelf: boolean; canSetOwner: boolean }) {
  const [pending, start] = useTransition();
  const locked = isSelf || (role === "OWNER" && !canSetOwner);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{initials(name)}</span>
      <div className="min-w-0 flex-1"><div className="font-medium truncate">{name}{isSelf ? <span className="text-ink-3 text-xs"> (du)</span> : null}</div><div className="text-xs text-ink-3 truncate">{email}</div></div>
      <select value={role} disabled={pending || locked} onChange={(e) => start(() => updateMemberRoleAction(membershipId, e.target.value).then(() => undefined))} className="h-9 rounded-control border border-line bg-surface px-2 text-sm disabled:opacity-60">
        {TENANT_ROLES.map((r) => <option key={r} value={r} disabled={r === "OWNER" && !canSetOwner}>{ROLE_LABELS[r]}</option>)}
      </select>
      <button type="button" disabled={pending || locked || role === "OWNER"} onClick={() => { if (confirm(`${name} aus dem Verein entfernen?`)) start(() => removeMemberAction(membershipId).then(() => undefined)); }} className="h-9 w-9 rounded-full flex items-center justify-center text-ink-3 hover:text-accent disabled:opacity-30" aria-label="Entfernen"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
