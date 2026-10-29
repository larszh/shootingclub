import { describe, expect, it } from "vitest";
import { planFeeInvoices, type FeeCandidate } from "./fee-run-plan";

const c = (id: string, over: Partial<FeeCandidate> = {}): FeeCandidate => ({
  membershipId: `m-${id}`, userId: `u-${id}`, name: id, email: `${id}@example.ch`, address: null, status: "ACTIVE",
  categoryId: "cat", categoryName: "Aktiv", amountCents: 5000, householdId: null, invoices: [], ...over,
});
const households = [{ id: "h1", name: "Familie Muster", payerUserId: "u-Vater" }];

describe("planFeeInvoices", () => {
  it("einzelne Mitglieder unverändert, ohne Beitrag, Ausgetretene und bereits Verrechnete übersprungen", () => {
    const plan = planFeeInvoices([
      c("A"), c("B", { amountCents: 0 }), c("C", { status: "LEFT" }), c("D", { invoices: [{ categoryName: "Aktiv" }] }), c("E", { amountCents: null }),
    ], [], true);
    expect(plan.map((p) => p.id)).toEqual(["m-A"]);
    expect(plan[0]).toMatchObject({ categoryName: "Aktiv", amountCents: 5000 });
  });

  it("fasst Haushalte zu einer Rechnung an den Zahler zusammen", () => {
    const members = [
      c("Vater", { householdId: "h1", amountCents: 8000 }),
      c("Kind", { householdId: "h1", amountCents: 2000, categoryId: "jung" }),
      c("Mutter", { householdId: "h1", amountCents: 0 }),
      c("Solo"),
    ];
    const plan = planFeeInvoices(members, households, true);
    expect(plan).toHaveLength(2);
    const hh = plan.find((p) => p.id === "m-Vater")!;
    expect(hh).toMatchObject({ userId: "u-Vater", amountCents: 10000, categoryName: "Familie Muster (2 Mitglieder)", categoryId: null });
  });

  it("ohne Zusammenfassen: jede Person einzeln", () => {
    const plan = planFeeInvoices([c("Vater", { householdId: "h1" }), c("Kind", { householdId: "h1" })], households, false);
    expect(plan.map((p) => p.id).sort()).toEqual(["m-Kind", "m-Vater"]);
  });

  it("Haushalt mit bestehender Haushaltsrechnung wird nicht nochmals verrechnet", () => {
    const plan = planFeeInvoices([
      c("Vater", { householdId: "h1", invoices: [{ categoryName: "Familie Muster (2 Mitglieder)" }] }),
      c("Kind", { householdId: "h1" }),
    ], households, true);
    expect(plan).toEqual([]);
  });

  it("nur ein offenes Haushaltsmitglied: normale Einzelrechnung", () => {
    const plan = planFeeInvoices([c("Vater", { householdId: "h1", invoices: [{ categoryName: "Aktiv" }] }), c("Kind", { householdId: "h1" })], households, true);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: "m-Kind", categoryName: "Aktiv" });
  });

  it("ohne gültigen Zahler: erstes Mitglied mit Beitrag", () => {
    const plan = planFeeInvoices([c("Berta", { householdId: "h1", amountCents: 0 }), c("Anna", { householdId: "h1", amountCents: 0 }), c("Zora", { householdId: "h1" }), c("Yves", { householdId: "h1" })], [{ id: "h1", name: "WG", payerUserId: null }], true);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: "m-Yves", amountCents: 10000 });
  });
});
