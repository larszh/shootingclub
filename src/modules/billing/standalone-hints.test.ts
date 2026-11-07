import { describe, expect, it } from "vitest";
import { KIOSK_RELEASED_NOTE } from "../kiosk/logic";
import { matchesStandaloneFilter, parseStandaloneFilter, standaloneInvoiceHints, standaloneKind, type StandaloneHintInput } from "./standalone-hints";

const base: StandaloneHintInput = { status: "OPEN", amountCents: 1200, paymentNote: null, payments: [], kind: "kiosk", reopenBlocked: false };
const paid = (review: StandaloneHintInput["payments"][number]["review"] = null) => ({ status: "PAID", provider: "PAYREXX", amountCents: 1200, review });

describe("standaloneKind", () => {
  it("Schützenstube an Einträgen oder Bezeichnung, Ersatzabgabe an der Bezeichnung", () => {
    expect(standaloneKind("Schützenstube Oktober 2026", 0)).toBe("kiosk");
    expect(standaloneKind("Konsumationen", 3)).toBe("kiosk");
    expect(standaloneKind("Ersatzabgabe Arbeitsstunden 2026 (3 h)", 0)).toBe("workfee");
    expect(standaloneKind("Vereinsreise", 0)).toBe("other");
  });
});

describe("standaloneInvoiceHints", () => {
  it("keine Hinweise bei normaler offener Rechnung", () => {
    expect(standaloneInvoiceHints(base)).toEqual([]);
  });

  it("storniert, aber online bezahlt: Rückerstattung", () => {
    const h = standaloneInvoiceHints({ ...base, status: "CANCELLED", payments: [paid()] });
    expect(h[0]).toMatchObject({ tone: "warn" });
    expect(h[0]!.text).toMatch(/zurückerstatten/);
  });

  it("Prüfhinweis der Zahlung wird übernommen", () => {
    const h = standaloneInvoiceHints({ ...base, status: "PAID", payments: [paid({ kind: "REFUND", note: "Online (Payrexx) doppelt bezahlt" })] });
    expect(h[0]!.text).toBe("Rückerstattung prüfen: Online (Payrexx) doppelt bezahlt");
  });

  it("mehrfach bezahlt (online und Bank)", () => {
    const h = standaloneInvoiceHints({ ...base, status: "PAID", payments: [paid()], paymentNote: "Bankimport 03.11.2026: CHF 12.00" });
    expect(h[0]!.text).toMatch(/Mehrfach bezahlt/);
    expect(standaloneInvoiceHints({ ...base, status: "PAID", payments: [paid(), paid()] })[0]!.text).toMatch(/Mehrfach/);
  });

  it("storniert, aber per Bank bezahlt", () => {
    expect(standaloneInvoiceHints({ ...base, kind: "workfee", status: "CANCELLED", paymentNote: "Bankimport 03.11.2026" })[0]!.text).toMatch(/zurücküberweisen/);
  });

  it("freigegebene Konsumationen und noch verknüpfte stornierte Rechnung", () => {
    const released = standaloneInvoiceHints({ ...base, status: "CANCELLED", paymentNote: `${KIOSK_RELEASED_NOTE} 05.11.2026`, reopenBlocked: true });
    expect(released.map((h) => h.tone)).toEqual(["info"]);
    expect(released[0]!.text).toMatch(/bleibt storniert/);
    const linked = standaloneInvoiceHints({ ...base, status: "CANCELLED" });
    expect(linked[0]!.text).toMatch(/freigeben/);
  });

  it("erstattete Online-Zahlung als Info", () => {
    const h = standaloneInvoiceHints({ ...base, kind: "workfee", status: "CANCELLED", payments: [{ ...paid(), status: "REFUNDED" }] });
    expect(h).toEqual([{ tone: "info", text: "Eine Online-Zahlung wurde erstattet." }]);
  });
});

describe("Filter", () => {
  it("parst und filtert", () => {
    expect(parseStandaloneFilter("open")).toBe("open");
    expect(parseStandaloneFilter("x")).toBe("all");
    expect(parseStandaloneFilter(undefined)).toBe("all");
    const warn = { status: "PAID", hints: [{ tone: "warn" as const, text: "x" }] };
    const ok = { status: "OPEN", hints: [] };
    expect(matchesStandaloneFilter("attention", warn)).toBe(true);
    expect(matchesStandaloneFilter("attention", ok)).toBe(false);
    expect(matchesStandaloneFilter("open", ok)).toBe(true);
    expect(matchesStandaloneFilter("paid", warn)).toBe(true);
    expect(matchesStandaloneFilter("cancelled", ok)).toBe(false);
    expect(matchesStandaloneFilter("all", ok)).toBe(true);
  });
});
