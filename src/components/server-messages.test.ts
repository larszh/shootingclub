import { describe, expect, it } from "vitest";
import { getT } from "@/lib/i18n/core";
import { SERVER_MESSAGE_KEYS, translateFieldErrors, translateServerMessage } from "./server-messages";

describe("translateServerMessage", () => {
  const fr = getT("fr");
  const de = getT("de");

  it("übersetzt bekannte Meldungen und lässt unbekannte stehen", () => {
    expect(translateServerMessage("E-Mail oder Passwort stimmt nicht.", fr)).toBe("L’e-mail ou le mot de passe est incorrect.");
    expect(translateServerMessage("Etwas ganz Neues", fr)).toBe("Etwas ganz Neues");
    expect(translateServerMessage(undefined, fr)).toBe("");
  });

  it("Deutsch bleibt wortgleich", () => {
    for (const msg of Object.keys(SERVER_MESSAGE_KEYS)) expect(translateServerMessage(msg, de)).toBe(msg);
  });

  it("Muster mit Werten", () => {
    expect(translateServerMessage("Zu viele Versuche. Bitte in 5 Minuten erneut versuchen.", fr)).toBe("Trop de tentatives. Merci de réessayer dans 5 minutes.");
    expect(translateServerMessage("Zu viele Versuche. Bitte in 1 Minute erneut versuchen.", getT("it"))).toBe("Troppi tentativi. Riprova tra 1 minuto.");
    expect(translateServerMessage("Mindestens 8 Zeichen", getT("it"))).toBe("Almeno 8 caratteri");
    expect(translateServerMessage("Diese Einladung gilt für a@b.ch. Bitte melde dich mit dieser Adresse an.", fr)).toContain("a@b.ch");
  });

  it("jeder Schlüssel existiert im Wörterbuch", () => {
    for (const key of Object.values(SERVER_MESSAGE_KEYS)) expect(fr(key)).not.toBe(key);
  });

  it("übersetzt Feldfehler", () => {
    expect(translateFieldErrors({ email: "Ungültige E-Mail" }, fr)).toEqual({ email: "E-mail invalide" });
    expect(translateFieldErrors(undefined, fr)).toEqual({});
  });
});
