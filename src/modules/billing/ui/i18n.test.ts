import { describe, expect, it } from "vitest";
import { getT } from "@/lib/i18n/core";
import { localizeMessage, localizeMethods, localizePaymentItem, tPlural } from "./i18n";

describe("money-Sprachhilfen", () => {
  it("tPlural wählt Einzahl oder Mehrzahl", () => {
    const t = getT("fr");
    expect(tPlural(t, "money.payments.invoices", 1)).toBe("1 facture");
    expect(tPlural(t, "money.payments.invoices", 3)).toBe("3 factures");
    expect(tPlural(getT("de"), "money.chat.unread", 2)).toBe("2 ungelesene Nachrichten");
  });

  it("übersetzt bekannte deutsche Meldungen, auch mit Platzhaltern", () => {
    expect(localizeMessage("Der Anlass wurde abgesagt.", "fr")).toBe("L’événement a été annulé.");
    expect(localizeMessage("Der Anlass wurde abgesagt.", "de")).toBe("Der Anlass wurde abgesagt.");
    expect(localizeMessage("Höchstens 4000 Zeichen.", "it")).toBe("Al massimo 4000 caratteri.");
    expect(localizeMessage("Rechnung nicht gefunden.", "it")).toBe("Fattura non trovata.");
    expect(localizeMessage("Etwas ganz anderes", "fr")).toBe("Etwas ganz anderes");
    expect(localizeMessage(null, "fr")).toBeNull();
  });

  it("übersetzt Standardtexte eines Zahlungspostens, Vereinsdaten bleiben", () => {
    const booking = localizePaymentItem({ source: "BOOKING", title: "Reservation Scheibe 3", detail: "Termin 01.11.2026", number: "R-12" }, "fr");
    expect(booking.title).toBe("Réservation Scheibe 3");
    expect(booking.detail).toBe("Date 01.11.2026");
    expect(booking.sourceText).toBe("Réservation");
    const online = localizePaymentItem({ source: "ONLINE", title: "Reservation 50 m", detail: "Termin 01.11.2026 · Stripe", number: "Online" }, "it");
    expect(online.detail).toBe("Data 01.11.2026 · Stripe");
    expect(online.number).toBe("Online");
    const fee = localizePaymentItem({ source: "FEE", sourceLabel: "Mitgliederbeitrag", title: "Mitgliederbeitrag 2026", detail: "Aktiv", number: "B-1" }, "it");
    expect(fee.title).toBe("Quota sociale 2026");
    expect(fee.sourceText).toBe("Quota sociale");
    const run = localizePaymentItem({ source: "FEE", sourceLabel: "Vereinsrechnung", title: "Jahresbeitrag 2026", detail: null, number: "B-2" }, "fr");
    expect(run.title).toBe("Jahresbeitrag 2026");
    expect(run.sourceText).toBe("Facture de la société");
    const ammo = localizePaymentItem({ source: "AMMO", title: "Munition", detail: null, number: "M-1" }, "de");
    expect(ammo.title).toBe("Munition");
    expect(ammo.sourceText).toBe("Munition");
  });

  it("übersetzt «Karte» in der Zahlarten-Liste", () => {
    expect(localizeMethods("TWINT, PostFinance, Karte", "fr")).toBe("TWINT, PostFinance, carte");
    expect(localizeMethods("TWINT, PostFinance, Karte", "de")).toBe("TWINT, PostFinance, Karte");
  });
});
