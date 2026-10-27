import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <div className="animate-rise [animation-delay:120ms]">
      <LoginForm />
      <p className="mt-6 text-center text-sm text-ink-3">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">Registrieren</Link>
      </p>
    </div>
  );
}
