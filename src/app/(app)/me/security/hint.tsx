import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/tenant";
import { roleAtLeast } from "@/lib/permissions";
import { getRequestLocale, getT } from "@/lib/i18n";

/**
 * Sanfte Empfehlung für Admins/Inhaber (und Super-Admins), die Zwei-Faktor-Anmeldung einzuschalten.
 * Server-Komponente; rendert nichts, wenn 2FA aktiv ist oder die Rolle keine Verwaltungsrechte hat.
 *   <TwoFactorHint />  (z.B. auf /admin oder der Startseite)
 */
export async function TwoFactorHint({ className }: { className?: string }) {
  const ctx = await getAppContext();
  const privileged = ctx.user.isSuperAdmin || roleAtLeast(ctx.tenant?.role, "ADMIN");
  if (!privileged) return null;
  const row = await db.user.findUnique({ where: { id: ctx.user.id }, select: { totpEnabledAt: true } });
  if (row?.totpEnabledAt) return null;
  const t = getT(await getRequestLocale());
  return (
    <Link
      href="/me/security"
      className={`animate-rise flex items-start gap-3 rounded-card border border-line bg-surface p-4 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className ?? ""}`}
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium">{t("shell.security.hintTitle")}</span>
        <span className="block text-sm text-ink-3">{t("shell.security.hintText")}</span>
      </span>
    </Link>
  );
}
