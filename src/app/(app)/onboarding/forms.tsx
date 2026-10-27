"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { createTenantAction, joinTenantAction } from "@/modules/core/tenant-actions";
import { Alert, Card, ClubhouseIllustration, Field, Input, Select, TeamIllustration } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { Hint, Segmented } from "@/components/ui/controls";
import { Avatar } from "@/components/avatar";

type Path = "join" | "create";

export function OnboardingForms({ initialCode, codeTenant }: { initialCode?: string; codeTenant?: { name: string; city: string | null; logoUrl: string | null } | null }) {
  const [path, setPath] = useState<Path | null>(initialCode ? "join" : null);

  if (!path) {
    return (
      <div className="stagger grid gap-3 sm:grid-cols-2">
        <PathCard
          onClick={() => setPath("join")}
          illustration={<TeamIllustration size={84} />}
          title="Einem Verein beitreten"
          text="Du hast einen Beitrittscode vom Vorstand oder einen Einladungslink bekommen."
          cta="Mit Code beitreten"
        />
        <PathCard
          onClick={() => setPath("create")}
          illustration={<ClubhouseIllustration size={84} />}
          title="Neuen Verein anlegen"
          text="Für Vorstände, Anlagebetreiber oder eine private Schiessgruppe. Du wirst Inhaber."
          cta="Verein anlegen"
        />
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPath(null)}
          aria-label="Zurück zur Auswahl"
          className="press flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Segmented<Path>
          label="Weg wählen"
          className="flex-1"
          value={path}
          onChange={setPath}
          options={[
            { value: "join", label: "Beitreten" },
            { value: "create", label: "Neu anlegen" },
          ]}
        />
      </div>
      {path === "join" ? <JoinForm initialCode={initialCode} codeTenant={codeTenant} /> : <CreateForm />}
    </div>
  );
}

function PathCard({ onClick, illustration, title, text, cta }: { onClick: () => void; illustration: React.ReactNode; title: string; text: string; cta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press group flex h-full flex-col items-center rounded-card border border-line bg-surface p-5 text-center transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {illustration}
      <span className="mt-3 text-lg font-semibold leading-tight">{title}</span>
      <span className="mt-1 text-sm text-ink-3">{text}</span>
      <span className="mt-4 inline-flex h-11 items-center rounded-control bg-ink px-4 text-[15px] font-medium text-bg transition-opacity group-hover:opacity-90">{cta}</span>
    </button>
  );
}

function JoinForm({ initialCode, codeTenant }: { initialCode?: string; codeTenant?: { name: string; city: string | null; logoUrl: string | null } | null }) {
  const [state, action] = useActionState(joinTenantAction, null);
  const [code, setCode] = useState(initialCode ?? "");
  const matches = !!codeTenant && code === initialCode;
  return (
    <Card className="p-5 animate-fade">
      <form action={action} className="space-y-4">
        {matches && codeTenant ? (
          <div className="flex items-center gap-3 rounded-control bg-surface-2 p-3">
            <Avatar name={codeTenant.name} src={codeTenant.logoUrl} size={40} tone="soft" className="rounded-xl" />
            <div className="min-w-0">
              <p className="text-xs text-ink-3">Du trittst bei</p>
              <p className="truncate font-semibold">{codeTenant.name}</p>
            </div>
          </div>
        ) : null}
        <Field label="Beitrittscode" hint="Den Code erhältst du vom Vereinsadmin. Gross-/Kleinschreibung spielt keine Rolle.">
          <Input
            name="joinCode"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            placeholder="z.B. 7KQ2PX"
            className="uppercase font-mono tracking-widest text-lg h-13"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            autoFocus
          />
        </Field>
        {state && !state.ok ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error} Bitte prüfe den Code.</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText="Trete bei…" disabled={code.length < 4}>
          Beitreten
        </SubmitButton>
        <p className="text-xs text-ink-3">Du startest als Mitglied. Der Vereinsadmin kann dir später eine andere Rolle geben.</p>
      </form>
    </Card>
  );
}

function CreateForm() {
  const [state, action] = useActionState(createTenantAction, null);
  const [kind, setKind] = useState("CLUB");
  return (
    <Card className="p-5 animate-fade">
      <form action={action} className="space-y-4">
        <Field label="Name">
          <Input name="name" required minLength={2} placeholder={kind === "RANGE" ? "z.B. Schiessanlage Allmend" : kind === "PRIVATE" ? "z.B. Pistolengruppe Freitag" : "z.B. Schützengesellschaft Musterhausen"} autoFocus autoComplete="organization" />
        </Field>
        <Field label="Art">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="CLUB">Verein</option>
            <option value="RANGE">Schiessanlage / Indoor-Stand</option>
            <option value="PRIVATE">Privat / Gruppe</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ort" className="col-span-2"><Input name="city" placeholder="Ort" autoComplete="address-level2" /></Field>
          <Field label="Kanton"><Input name="canton" placeholder="ZH" maxLength={2} className="uppercase" autoCapitalize="characters" /></Field>
        </div>
        {state && !state.ok ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{state.error}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pendingText="Wird angelegt…">Anlegen</SubmitButton>
        <p className="text-xs text-ink-3">
          Du wirst Inhaber und lädst Mitglieder über einen Beitrittscode ein. Logo, Farben und Module stellst du danach unter «Verein» ein.{" "}
          <Hint label="Mehr zu Modulen" side="top">Punkteerfassung, Zielscheiben und Anlässe sind gleich aktiv. Module wie Reservationen oder Beiträge schaltest du nur ein, wenn du sie brauchst.</Hint>
        </p>
      </form>
    </Card>
  );
}
