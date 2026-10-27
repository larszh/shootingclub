import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Registrieren" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <RegisterForm joinCode={code} />
      <p className="mt-6 text-center text-sm text-ink-3">
        Schon registriert?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">Anmelden</Link>
      </p>
    </div>
  );
}
