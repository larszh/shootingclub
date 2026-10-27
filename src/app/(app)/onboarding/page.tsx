import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/tenant";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import { Card, SectionTitle } from "@/components/ui";
import { OnboardingForms } from "./forms";
import { lookupJoinTenant, normalizeJoinCode } from "@/app/(auth)/join-code";

export const metadata: Metadata = { title: "Loslegen" };

const ROLE_TEXT: Record<(typeof TENANT_ROLES)[number], string> = {
  OWNER: "Hat den Verein angelegt. Darf alles, auch weitere Inhaber ernennen.",
  ADMIN: "Verwaltet Mitglieder, Module, Programme, Scheiben, Reservationen und Beiträge.",
  TRAINER: "Sieht alle Resultate im Verein und führt Anlässe und Anmeldelisten.",
  MEMBER: "Erfasst eigene Resultate, druckt Scheiben, reserviert und meldet sich an.",
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ force?: string; code?: string | string[] }> }) {
  const ctx = await getAppContext();
  const sp = await searchParams;
  if (ctx.tenant && !sp.force) redirect("/");
  const code = normalizeJoinCode(sp.code);
  const codeTenant = await lookupJoinTenant(code);
  const firstName = ctx.user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-xl">
      <div className="animate-rise mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{ctx.tenant ? "Weiterer Verein" : `Willkommen, ${firstName}!`}</h1>
        <p className="mt-1 text-sm text-ink-3">
          Wo schiesst du? Tritt deinem Verein bei oder lege einen neuen Verein bzw. eine Anlage an. Du kannst später in mehreren Vereinen sein und jederzeit wechseln.
        </p>
      </div>

      <OnboardingForms initialCode={code ?? undefined} codeTenant={codeTenant} />

      <SectionTitle>Rollen im Verein</SectionTitle>
      <Card className="animate-rise divide-y divide-line">
        {TENANT_ROLES.map((r) => (
          <div key={r} className="flex gap-3 px-4 py-3">
            <span className="w-20 shrink-0 text-sm font-semibold">{ROLE_LABELS[r]}</span>
            <span className="text-sm text-ink-3">{ROLE_TEXT[r]}</span>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-xs text-ink-3">Wer beitritt, ist zuerst Mitglied. Admins können Rollen jederzeit unter «Verein» → «Mitglieder» anpassen.</p>
    </div>
  );
}
