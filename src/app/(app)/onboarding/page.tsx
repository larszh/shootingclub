import type { Metadata } from "next";
import { getAppContext } from "@/lib/tenant";
import { OnboardingForms } from "./forms";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Loslegen" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ force?: string }> }) {
  const ctx = await getAppContext();
  const sp = await searchParams;
  if (ctx.tenant && !sp.force) redirect("/");
  return (
    <div className="max-w-md mx-auto">
      <div className="animate-rise mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Wo schiesst du?</h1>
        <p className="text-ink-3 text-sm mt-1">Tritt deinem Verein bei oder lege einen neuen Verein bzw. eine Anlage an. Du kannst später in mehreren sein.</p>
      </div>
      <OnboardingForms />
    </div>
  );
}
