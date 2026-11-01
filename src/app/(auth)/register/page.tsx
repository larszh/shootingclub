import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/utils";
import { CalendarDays, Crosshair, Printer, Receipt } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { RegisterForm } from "./form";
import { lookupJoinTenant, normalizeJoinCode } from "../join-code";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shell.common.register") };
}

/** Titel und Text sind Schlüssel im Wörterbuch «shell». */
const FEATURES = [
  { key: "scores", icon: Crosshair },
  { key: "targets", icon: Printer },
  { key: "events", icon: CalendarDays },
  { key: "billing", icon: Receipt },
];

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ code?: string | string[]; next?: string | string[] }> }) {
  const sp = await searchParams;
  const t = getT(await getRequestLocale());
  const code = normalizeJoinCode(sp.code);
  const next = safeNextPath(sp.next);
  // Bereits angemeldet: mit Code direkt zum Beitreten, statt den Code zu verlieren.
  if (await getCurrentUser()) redirect(code ? `/onboarding?force=1&code=${encodeURIComponent(code)}` : (next ?? "/"));
  const tenant = await lookupJoinTenant(code);
  const loginHref = code ? `/login?code=${encodeURIComponent(code)}` : next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="animate-rise [animation-delay:120ms]">
      <h1 className="sr-only">{t("shell.common.register")}</h1>
      {tenant ? (
        <div className="mb-3 flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 animate-pop">
          <Avatar name={tenant.name} src={tenant.logoUrl} size={44} tone="soft" className="rounded-xl" />
          <div className="min-w-0">
            <p className="text-xs text-ink-3">{t("shell.register.joining")}</p>
            <p className="truncate font-semibold">{tenant.name}</p>
            {tenant.city ? <p className="truncate text-xs text-ink-3">{tenant.city}</p> : null}
          </div>
        </div>
      ) : code ? (
        <p className="mb-3 rounded-control bg-warn/10 px-3.5 py-2.5 text-sm text-warn">
          {t("shell.register.unknownCode", { code })}
        </p>
      ) : null}

      {/* Auch ein unbekannter Code wird vorausgefüllt, damit man einen Tippfehler direkt korrigieren kann. */}
      <RegisterForm joinCode={code ?? undefined} joinTenantName={tenant?.name} next={next ?? undefined} />

      <p className="mt-6 text-center text-sm text-ink-3">
        {t("shell.register.already")}{" "}
        <Link href={loginHref} className="font-medium text-ink underline underline-offset-4">{t("shell.common.login")}</Link>
      </p>

      {!tenant ? (
        <section aria-labelledby="teaser" className="mt-8">
          <h2 id="teaser" className="mb-2.5 text-center text-xs font-semibold uppercase tracking-wider text-ink-3">{t("shell.register.teaser")}</h2>
          <ul className="stagger grid grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <li key={f.key} className="rounded-card border border-line bg-surface p-3">
                <f.icon className="h-5 w-5 text-accent" aria-hidden />
                <p className="mt-2 text-sm font-semibold leading-tight">{t(`shell.register.feature.${f.key}.title`)}</p>
                <p className="mt-0.5 text-xs text-ink-3">{t(`shell.register.feature.${f.key}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
