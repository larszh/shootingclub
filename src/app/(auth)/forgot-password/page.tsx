import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const raw = (await searchParams).email;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const email = v && v.length <= 191 && v.includes("@") ? v : "";
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">Passwort vergessen?</h1>
      <p className="mb-4 text-center text-sm text-ink-3">Kein Problem. Gib deine E-Mail ein – wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</p>
      <ForgotPasswordForm defaultEmail={email} />
      <p className="mt-6 text-center text-sm text-ink-3">
        Doch wieder eingefallen?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">Zur Anmeldung</Link>
      </p>
    </div>
  );
}
