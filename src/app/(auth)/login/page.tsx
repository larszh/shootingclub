import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/utils";
import { LoginForm } from "./form";
import { normalizeJoinCode } from "../join-code";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ code?: string | string[]; next?: string | string[]; email?: string | string[]; deleted?: string | string[] }> }) {
  const sp = await searchParams;
  const code = normalizeJoinCode(sp.code);
  // Mit Beitrittscode geht es nach der Anmeldung direkt zum Beitreten, sonst zum ursprünglichen Ziel.
  const next = code ? `/onboarding?force=1&code=${encodeURIComponent(code)}` : safeNextPath(sp.next);
  if (await getCurrentUser()) redirect(next ?? "/");
  const inviteNext = next?.startsWith("/invite/") ? next : null;
  const registerHref = code ? `/register?code=${encodeURIComponent(code)}` : inviteNext ? `/register?next=${encodeURIComponent(inviteNext)}` : "/register";
  const rawEmail = Array.isArray(sp.email) ? sp.email[0] : sp.email;
  const defaultEmail = rawEmail && rawEmail.length <= 191 && rawEmail.includes("@") ? rawEmail : undefined;
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="sr-only">Anmelden</h1>
      {sp.deleted ? (
        <p role="status" className="mb-3 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
          Dein Konto wurde gelöscht. Eine Bestätigung ist per E-Mail unterwegs.
        </p>
      ) : null}
      {code ? (
        <p className="mb-3 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
          Du hast einen Beitrittscode (<span className="font-mono font-semibold tracking-wider">{code}</span>). Neu hier? Dann registriere dich unten – der Code ist schon eingetragen. Bereits ein Konto? Dann melde dich an – danach kannst du dem Verein mit diesem Code beitreten.
        </p>
      ) : null}
      <LoginForm next={next ?? undefined} defaultEmail={defaultEmail} />
      <p className="mt-3 text-center text-sm">
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center px-2 text-ink-2 underline underline-offset-4 hover:text-ink">Passwort vergessen?</Link>
      </p>
      <p className="mt-1 text-center text-xs text-ink-3">
        Vom Verein eingetragen und noch nie angemeldet? Setze dein Passwort über den Link in der Einladung oder über «Passwort vergessen?».
      </p>
      <p className="mt-3 text-center text-sm text-ink-3">
        Noch kein Konto?{" "}
        <Link href={registerHref} className="font-medium text-ink underline underline-offset-4">Registrieren</Link>
      </p>
    </div>
  );
}
