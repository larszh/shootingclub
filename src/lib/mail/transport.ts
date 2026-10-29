import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP-Versand. Konfiguration über Umgebungsvariablen:
 * SMTP_HOST, SMTP_PORT (587), SMTP_SECURE ("true" für Port 465), SMTP_USER, SMTP_PASS,
 * MAIL_FROM (z.B. "Standchef <noreply@standchef.ch>").
 */
export function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST?.trim();
}

export function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || "Standchef <noreply@standchef.ch>";
}

type Cached = { key: string; transporter: Transporter };
const g = globalThis as { __standchefMailTransport?: Cached };

export function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS ?? "";
  const key = [host, port, secure, user ?? ""].join("|");
  if (g.__standchefMailTransport?.key === key) return g.__standchefMailTransport.transporter;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  g.__standchefMailTransport = { key, transporter };
  return transporter;
}

/** Fehlertext ohne Zugangsdaten (SMTP-Antworten können Benutzernamen enthalten). */
export function safeErrorMessage(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (pass) msg = msg.split(pass).join("***");
  if (user) msg = msg.split(user).join("***");
  return msg.replace(/[\r\n]+/g, " ").slice(0, 500);
}
