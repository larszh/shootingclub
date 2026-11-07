import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findInvitation } from "@/modules/core/invitations";
import { tenantLogoUrl } from "@/components/avatar";
import { TenantLogo } from "@/components/logo";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { LoginForm } from "../../login/form";
import { RegisterForm } from "../../register/form";
import { AcceptInvitationButton, SwitchAccountButton } from "./buttons";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.invite.metaTitle"), robots: { index: false } };
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { token } = await params;
  const { mode } = await searchParams;
  const inv = await findInvitation(token);
  const user = await getCurrentUser();
  const t = getT(await getRequestLocale());

  if (!inv || inv.state !== "open") {
    const title = !inv ? t("shell.invite.notFound") : inv.state === "accepted" ? t("shell.invite.accepted") : t("shell.invite.expired");
    const text = !inv ? t("shell.invite.notFoundText") : inv.state === "accepted" ? t("shell.invite.acceptedText") : t("shell.invite.expiredText");
    return (
      <div className="animate-rise">
        <EmptyState title={title} text={text} action={<LinkButton href={user ? "/" : "/login"}>{user ? t("shell.common.toHome") : t("shell.common.login")}</LinkButton>} />
      </div>
    );
  }

  const roleKey = `role.${inv.role}`;
  const roleLabel = t(roleKey) === roleKey ? inv.role : t(roleKey);
  const header = (
    <Card className="mb-4 flex items-center gap-3 p-4 animate-pop">
      <TenantLogo src={tenantLogoUrl({ id: inv.tenantId, logoPath: inv.tenantLogoPath, updatedAt: inv.tenantUpdatedAt })} size={48} />
      <div className="min-w-0">
        <p className="text-xs text-ink-3">{t("shell.invite.as", { role: roleLabel })}</p>
        <p className="truncate text-lg font-semibold leading-tight">{inv.tenantName}</p>
        {inv.tenantCity ? <p className="truncate text-xs text-ink-3">{inv.tenantCity}</p> : null}
      </div>
    </Card>
  );

  if (user) {
    const sameEmail = user.email.toLowerCase() === inv.email;
    const already = user.memberships.some((m) => m.tenantId === inv.tenantId);
    return (
      <div className="animate-rise [animation-delay:120ms]">
        <h1 className="sr-only">{t("shell.invite.accept")}</h1>
        {header}
        {sameEmail ? (
          <Card className="p-5">
            <p className="text-sm text-ink-2">
              {t("shell.invite.loggedInAs")} <span className="font-medium text-ink">{user.name}</span> ({user.email}).{" "}
              {already ? t("shell.invite.alreadyMember") : t("shell.invite.oneTap")}
            </p>
            <AcceptInvitationButton token={token} label={already ? t("shell.invite.accept") : t("shell.invite.join")} />
          </Card>
        ) : (
          <Card className="p-5">
            <p className="font-semibold">{t("shell.invite.otherEmail")}</p>
            <p className="mt-1 text-sm text-ink-2">
              {t("shell.invite.otherEmailText", { current: user.email, invited: inv.email })}
            </p>
            <SwitchAccountButton token={token} />
            <p className="mt-3 text-xs text-ink-3">{t("shell.invite.otherEmailHint", { email: user.email })}</p>
          </Card>
        )}
      </div>
    );
  }

  const existing = await db.user.findUnique({ where: { email: inv.email }, select: { id: true, deletedAt: true } });
  const hasAccount = !!existing && !existing.deletedAt;
  const showLogin = mode === "login" || (mode !== "register" && hasAccount);
  const next = `/invite/${token}`;

  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="sr-only">{t("shell.invite.accept")}</h1>
      {header}
      {showLogin ? (
        <>
          <p className="mb-3 text-sm text-ink-2">{t("shell.invite.loginLead")}</p>
          <LoginForm next={next} defaultEmail={inv.email} />
          <p className="mt-3 text-center text-sm">
            <Link href={`/forgot-password?email=${encodeURIComponent(inv.email)}`} className="inline-flex min-h-11 items-center px-2 text-ink-2 underline underline-offset-4">{t("shell.login.forgot")}</Link>
          </p>
          {!hasAccount ? (
            <p className="mt-1 text-center text-sm text-ink-3">
              {t("shell.login.noAccount")} <Link href={`/invite/${token}?mode=register`} className="inline-flex min-h-11 items-center px-1 font-medium text-ink underline underline-offset-4">{t("shell.common.register")}</Link>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">{t("shell.invite.registerLead", { club: inv.tenantName })}</p>
          <RegisterForm invite={token} defaultEmail={inv.email} defaultName={inv.name ?? ""} submitLabel={t("shell.register.submitJoin")} />
          <p className="mt-4 text-center text-sm text-ink-3">
            {t("shell.invite.haveAccount")} <Link href={`/invite/${token}?mode=login`} className="inline-flex min-h-11 items-center px-1 font-medium text-ink underline underline-offset-4">{t("shell.common.login")}</Link>
          </p>
        </>
      )}
    </div>
  );
}
