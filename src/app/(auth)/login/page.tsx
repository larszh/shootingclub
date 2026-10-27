import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./form";
import { normalizeJoinCode } from "../join-code";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const code = normalizeJoinCode((await searchParams).code);
  const registerHref = code ? `/register?code=${encodeURIComponent(code)}` : "/register";
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="sr-only">Anmelden</h1>
      {code ? (
        <p className="mb-3 rounded-control bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
          Du hast einen Beitrittscode (<span className="font-mono font-semibold tracking-wider">{code}</span>). Neu hier? Dann registriere dich unten – der Code ist schon eingetragen. Bereits ein Konto? Nach der Anmeldung trittst du unter «Mehr» → «Weiterem Verein beitreten» bei.
        </p>
      ) : null}
      <LoginForm />
      <p className="mt-6 text-center text-sm text-ink-3">
        Noch kein Konto?{" "}
        <Link href={registerHref} className="font-medium text-ink underline underline-offset-4">Registrieren</Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-3">Passwort vergessen? Bitte melde dich bei deinem Vereinsadmin.</p>
    </div>
  );
}
