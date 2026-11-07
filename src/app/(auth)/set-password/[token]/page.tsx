import type { Metadata } from "next";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { db } from "@/lib/db";
import { findValidAuthToken } from "@/modules/core/invitations";
import { setInitialPasswordAction } from "@/modules/core/auth-actions";
import { EmptyState, LinkButton } from "@/components/ui";
import { NewPasswordForm } from "../../reset-password/password-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.setPassword.metaTitle"), robots: { index: false } };
}

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findValidAuthToken(token, ["INVITE"]);
  const t = getT(await getRequestLocale());
  if (!row) {
    return (
      <div className="animate-rise">
        <EmptyState
          title={t("shell.reset.invalidTitle")}
          text={t("shell.setPassword.invalidText")}
          action={
            <>
              <LinkButton href="/login">{t("shell.common.login")}</LinkButton>
              <LinkButton href="/forgot-password" variant="secondary">{t("shell.forgot.metaTitle")}</LinkButton>
            </>
          }
        />
      </div>
    );
  }
  const memberships = await db.membership.findMany({
    where: { userId: row.userId, tenant: { deletedAt: null } },
    select: { tenant: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">{t("shell.setPassword.welcome", { name: row.user.name })}</h1>
      <p className="mb-4 text-center text-sm text-ink-3">
        {memberships.length ? <>{t("shell.setPassword.ready", { clubs: memberships.map((m) => t("shell.quoted", { text: m.tenant.name })).join(", ") })} </> : null}
        {t("shell.setPassword.lead")} <span className="font-medium text-ink-2">{row.user.email}</span>{t("shell.setPassword.leadEnd")}
      </p>
      <NewPasswordForm token={token} email={row.user.email} action={setInitialPasswordAction} submitLabel={t("shell.setPassword.submit")} minLength={PASSWORD_MIN_LENGTH} />
      <p className="mt-6 text-center text-sm text-ink-3">
        {t("shell.setPassword.already")}{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">{t("shell.common.login")}</Link>
      </p>
    </div>
  );
}
