import type { Metadata } from "next";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { db } from "@/lib/db";
import { findValidAuthToken } from "@/modules/core/invitations";
import { setInitialPasswordAction } from "@/modules/core/auth-actions";
import { EmptyState, LinkButton } from "@/components/ui";
import { NewPasswordForm } from "../../reset-password/password-form";

export const metadata: Metadata = { title: "Passwort festlegen", robots: { index: false } };

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findValidAuthToken(token, ["INVITE"]);
  if (!row) {
    return (
      <div className="animate-rise">
        <EmptyState
          title="Link ungültig oder abgelaufen"
          text="Hast du schon ein Passwort festgelegt? Dann melde dich einfach an. Sonst kannst du über «Passwort vergessen» einen neuen Link anfordern."
          action={
            <>
              <LinkButton href="/login">Anmelden</LinkButton>
              <LinkButton href="/forgot-password" variant="secondary">Passwort vergessen</LinkButton>
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
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">Willkommen, {row.user.name}</h1>
      <p className="mb-4 text-center text-sm text-ink-3">
        {memberships.length ? <>Dein Konto bei {memberships.map((m) => `«${m.tenant.name}»`).join(", ")} ist bereit. </> : null}
        Lege jetzt dein Passwort fest. Du meldest dich danach mit <span className="font-medium text-ink-2">{row.user.email}</span> an.
      </p>
      <NewPasswordForm token={token} email={row.user.email} action={setInitialPasswordAction} submitLabel="Passwort festlegen & loslegen" minLength={PASSWORD_MIN_LENGTH} />
      <p className="mt-6 text-center text-sm text-ink-3">
        Schon ein Passwort?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">Anmelden</Link>
      </p>
    </div>
  );
}
