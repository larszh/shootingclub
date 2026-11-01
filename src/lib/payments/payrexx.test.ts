import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  gatewayParams,
  httpBuildQuery,
  isValidPayrexxInstance,
  mapPayrexxGateway,
  normalizePayrexxInstance,
  parsePaymentMethods,
  parsePayrexxWebhook,
  payrexxSignature,
  phpUrlencode,
  signedQuery,
} from "./payrexx";

describe("phpUrlencode / httpBuildQuery (wie PHP)", () => {
  it("kodiert wie PHP urlencode (Leerzeichen +, ~ und Sonderzeichen kodiert)", () => {
    expect(phpUrlencode("a b~c!*()'ä")).toBe("a+b%7Ec%21%2A%28%29%27%C3%A4");
    expect(phpUrlencode("A-Z_a.z09")).toBe("A-Z_a.z09");
    expect(phpUrlencode("https://x.ch/a?b=1&c")).toBe("https%3A%2F%2Fx.ch%2Fa%3Fb%3D1%26c");
  });

  it("baut Arrays und verschachtelte Objekte mit kodierten Klammern, lässt null aus", () => {
    expect(httpBuildQuery({ amount: 8925, pm: ["twint", "visa"], skip: null, fields: { email: { value: "a@b.ch" } }, flag: true })).toBe(
      "amount=8925&pm%5B0%5D=twint&pm%5B1%5D=visa&fields%5Bemail%5D%5Bvalue%5D=a%40b.ch&flag=1",
    );
    expect(httpBuildQuery({})).toBe("");
  });
});

describe("payrexxSignature", () => {
  const params = { amount: 8925, currency: "CHF", referenceId: "MB-2026-001", purpose: "Mitgliederbeitrag 2026 Ä(M)", pm: ["twint", "postfinance_card"] };
  const expectedQuery = "amount=8925&currency=CHF&referenceId=MB-2026-001&purpose=Mitgliederbeitrag+2026+%C3%84%28M%29&pm%5B0%5D=twint&pm%5B1%5D=postfinance_card";

  it("ergibt base64(HMAC-SHA256(http_build_query, secret)) – bekannter Vektor", () => {
    const q = httpBuildQuery(params);
    expect(q).toBe(expectedQuery);
    // Unabhängig berechnet (Python hmac/hashlib)
    expect(payrexxSignature(q, "secret123")).toBe("9ZmGtF2U1YrNf5pd7+2NJdG8Vlu6tJKOkDbrjco89wo=");
    expect(payrexxSignature(q, "secret123")).toBe(createHmac("sha256", "secret123").update(q).digest("base64"));
  });

  it("signiert leere Parameter (GET) über den leeren String", () => {
    expect(signedQuery({}, "secret123")).toBe("ApiSignature=" + phpUrlencode("D0slhoOjphA4+VVyCiRYlPPvVGL1BFsic19frxWUBT0="));
  });

  it("hängt ApiSignature URL-kodiert an", () => {
    expect(signedQuery(params, "secret123")).toBe(`${expectedQuery}&ApiSignature=9ZmGtF2U1YrNf5pd7%2B2NJdG8Vlu6tJKOkDbrjco89wo%3D`);
  });
});

describe("Gateway-Parameter", () => {
  const input = {
    tenantId: "t1", amountCents: 8000, currency: "chf", reference: "MB-2026-007", description: "Jahresbeitrag 2026",
    successUrl: "https://standchef.ch/ok", cancelUrl: "https://standchef.ch/cancel", customerEmail: "beat@example.ch",
  };
  it("Betrag in Rappen, CHF gross, Redirects, Zahlarten optional", () => {
    const p = gatewayParams(input, []);
    expect(p).toMatchObject({ amount: 8000, currency: "CHF", referenceId: "MB-2026-007", purpose: "Jahresbeitrag 2026", successRedirectUrl: input.successUrl, failedRedirectUrl: input.successUrl, cancelRedirectUrl: input.cancelUrl });
    expect(p.pm).toBeUndefined();
    expect(gatewayParams(input, ["twint"]).pm).toEqual(["twint"]);
    expect(gatewayParams({ ...input, failedUrl: "https://x/f" }, []).failedRedirectUrl).toBe("https://x/f");
  });
  it("Zahlarten und Instanzname normalisieren", () => {
    expect(parsePaymentMethods("TWINT, postfinance_card ; visa  <x>")).toEqual(["twint", "postfinance_card", "visa"]);
    expect(normalizePayrexxInstance("https://SG-Muster.payrexx.com/de/")).toBe("sg-muster");
    expect(isValidPayrexxInstance("sg-muster")).toBe(true);
    expect(isValidPayrexxInstance("evil.com/x")).toBe(false);
  });
});

describe("mapPayrexxGateway", () => {
  it("confirmed = bezahlt, Betrag aus der Transaktion", () => {
    const r = mapPayrexxGateway({ id: 42, status: "confirmed", amount: 8000, currency: "CHF", invoices: [{ currencyAlpha3: "CHF", transactions: [{ status: "confirmed", amount: 8000 }] }] });
    expect(r).toMatchObject({ status: "PAID", amountCents: 8000, currency: "CHF" });
  });
  it("wartend/reserviert = offen, nur abgelehnte = fehlgeschlagen", () => {
    expect(mapPayrexxGateway({ status: "waiting", amount: 100, currency: "CHF" }).status).toBe("PENDING");
    expect(mapPayrexxGateway({ status: "reserved", amount: 100, currency: "CHF" }).status).toBe("PENDING");
    expect(mapPayrexxGateway({ status: "waiting", invoices: [{ transactions: [{ status: "declined" }, { status: "cancelled" }] }] }).status).toBe("FAILED");
    expect(mapPayrexxGateway({ status: "waiting", invoices: [{ transactions: [{ status: "declined" }, { status: "waiting" }] }] }).status).toBe("PENDING");
  });
  it("Betrag unbekannt → null (wird dann nicht verbucht)", () => {
    expect(mapPayrexxGateway({ status: "confirmed" }).amountCents).toBeNull();
  });
});

describe("parsePayrexxWebhook", () => {
  it("liest JSON", () => {
    const raw = JSON.stringify({ transaction: { id: 99, status: "confirmed", referenceId: "MB-1", amount: 8000, invoice: { paymentRequestId: 42, referenceId: "MB-1" } } });
    expect(parsePayrexxWebhook(raw, "application/json")).toEqual({ gatewayId: "42", transactionId: "99", referenceId: "MB-1", status: "confirmed" });
  });
  it("liest Formular-Kodierung mit Klammern", () => {
    const raw = "transaction%5Bid%5D=7&transaction%5Bstatus%5D=confirmed&transaction%5Binvoice%5D%5BpaymentRequestId%5D=123";
    expect(parsePayrexxWebhook(raw, "application/x-www-form-urlencoded")).toMatchObject({ gatewayId: "123", transactionId: "7", status: "confirmed" });
  });
  it("lehnt Unsinn ab und ignoriert nicht numerische Gateway-IDs", () => {
    expect(parsePayrexxWebhook("{kaputt", "application/json")).toBeNull();
    expect(parsePayrexxWebhook(JSON.stringify({ foo: 1 }), "application/json")).toBeNull();
    expect(parsePayrexxWebhook(JSON.stringify({ transaction: { invoice: { paymentRequestId: "../x" } } }), "application/json")?.gatewayId).toBeNull();
    expect(parsePayrexxWebhook("__proto__%5Bpolluted%5D=1&transaction%5Bid%5D=1", null)).toMatchObject({ transactionId: "1" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
