import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { findInvitation } from "@/modules/core/invitations";
import { tenantLogoUrl } from "@/components/avatar";
import { TenantLogo } from "@/components/logo";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { LoginForm } from "../../login/form";
import { RegisterForm } from "../../register/form";
import { AcceptInvitationButton, SwitchAccountButton } from "./buttons";

export const metadata: Metadata = { title: "Einladung", robots: { index: false } };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { token } = await params;
  const { mode } = await searchParams;
  const inv = await findInvitation(token);
  const user = await getCurrentUser();

  if (!inv || inv.state !== "open") {
    const title = !inv ? "Einladung nicht gefunden" : inv.state === "accepted" ? "Einladung bereits angenommen" : "Einladung abgelaufen";
    const text = !inv
      ? "Der Link ist ungültig. Prüfe, ob er vollständig kopiert wurde, oder bitte den Vorstand um eine neue Einladung."
      : inv.state === "accepted"
        ? "Diese Einladung wurde schon verwendet. Melde dich einfach an."
        : "Einladungen sind 14 Tage gültig. Bitte den Vorstand, dir eine neue zu schicken.";
    return (
      <div className="animate-rise">
        <EmptyState title={title} text={text} action={<LinkButton href={user ? "/" : "/login"}>{user ? "Zur Startseite" : "Anmelden"}</LinkButton>} />
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[inv.role as TenantRole] ?? inv.role;
  const header = (
    <Card className="mb-4 flex items-center gap-3 p-4 animate-pop">
      <TenantLogo src={tenantLogoUrl({ id: inv.tenantId, logoPath: inv.tenantLogoPath, updatedAt: inv.tenantUpdatedAt })} size={48} />
      <div className="min-w-0">
        <p className="text-xs text-ink-3">Einladung als {roleLabel}</p>
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
        <h1 className="sr-only">Einladung annehmen</h1>
        {header}
        {sameEmail ? (
          <Card className="p-5">
            <p className="text-sm text-ink-2">
              Angemeldet als <span className="font-medium text-ink">{user.name}</span> ({user.email}).
              {already ? " Du bist bereits Mitglied – mit der Einladung wird deine Rolle bei Bedarf angepasst." : " Mit einem Tipp bist du dabei."}
            </p>
            <AcceptInvitationButton token={token} label={already ? "Einladung annehmen" : "Beitreten"} />
          </Card>
        ) : (
          <Card className="p-5">
            <p className="font-semibold">Diese Einladung gilt für eine andere E-Mail</p>
            <p className="mt-1 text-sm text-ink-2">
              Du bist als <span className="font-medium">{user.email}</span> angemeldet, die Einladung ging an <span className="font-medium">{inv.email}</span>.
              Melde dich ab und mit der eingeladenen Adresse an (oder registriere dich damit).
            </p>
            <SwitchAccountButton token={token} />
            <p className="mt-3 text-xs text-ink-3">Möchtest du mit deinem jetzigen Konto beitreten? Dann bitte den Vorstand, die Einladung an {user.email} zu schicken.</p>
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
      <h1 className="sr-only">Einladung annehmen</h1>
      {header}
      {showLogin ? (
        <>
          <p className="mb-3 text-sm text-ink-2">Melde dich mit deinem Konto an, danach trittst du dem Verein mit einem Tipp bei.</p>
          <LoginForm next={next} defaultEmail={inv.email} />
          <p className="mt-3 text-center text-sm">
            <Link href={`/forgot-password?email=${encodeURIComponent(inv.email)}`} className="inline-flex min-h-11 items-center px-2 text-ink-2 underline underline-offset-4">Passwort vergessen?</Link>
          </p>
          {!hasAccount ? (
            <p className="mt-1 text-center text-sm text-ink-3">
              Noch kein Konto? <Link href={`/invite/${token}?mode=register`} className="inline-flex min-h-11 items-center px-1 font-medium text-ink underline underline-offset-4">Registrieren</Link>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">Erstelle dein Konto – du trittst «{inv.tenantName}» danach direkt bei.</p>
          <RegisterForm invite={token} defaultEmail={inv.email} defaultName={inv.name ?? ""} submitLabel="Konto erstellen & beitreten" />
          <p className="mt-4 text-center text-sm text-ink-3">
            Schon ein Konto? <Link href={`/invite/${token}?mode=login`} className="inline-flex min-h-11 items-center px-1 font-medium text-ink underline underline-offset-4">Anmelden</Link>
          </p>
        </>
      )}
    </div>
  );
}
