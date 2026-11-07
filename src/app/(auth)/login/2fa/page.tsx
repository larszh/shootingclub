import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getPendingTwoFactor } from "@/lib/auth";
import { TwoFactorForm } from "./form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.twofa.title") };
}

export default async function TwoFactorPage() {
  const t = getT(await getRequestLocale());
  if (await getCurrentUser()) redirect("/");
  const pending = await getPendingTwoFactor();
  if (!pending) redirect("/login");
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">{t("shell.twofa.title")}</h1>
      <p className="mb-4 text-center text-sm text-ink-3">{t("shell.twofa.lead")}</p>
      <TwoFactorForm />
    </div>
  );
}
