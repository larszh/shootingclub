import type { Metadata } from "next";
import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { findValidAuthToken } from "@/modules/core/invitations";
import { resetPasswordAction } from "@/modules/core/auth-actions";
import { EmptyState, LinkButton } from "@/components/ui";
import { NewPasswordForm } from "../password-form";

export const metadata: Metadata = { title: "Neues Passwort", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findValidAuthToken(token, ["RESET"]);
  if (!row) {
    return (
      <div className="animate-rise">
        <EmptyState
          title="Link ungültig oder abgelaufen"
          text="Der Link ist 60 Minuten gültig und funktioniert nur einmal. Fordere einfach einen neuen an."
          action={<LinkButton href="/forgot-password">Neuen Link anfordern</LinkButton>}
        />
        <p className="mt-6 text-center text-sm"><Link href="/login" className="inline-flex min-h-11 items-center text-ink-2 underline underline-offset-4">Zur Anmeldung</Link></p>
      </div>
    );
  }
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">Neues Passwort festlegen</h1>
      <p className="mb-4 text-center text-sm text-ink-3">Für {row.user.email}. Danach wirst du auf allen Geräten abgemeldet und hier direkt angemeldet.</p>
      <NewPasswordForm token={token} email={row.user.email} action={resetPasswordAction} submitLabel="Passwort speichern" minLength={PASSWORD_MIN_LENGTH} />
    </div>
  );
}
