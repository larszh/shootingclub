import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getPendingTwoFactor } from "@/lib/auth";
import { TwoFactorForm } from "./form";

export const metadata: Metadata = { title: "Bestätigungscode" };

export default async function TwoFactorPage() {
  if (await getCurrentUser()) redirect("/");
  const pending = await getPendingTwoFactor();
  if (!pending) redirect("/login");
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">Bestätigungscode</h1>
      <p className="mb-4 text-center text-sm text-ink-3">Öffne deine Authenticator-App und gib den 6-stelligen Code für Standchef ein.</p>
      <TwoFactorForm />
    </div>
  );
}
