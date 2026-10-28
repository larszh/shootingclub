import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CalendarDays, Crosshair, Printer, Receipt } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { RegisterForm } from "./form";
import { lookupJoinTenant, normalizeJoinCode } from "../join-code";

export const metadata: Metadata = { title: "Registrieren" };

const FEATURES = [
  { icon: Crosshair, title: "Resultate erfassen", text: "Grosses Tastenfeld, auch ohne Empfang im Stand." },
  { icon: Printer, title: "Scheiben drucken", text: "A4/A5/A6 in exakten Massen." },
  { icon: CalendarDays, title: "Anlässe & Reservationen", text: "An- und abmelden, Bahnen buchen." },
  { icon: Receipt, title: "Beiträge mit QR-Rechnung", text: "Scannen und in der Banking-App zahlen." },
];

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const code = normalizeJoinCode((await searchParams).code);
  // Bereits angemeldet: mit Code direkt zum Beitreten, statt den Code zu verlieren.
  if (await getCurrentUser()) redirect(code ? `/onboarding?force=1&code=${encodeURIComponent(code)}` : "/");
  const tenant = await lookupJoinTenant(code);
  const loginHref = code ? `/login?code=${encodeURIComponent(code)}` : "/login";

  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="sr-only">Registrieren</h1>
      {tenant ? (
        <div className="mb-3 flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 animate-pop">
          <Avatar name={tenant.name} src={tenant.logoUrl} size={44} tone="soft" className="rounded-xl" />
          <div className="min-w-0">
            <p className="text-xs text-ink-3">Du trittst bei</p>
            <p className="truncate font-semibold">{tenant.name}</p>
            {tenant.city ? <p className="truncate text-xs text-ink-3">{tenant.city}</p> : null}
          </div>
        </div>
      ) : code ? (
        <p className="mb-3 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
          Der Code «{code}» ist uns nicht bekannt. Prüfe ihn oder registriere dich ohne Code – beitreten kannst du auch später.
        </p>
      ) : null}

      {/* Auch ein unbekannter Code wird vorausgefüllt, damit man einen Tippfehler direkt korrigieren kann. */}
      <RegisterForm joinCode={code ?? undefined} joinTenantName={tenant?.name} />

      <p className="mt-6 text-center text-sm text-ink-3">
        Schon registriert?{" "}
        <Link href={loginHref} className="font-medium text-ink underline underline-offset-4">Anmelden</Link>
      </p>

      {!tenant ? (
        <section aria-labelledby="teaser" className="mt-8">
          <h2 id="teaser" className="mb-2.5 text-center text-xs font-semibold uppercase tracking-wider text-ink-3">Das kann Standchef</h2>
          <ul className="stagger grid grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-card border border-line bg-surface p-3">
                <f.icon className="h-5 w-5 text-accent" aria-hidden />
                <p className="mt-2 text-sm font-semibold leading-tight">{f.title}</p>
                <p className="mt-0.5 text-xs text-ink-3">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
