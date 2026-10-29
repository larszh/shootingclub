"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, UserMinus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { Spinner } from "@/components/ui/form";
import { isNavigationError, toast } from "@/lib/ui-feedback";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import {
  addToHouseholdAction,
  createHouseholdAction,
  deleteHouseholdAction,
  removeFromHouseholdAction,
  renameHouseholdAction,
  setHouseholdPayerAction,
} from "@/modules/members/actions";

type MemberOption = { id: string; name: string; householdId: string | null };

export type HouseholdView = {
  id: string;
  name: string;
  payerUserId: string | null;
  members: Array<{ membershipId: string; userId: string; name: string; avatarUrl: string | null; left: boolean; feeCents: number }>;
};

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) toast.error(res.error);
        else {
          if (res.message) toast.success(res.message);
          after?.();
        }
      } catch (e) {
        if (isNavigationError(e)) throw e;
        toast.error("Das hat nicht geklappt. Bitte nochmals versuchen.");
      }
    });
  return [pending, run] as const;
}

export function CreateHouseholdForm({ members }: { members: MemberOption[] }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useRun();
  const byId = new Map(members.map((m) => [m.id, m]));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    picked.forEach((id) => fd.append("memberId", id));
    run(async () => {
      const res = await createHouseholdAction(null, fd);
      if (!res.ok) setError(res.error);
      return res;
    }, () => {
      setName("");
      setPicked([]);
    });
  };

  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name des Haushalts" hint="z.B. «Familie Muster» – so steht es auf der Rechnung">
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Familie Muster" />
        </Field>
        <Field label="Mitglieder">
          <Select
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id && !picked.includes(id)) setPicked((p) => [...p, id]);
            }}
          >
            <option value="">Mitglied hinzufügen…</option>
            {members.filter((m) => !picked.includes(m.id)).map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.householdId ? " (wechselt Haushalt)" : ""}</option>
            ))}
          </Select>
        </Field>
        {picked.length ? (
          <ul className="flex flex-wrap gap-2">
            {picked.map((id, i) => (
              <li key={id} className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-surface-2 pl-3 text-sm">
                {byId.get(id)?.name}
                {i === 0 ? <span className="text-xs text-ink-3">· zahlt</span> : null}
                <button type="button" onClick={() => setPicked((p) => p.filter((x) => x !== id))} className="flex h-10 w-10 items-center justify-center text-ink-3 hover:text-ink" aria-label={`${byId.get(id)?.name} entfernen`}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" variant="secondary" disabled={pending || name.trim().length < 2}>{pending ? <Spinner /> : null} Haushalt anlegen</Button>
      </form>
    </Card>
  );
}

export function HouseholdCard({ household, candidates }: { household: HouseholdView; candidates: MemberOption[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(household.name);
  const [pending, run] = useRun();
  const total = household.members.reduce((s, m) => s + (m.left ? 0 : m.feeCents), 0);

  return (
    <Card className="animate-rise overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        {editing ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameHouseholdAction(household.id, name), () => setEditing(false));
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name des Haushalts" maxLength={120} autoFocus />
            <button type="submit" disabled={pending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ok hover:bg-surface-2" aria-label="Speichern"><Check className="h-5 w-5" /></button>
            <button type="button" onClick={() => { setName(household.name); setEditing(false); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2" aria-label="Abbrechen"><X className="h-5 w-5" /></button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1 py-1.5">
              <div className="truncate font-semibold">{household.name}</div>
              <div className="text-xs text-ink-3">{household.members.length} {household.members.length === 1 ? "Mitglied" : "Mitglieder"}{total ? ` · Beiträge zusammen ${formatMoney(total)}` : ""}</div>
            </div>
            {pending ? <Spinner /> : null}
            <button type="button" onClick={() => setEditing(true)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`${household.name} umbenennen`}><Pencil className="h-4 w-4" /></button>
            <ActionButton
              variant="ghost"
              className="h-11 w-11 px-0 text-ink-3 hover:text-danger"
              aria-label={`${household.name} auflösen`}
              action={() => deleteHouseholdAction(household.id)}
              confirm={{ title: `«${household.name}» auflösen?`, message: "Die Mitglieder bleiben erhalten und werden wieder einzeln verrechnet.", tone: "danger", confirmLabel: "Auflösen" }}
            >
              <Trash2 className="h-4 w-4" />
            </ActionButton>
          </>
        )}
      </div>

      <ul className="divide-y divide-line" aria-label={`Mitglieder von ${household.name}`}>
        {household.members.map((m) => {
          const payer = m.userId === household.payerUserId;
          return (
            <li key={m.membershipId} className="flex items-center gap-3 px-4 py-2">
              <Avatar name={m.name} src={m.avatarUrl} size={36} tone="soft" />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate font-medium", m.left && "text-ink-3 line-through")}>{m.name}</div>
                <div className="text-xs text-ink-3">{m.feeCents ? formatMoney(m.feeCents) : "kein Beitrag"}</div>
              </div>
              {payer ? (
                <Badge tone="accent">Zahlt</Badge>
              ) : (
                <button type="button" disabled={pending} onClick={() => run(() => setHouseholdPayerAction(household.id, m.userId))} className="press h-11 rounded-control px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">
                  Als Zahler
                </button>
              )}
              <button type="button" disabled={pending} onClick={() => run(() => removeFromHouseholdAction(m.membershipId))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger" aria-label={`${m.name} aus Haushalt entfernen`}>
                <UserMinus className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line p-3">
        <Select
          value=""
          disabled={pending}
          aria-label={`Mitglied zu ${household.name} hinzufügen`}
          onChange={(e) => {
            const id = e.target.value;
            if (id) run(() => addToHouseholdAction(household.id, id));
          }}
        >
          <option value="">+ Mitglied hinzufügen…</option>
          {candidates.map((m) => <option key={m.id} value={m.id}>{m.name}{m.householdId ? " (wechselt Haushalt)" : ""}</option>)}
        </Select>
      </div>
    </Card>
  );
}
