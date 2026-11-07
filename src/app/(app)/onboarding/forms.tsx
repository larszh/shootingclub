"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { createTenantAction, joinTenantAction } from "@/modules/core/tenant-actions";
import { Alert, Card, ClubhouseIllustration, Field, Input, Select, TeamIllustration } from "@/components/ui";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { Hint, Segmented } from "@/components/ui/controls";
import { Avatar } from "@/components/avatar";
import { useT } from "@/components/locale";
import { translateServerMessage } from "@/components/server-messages";

type Path = "join" | "create";

export function OnboardingForms({ initialCode, codeTenant }: { initialCode?: string; codeTenant?: { name: string; city: string | null; logoUrl: string | null } | null }) {
  const [path, setPath] = useState<Path | null>(initialCode ? "join" : null);
  const t = useT();

  if (!path) {
    return (
      <div className="stagger grid gap-3 sm:grid-cols-2">
        <PathCard
          onClick={() => setPath("join")}
          illustration={<TeamIllustration size={84} />}
          title={t("shell.onboarding.join.title")}
          text={t("shell.onboarding.join.text")}
          cta={t("shell.onboarding.join.cta")}
        />
        <PathCard
          onClick={() => setPath("create")}
          illustration={<ClubhouseIllustration size={84} />}
          title={t("shell.onboarding.create.title")}
          text={t("shell.onboarding.create.text")}
          cta={t("shell.onboarding.create.cta")}
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
          aria-label={t("shell.onboarding.back")}
          className="press flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Segmented<Path>
          label={t("shell.onboarding.path")}
          className="flex-1"
          value={path}
          onChange={setPath}
          options={[
            { value: "join", label: t("shell.onboarding.path.join") },
            { value: "create", label: t("shell.onboarding.path.create") },
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
  const [state, action, pending] = useActionState(joinTenantAction, null);
  const t = useT();
  const [code, setCode] = useState(initialCode ?? "");
  const matches = !!codeTenant && code === initialCode;
  return (
    <Card className="p-5 animate-fade">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4">
        {matches && codeTenant ? (
          <div className="flex items-center gap-3 rounded-control bg-surface-2 p-3">
            <Avatar name={codeTenant.name} src={codeTenant.logoUrl} size={40} tone="soft" className="rounded-xl" />
            <div className="min-w-0">
              <p className="text-xs text-ink-3">{t("shell.onboarding.join.joining")}</p>
              <p className="truncate font-semibold">{codeTenant.name}</p>
            </div>
          </div>
        ) : null}
        <Field label={t("shell.onboarding.join.code")} hint={t("shell.onboarding.join.codeHint")}>
          <Input
            name="joinCode"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            placeholder={t("shell.onboarding.join.codePlaceholder")}
            className="uppercase font-mono tracking-widest text-lg h-13"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            autoFocus
          />
        </Field>
        {state && !state.ok ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{translateServerMessage(state.error, t)} {t("shell.onboarding.join.checkCode")}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pending={pending} pendingText={t("shell.onboarding.join.pending")} disabled={code.length < 4}>
          {t("shell.onboarding.join.submit")}
        </SubmitButton>
        <p className="text-xs text-ink-3">{t("shell.onboarding.join.note")}</p>
      </form>
    </Card>
  );
}

function CreateForm() {
  const [state, action, pending] = useActionState(createTenantAction, null);
  const [kind, setKind] = useState("CLUB");
  const t = useT();
  return (
    <Card className="p-5 animate-fade">
      <form onSubmit={submitKeepingValues(action)} className="space-y-4">
        <Field label={t("shell.onboarding.create.name")}>
          <Input name="name" required minLength={2} placeholder={t(`shell.onboarding.create.placeholder.${kind === "RANGE" || kind === "PRIVATE" ? kind : "CLUB"}`)} autoFocus autoComplete="organization" />
        </Field>
        <Field label={t("shell.onboarding.create.kind")}>
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="CLUB">{t("shell.onboarding.create.kind.CLUB")}</option>
            <option value="RANGE">{t("shell.onboarding.create.kind.RANGE")}</option>
            <option value="PRIVATE">{t("shell.onboarding.create.kind.PRIVATE")}</option>
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("shell.onboarding.create.city")} className="col-span-2"><Input name="city" placeholder={t("shell.onboarding.create.city")} autoComplete="address-level2" /></Field>
          <Field label={t("shell.onboarding.create.canton")}><Input name="canton" placeholder="ZH" maxLength={2} className="uppercase" autoCapitalize="characters" /></Field>
        </div>
        {state && !state.ok ? <Alert icon={<AlertCircle className="h-4 w-4" />}>{translateServerMessage(state.error, t)}</Alert> : null}
        <SubmitButton className="w-full" size="lg" pending={pending} pendingText={t("shell.onboarding.create.pending")}>{t("shell.onboarding.create.submit")}</SubmitButton>
        <p className="text-xs text-ink-3">
          {t("shell.onboarding.create.note")}{" "}
          <Hint label={t("shell.onboarding.create.modulesLabel")} side="top">{t("shell.onboarding.create.modulesHint")}</Hint>
        </p>
      </form>
    </Card>
  );
}
