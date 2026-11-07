import type { TFunction } from "@/lib/i18n/core";

/**
 * Übersetzt bekannte deutsche Meldungen aus Server-Actions, die (noch) nicht selbst übersetzen
 * (Anmeldung/Registrierung in modules/core/auth-actions.ts, Profil in profile-actions.ts,
 * Beitritt in tenant-actions.ts, Drosselung in lib/auth.ts). Unbekannte Meldungen bleiben
 * unverändert – so geht nie eine Information verloren, wenn sich ein Text ändert.
 * Rein (ohne React), damit sie in Client-Komponenten und Tests nutzbar ist.
 */
export const SERVER_MESSAGE_KEYS: Record<string, string> = {
  // Anmeldung und Registrierung
  "Bitte Eingaben prüfen.": "shell.msg.checkInput",
  "Bitte E-Mail und Passwort eingeben.": "shell.msg.enterEmailPassword",
  "E-Mail oder Passwort stimmt nicht.": "shell.msg.wrongCredentials",
  "Ungültige E-Mail": "shell.msg.invalidEmail",
  "Passwort fehlt": "shell.msg.passwordMissing",
  "Mindestens 2 Zeichen": "shell.msg.min2",
  "Höchstens 200 Zeichen": "shell.msg.max200",
  "Diese E-Mail ist bereits registriert. Bitte melde dich an oder nutze «Passwort vergessen».": "shell.msg.emailTaken",
  "Bereits registriert": "shell.msg.alreadyRegistered",
  "Beitrittscode nicht gefunden.": "shell.msg.joinCodeNotFound",
  "Unbekannter Code": "shell.msg.unknownCode",
  "Code fehlt.": "shell.msg.codeMissingDot",
  // Zwei-Faktor beim Anmelden
  "Die Anmeldung ist abgelaufen. Bitte erneut mit E-Mail und Passwort anmelden.": "shell.msg.loginExpiredFull",
  "Die Anmeldung ist abgelaufen. Bitte erneut anmelden.": "shell.msg.loginExpired",
  "Bitte den Code eingeben.": "shell.msg.enterCode",
  "Code fehlt": "shell.msg.codeMissing",
  "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.": "shell.msg.wrongTotp",
  "Falscher Code": "shell.msg.wrongCodeShort",
  "Dieser Wiederherstellungscode ist ungültig oder wurde bereits verwendet.": "shell.msg.invalidRecovery",
  "Ungültiger Code": "shell.msg.invalidCodeShort",
  // Passwort vergessen / zurücksetzen
  "Falls ein Konto mit dieser E-Mail existiert, ist ein Link unterwegs. Bitte schau auch im Spam-Ordner nach. Der Link ist 60 Minuten gültig.": "shell.msg.resetSent",
  "Bitte eine gültige E-Mail eingeben.": "shell.msg.enterValidEmail",
  "Die Passwörter stimmen nicht überein": "shell.msg.passwordsDiffer",
  "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.": "shell.msg.linkInvalid",
  "Dieser Link wurde bereits verwendet.": "shell.msg.linkUsed",
  // Einladungen
  "Diese Einladung gibt es nicht (mehr).": "shell.msg.inviteMissing",
  "Diese Einladung wurde bereits angenommen.": "shell.msg.inviteAccepted",
  "Diese Einladung ist abgelaufen. Bitte den Vorstand um eine neue.": "shell.msg.inviteExpired",
  "Die Einladung konnte nicht angenommen werden. Bitte Seite neu laden.": "shell.msg.inviteFailed",
  // Profil
  "Speichern fehlgeschlagen. Bitte nochmals versuchen.": "shell.msg.saveFailed",
  "Profilbild gespeichert.": "shell.msg.avatarSaved",
  "Profilbild entfernt.": "shell.msg.avatarRemoved",
  "Ungültige Auswahl": "shell.msg.invalidChoice",
  "Bitte ein gültiges Geburtsdatum eingeben.": "shell.msg.invalidBirthDate",
  "Ungültiges Datum": "shell.msg.invalidDate",
  "Gespeichert.": "shell.common.saved",
  "Name: mindestens 2 Zeichen": "shell.msg.nameMin",
  "Name zu lang": "shell.msg.nameLong",
  "Telefon: höchstens 40 Zeichen": "shell.msg.phoneLong",
  "Telefon: nur Ziffern, Leerzeichen und + ( ) / . -": "shell.msg.phoneChars",
  "Strasse zu lang": "shell.msg.streetLong",
  "PLZ zu lang": "shell.msg.zipLong",
  "Ort zu lang": "shell.msg.cityLong",
  // Beitritt
  "Deine Mitgliedschaft in diesem Verein ist beendet. Bitte wende dich an den Vorstand.": "members.left.noAccess",
};

const PATTERNS: Array<{ re: RegExp; key: string; vars: (m: RegExpMatchArray) => Record<string, string | number> }> = [
  { re: /^Zu viele Versuche\. Bitte in (\d+) Minuten? erneut versuchen\.$/, key: "shell.msg.throttle", vars: (m) => ({ minutes: Number(m[1]) }) },
  { re: /^Mindestens (\d+) Zeichen$/, key: "shell.msg.minChars", vars: (m) => ({ count: Number(m[1]) }) },
  { re: /^Diese Einladung gilt für (.+)\. Bitte melde dich mit dieser Adresse an\.$/, key: "shell.msg.inviteOtherEmail", vars: (m) => ({ email: m[1] ?? "" }) },
];

/** Übersetzt eine Meldung, wenn sie bekannt ist; sonst unverändert. */
export function translateServerMessage(message: string | null | undefined, t: TFunction): string {
  if (!message) return "";
  const key = SERVER_MESSAGE_KEYS[message];
  if (key) return t(key);
  for (const p of PATTERNS) {
    const m = message.match(p.re);
    if (m) {
      if (p.key === "shell.msg.throttle" && Number(m[1]) === 1) return t("shell.msg.throttleOne");
      return t(p.key, p.vars(m));
    }
  }
  return message;
}

/** Feldfehler (Record) übersetzen. */
export function translateFieldErrors(fe: Record<string, string> | undefined, t: TFunction): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fe ?? {})) out[k] = translateServerMessage(v, t);
  return out;
}
