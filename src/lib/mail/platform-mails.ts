import "server-only";
import { db } from "@/lib/db";
import { getT, normalizeLocale } from "@/lib/i18n";
import { appUrl, enqueueMail, renderMail } from "./index";

/** Mails der Plattform (Passwort, Einladung, 2FA, Testmail) in der Sprache des Empfängers. */

async function tenantInfo(tenantId: string | null | undefined) {
  if (!tenantId) return null;
  return db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, brandColor: true, defaultLocale: true } });
}

function greet(t: ReturnType<typeof getT>, name: string | null | undefined) {
  return name ? t("mail.greeting", { name }) + "," : t("mail.greetingAnon") + ",";
}

export const RESET_MINUTES = 60;
export const INVITE_DAYS = 14;

export async function mailPasswordReset(u: { email: string; name: string; locale: string }, token: string) {
  const t = getT(u.locale);
  const { html, text } = renderMail({
    locale: u.locale,
    title: t("mail.reset.title"),
    paragraphs: [greet(t, u.name), t("mail.reset.p1"), t("mail.reset.p2", { minutes: RESET_MINUTES }), t("mail.reset.p3")],
    button: { label: t("mail.reset.button"), url: appUrl(`/reset-password/${token}`) },
    footer: t("mail.footer"),
  });
  return enqueueMail({ kind: "reset", to: u.email, toName: u.name, subject: t("mail.reset.subject"), text, html });
}

export async function mailInvitation(o: { tenantId: string; email: string; name?: string | null; role: string; inviterName?: string | null; token: string; days: number }) {
  const tenant = await tenantInfo(o.tenantId);
  const locale = normalizeLocale(tenant?.defaultLocale);
  const t = getT(locale);
  const tenantName = tenant?.name ?? "Standchef";
  const role = t(`role.${o.role}`);
  const { html, text } = renderMail({
    locale,
    title: t("mail.invite.title"),
    tenantName,
    accent: tenant?.brandColor ?? undefined,
    paragraphs: [
      greet(t, o.name),
      o.inviterName ? t("mail.invite.p1", { inviter: o.inviterName, tenant: tenantName }) : t("mail.invite.p1anon", { tenant: tenantName }),
      t("mail.invite.p2", { role }),
      t("mail.invite.p3", { days: o.days }),
    ],
    button: { label: t("mail.invite.button"), url: appUrl(`/invite/${o.token}`) },
    footer: t("mail.footer"),
  });
  return enqueueMail({ tenantId: o.tenantId, kind: "invite", to: o.email, toName: o.name, subject: t("mail.invite.subject", { tenant: tenantName }), text, html });
}

export async function mailSetPassword(o: { tenantId?: string | null; email: string; name: string; locale: string; token: string; days: number }) {
  const tenant = await tenantInfo(o.tenantId);
  const locale = normalizeLocale(o.locale || tenant?.defaultLocale);
  const t = getT(locale);
  const { html, text } = renderMail({
    locale,
    title: t("mail.setPassword.title"),
    tenantName: tenant?.name,
    accent: tenant?.brandColor ?? undefined,
    paragraphs: [
      greet(t, o.name),
      t("mail.setPassword.p1", { tenantPart: tenant ? t("mail.setPassword.tenantPart", { tenant: tenant.name }) : "" }),
      t("mail.setPassword.p2", { email: o.email }),
      t("mail.setPassword.p3", { days: o.days }),
    ],
    button: { label: t("mail.setPassword.button"), url: appUrl(`/set-password/${o.token}`) },
    footer: t("mail.footer"),
  });
  return enqueueMail({
    tenantId: tenant?.id ?? null,
    kind: "set-password",
    to: o.email,
    toName: o.name,
    subject: tenant ? t("mail.setPassword.subject", { tenant: tenant.name }) : t("mail.setPassword.subjectNoTenant"),
    text,
    html,
  });
}

export async function mailSecurityNotice(u: { email: string; name: string; locale: string }, kind: "passwordChanged" | "twofaOn" | "twofaOff") {
  const t = getT(u.locale);
  const paragraphs = [greet(t, u.name), t(`mail.${kind}.p1`)];
  if (kind === "passwordChanged") paragraphs.push(t("mail.passwordChanged.p2"));
  const { html, text } = renderMail({
    locale: u.locale,
    title: t(`mail.${kind}.title`),
    paragraphs,
    button: { label: t("mail.security.button"), url: appUrl("/me/security") },
    footer: t("mail.footer"),
  });
  return enqueueMail({ kind: `security.${kind}`, to: u.email, toName: u.name, subject: t(`mail.${kind}.subject`), text, html });
}

export async function mailTest(u: { email: string; name: string; locale: string }) {
  const t = getT(u.locale);
  const { html, text } = renderMail({
    locale: u.locale,
    title: t("mail.test.title"),
    paragraphs: [greet(t, u.name), t("mail.test.p1")],
    footer: t("mail.footer"),
  });
  return enqueueMail({ kind: "test", to: u.email, toName: u.name, subject: t("mail.test.subject"), text, html });
}
