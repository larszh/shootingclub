import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.forgot.metaTitle") };
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const raw = (await searchParams).email;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const email = v && v.length <= 191 && v.includes("@") ? v : "";
  const t = getT(await getRequestLocale());
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">{t("shell.login.forgot")}</h1>
      <p className="mb-4 text-center text-sm text-ink-3">{t("shell.forgot.lead")}</p>
      <ForgotPasswordForm defaultEmail={email} />
      <p className="mt-6 text-center text-sm text-ink-3">
        {t("shell.forgot.remembered")}{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">{t("shell.auth.toLogin")}</Link>
      </p>
    </div>
  );
}
