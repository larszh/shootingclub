import { describe, expect, it } from "vitest";
import { householdCoverage, planFeeInvoices, type FeeCandidate } from "./fee-run-plan";

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

  it("Bezeichnung der Haushaltsrechnung in der Vereinssprache, Abdeckung sprachunabhängig", () => {
    const plan = planFeeInvoices([c("Vater", { householdId: "h1" }), c("Kind", { householdId: "h1" })], households, true, "fr");
    expect(plan[0]).toMatchObject({ categoryName: "Familie Muster (2 membres)" });
    const cov = householdCoverage([
      c("Vater", { householdId: "h1", invoices: [{ categoryName: "Famiglia Muster (2 membri)", number: "MB-1" }] }),
      c("Kind", { householdId: "h1" }),
    ]);
    expect(cov.get("m-Kind")).toEqual({ number: "MB-1" });
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

  describe("nach einer Haushaltsrechnung (erneuter Lauf, z.B. für Neueintritte)", () => {
    const hhInvoice = [{ categoryName: "Familie Muster (3 Mitglieder)", number: "MB-2027-0006", issuedAt: new Date("2027-02-01T10:00:00Z") }];
    const before = new Date("2027-01-01T00:00:00Z");
    const family = (over: { payer?: Partial<FeeCandidate> } = {}) => [
      c("Vater", { householdId: "h1", amountCents: 15000, createdAt: before, invoices: hhInvoice, ...over.payer }),
      c("Mutter", { householdId: "h1", amountCents: 5000, createdAt: before }),
      c("Kind", { householdId: "h1", amountCents: 2000, createdAt: before }),
    ];

    it("gleicher Zahler: nichts", () => {
      expect(planFeeInvoices(family(), households, true)).toEqual([]);
    });

    it("Zahler gewechselt: nichts (Abdeckung hängt nicht am heutigen Zahler)", () => {
      expect(planFeeInvoices(family(), [{ id: "h1", name: "Familie Muster", payerUserId: "u-Mutter" }], true)).toEqual([]);
    });

    it("«Haushalte zusammenfassen» aus: nichts", () => {
      expect(planFeeInvoices(family(), households, false)).toEqual([]);
    });

    it("Zahler ausgetreten: nichts", () => {
      expect(planFeeInvoices(family({ payer: { status: "LEFT" } }), households, true)).toEqual([]);
      expect(planFeeInvoices(family({ payer: { status: "LEFT" } }), households, false)).toEqual([]);
    });

    it("Neueintritt nach der Rechnung wird einzeln verrechnet", () => {
      const members = [...family(), c("Baby", { householdId: "h1", amountCents: 1000, createdAt: new Date("2027-06-01T00:00:00Z") })];
      const plan = planFeeInvoices(members, households, true);
      expect(plan).toHaveLength(1);
      expect(plan[0]).toMatchObject({ id: "m-Baby", amountCents: 1000 });
    });

    it("liefert die abdeckende Rechnungsnummer", () => {
      const cov = householdCoverage(family());
      expect(cov.get("m-Mutter")).toEqual({ number: "MB-2027-0006" });
      expect(cov.get("m-Kind")).toEqual({ number: "MB-2027-0006" });
      expect(cov.has("m-Vater")).toBe(false);
    });
  });
  describe("Haushaltsrechnung mit festgehaltenen Mitgliedern", () => {
    const before = new Date("2027-01-01T00:00:00Z");
    const inv = { categoryName: "Familie Muster (3 Mitglieder)", number: "MB-2027-0002", issuedAt: new Date("2027-02-01T10:00:00Z"), members: ["m-Zoe", "m-Anna", "m-Max"] };
    const family = () => [
      c("Zoe", { householdId: "h1", createdAt: before, invoices: [inv] }),
      c("Anna", { householdId: "h1", createdAt: before }),
      c("Max", { householdId: "h1", createdAt: before }),
    ];

    it("plan hält die verrechneten Mitgliedschaften fest", () => {
      const plan = planFeeInvoices([c("Vater", { householdId: "h1" }), c("Kind", { householdId: "h1" }), c("Mutter", { householdId: "h1", amountCents: 0 })], households, true);
      expect(plan[0]!.covers?.map((x) => x.membershipId).sort()).toEqual(["m-Kind", "m-Vater"]);
    });

    it("zahlende Person nicht mehr im Haushalt: übrige bleiben abgedeckt", () => {
      const [zoe, anna, max] = family();
      const list = [{ ...zoe!, householdId: null, status: "LEFT" }, anna!, max!];
      expect(planFeeInvoices(list, households, true)).toEqual([]);
      expect(planFeeInvoices(list, households, false)).toEqual([]);
      expect(householdCoverage(list).get("m-Anna")).toEqual({ number: "MB-2027-0002" });
    });

    it("später in den Haushalt aufgenommen (auch langjährig): nicht abgedeckt", () => {
      const list = [...family(), c("Xaver", { householdId: "h1", createdAt: new Date("2020-01-01T00:00:00Z") })];
      expect(householdCoverage(list).has("m-Xaver")).toBe(false);
      expect(planFeeInvoices(list, households, true).map((p) => p.id)).toEqual(["m-Xaver"]);
    });

    it("in einen anderen Haushalt gewechselt: bleibt abgedeckt", () => {
      const [zoe, anna, max] = family();
      expect(householdCoverage([zoe!, { ...anna!, householdId: "h2" }, max!]).get("m-Anna")).toEqual({ number: "MB-2027-0002" });
    });
  });
});
