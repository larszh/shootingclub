"use client";

import { useActionState, useState } from "react";
import { createTenantAction, joinTenantAction } from "@/modules/core/tenant-actions";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function OnboardingForms() {
  const [tab, setTab] = useState<"join" | "create">("join");
  const [joinState, joinAction] = useActionState(joinTenantAction, null);
  const [createState, createAction] = useActionState(createTenantAction, null);

  return (
    <div className="animate-rise [animation-delay:100ms]">
      <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1 mb-4">
        {(["join", "create"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn("h-10 rounded-[10px] text-sm font-medium transition-all", tab === t ? "bg-surface shadow-sm text-ink" : "text-ink-3")}>
            {t === "join" ? "Beitreten" : "Neu anlegen"}
          </button>
        ))}
      </div>

      {tab === "join" ? (
        <Card className="p-5 animate-fade">
          <form action={joinAction} className="space-y-4">
            <Field label="Beitrittscode" hint="Den Code erhältst du vom Vereinsadmin.">
              <Input name="joinCode" required placeholder="z.B. 7KQ2PX" className="uppercase font-mono tracking-widest text-lg h-13" autoCapitalize="characters" autoFocus />
            </Field>
            {joinState && !joinState.ok ? <Alert>{joinState.error}</Alert> : null}
            <SubmitButton className="w-full" size="lg">Beitreten</SubmitButton>
          </form>
        </Card>
      ) : (
        <Card className="p-5 animate-fade">
          <form action={createAction} className="space-y-4">
            <Field label="Name">
              <Input name="name" required placeholder="z.B. Schützengesellschaft Musterhausen" autoFocus />
            </Field>
            <Field label="Art">
              <Select name="kind" defaultValue="CLUB">
                <option value="CLUB">Verein</option>
                <option value="RANGE">Schiessanlage / Indoor-Stand</option>
                <option value="PRIVATE">Privat / Gruppe</option>
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Ort" className="col-span-2"><Input name="city" placeholder="Ort" /></Field>
              <Field label="Kanton"><Input name="canton" placeholder="ZH" maxLength={2} className="uppercase" /></Field>
            </div>
            {createState && !createState.ok ? <Alert>{createState.error}</Alert> : null}
            <SubmitButton className="w-full" size="lg">Anlegen</SubmitButton>
            <p className="text-xs text-ink-3">Du wirst Inhaber und kannst Mitglieder über einen Beitrittscode einladen.</p>
          </form>
        </Card>
      )}
    </div>
  );
}
