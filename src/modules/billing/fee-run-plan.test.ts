import { describe, expect, it } from "vitest";
import { deriveHouseholdMembers, feeCoverageStats, householdCountFromLabel, householdCoverage, planFeeInvoices, type FeeCandidate } from "./fee-run-plan";

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

describe("wartende Beitritte (PENDING)", () => {
  it("erhalten keine Rechnung, auch nicht im Haushalt", () => {
    expect(planFeeInvoices([c("A", { status: "PENDING" }), c("B")], [], true).map((p) => p.id)).toEqual(["m-B"]);
    const plan = planFeeInvoices([c("Vater", { householdId: "h1" }), c("Kind", { householdId: "h1", status: "PENDING" })], households, true);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: "m-Vater", categoryName: "Aktiv" });
  });
});

describe("FeeInvoiceMember: festgehaltene Mitglieder", () => {
  it("Haushaltsrechnung mit festgehaltenen Mitgliedern deckt genau diese ab", () => {
    const cov = householdCoverage([
      c("Vater", { householdId: "h1", invoices: [{ categoryName: "Familie Muster (2 Mitglieder)", number: "MB-7", members: ["m-Vater", "m-Kind"] }] }),
      c("Kind", { householdId: "h1" }),
      c("Neu", { householdId: "h1", createdAt: new Date("2020-01-01") }),
    ]);
    expect(cov.get("m-Kind")).toEqual({ number: "MB-7" });
    expect(cov.has("m-Neu")).toBe(false);
  });

  it("liest die Anzahl aus der Bezeichnung (de/fr/it)", () => {
    expect(householdCountFromLabel("Familie Muster (3 Mitglieder)")).toBe(3);
    expect(householdCountFromLabel("Famille Muster (2 membres)")).toBe(2);
    expect(householdCountFromLabel("Famiglia Muster (4 membri)")).toBe(4);
    expect(householdCountFromLabel("Aktiv")).toBeNull();
  });

  it("leitet ältere Haushaltsrechnungen einmalig ab, nur wenn die Anzahl passt", () => {
    const issuedAt = new Date("2026-02-01T10:00:00Z");
    const inv = { id: "i1", membershipId: "m-Vater", categoryName: "Familie Muster (2 Mitglieder)", issuedAt };
    const list = [
      c("Vater", { householdId: "h1", createdAt: new Date("2020-01-01"), invoices: [{ categoryName: inv.categoryName }] }),
      c("Kind", { householdId: "h1", createdAt: new Date("2021-01-01") }),
      c("Später", { householdId: "h1", createdAt: new Date("2026-03-01") }),
      c("Fremd", { householdId: "h2", createdAt: new Date("2020-01-01") }),
    ];
    expect(deriveHouseholdMembers(inv, list)).toEqual(["m-Vater", "m-Kind"]);
    // Zahler ohne eigenen Beitrag: nur die übrigen
    expect(deriveHouseholdMembers({ ...inv, categoryName: "Familie Muster (1 Mitglieder)" }, list)).toEqual(["m-Kind"]);
    // Anzahl passt nicht: keine Ableitung (Schätzung bleibt beim Lesen)
    expect(deriveHouseholdMembers({ ...inv, categoryName: "Familie Muster (5 Mitglieder)" }, list)).toBeNull();
    expect(deriveHouseholdMembers({ ...inv, membershipId: null }, list)).toBeNull();
    expect(deriveHouseholdMembers({ ...inv, categoryName: "Aktiv" }, list)).toBeNull();
  });
});

describe("feeCoverageStats", () => {
  it("Haushaltsmitglieder in einer Haushaltsrechnung zählen nicht als «nicht verrechnet»", () => {
    const stats = feeCoverageStats([
      c("Vater", { householdId: "h1", invoices: [{ categoryName: "Familie Muster (2 Mitglieder)", members: ["m-Vater", "m-Kind"] }] }),
      c("Kind", { householdId: "h1" }),
      c("Solo"),
      c("Bezahlt", { invoices: [{ categoryName: "Aktiv" }] }),
      c("Ohne", { amountCents: null }),
      c("Weg", { status: "LEFT" }),
      c("Wartet", { status: "PENDING" }),
    ]);
    expect(stats).toEqual({ withFee: 4, ownInvoice: 2, household: 1, notInvoiced: 1 });
  });
});
