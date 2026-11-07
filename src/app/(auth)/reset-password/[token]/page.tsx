import type { Metadata } from "next";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { findValidAuthToken } from "@/modules/core/invitations";
import { resetPasswordAction } from "@/modules/core/auth-actions";
import { EmptyState, LinkButton } from "@/components/ui";
import { NewPasswordForm } from "../password-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.reset.metaTitle"), robots: { index: false } };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findValidAuthToken(token, ["RESET"]);
  const t = getT(await getRequestLocale());
  if (!row) {
    return (
      <div className="animate-rise">
        <EmptyState
          title={t("shell.reset.invalidTitle")}
          text={t("shell.reset.invalidText")}
          action={<LinkButton href="/forgot-password">{t("shell.reset.newLink")}</LinkButton>}
        />
        <p className="mt-6 text-center text-sm"><Link href="/login" className="inline-flex min-h-11 items-center text-ink-2 underline underline-offset-4">{t("shell.auth.toLogin")}</Link></p>
      </div>
    );
  }
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">{t("shell.reset.title")}</h1>
      <p className="mb-4 text-center text-sm text-ink-3">{t("shell.reset.lead", { email: row.user.email })}</p>
      <NewPasswordForm token={token} email={row.user.email} action={resetPasswordAction} submitLabel={t("shell.reset.submit")} minLength={PASSWORD_MIN_LENGTH} />
    </div>
  );
}
