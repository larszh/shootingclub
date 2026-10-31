import { describe, expect, it } from "vitest";
import { passRuleChanged, recomputeProgramPasses } from "./pass-recompute";

describe("recomputeProgramPasses", () => {
  it("erkennt geänderte Grenzen", () => {
    expect(passRuleChanged({ passMinScore: 42, passMaxZeros: 3 }, { passMinScore: null, passMaxZeros: null })).toBe(true);
    expect(passRuleChanged({ passMinScore: 42, passMaxZeros: 3 }, { passMinScore: 42, passMaxZeros: 3 })).toBe(false);
    expect(passRuleChanged({ passMinScore: null, passMaxZeros: undefined }, { passMinScore: undefined, passMaxZeros: null })).toBe(false);
  });

  it("setzt «bestanden» der amtlichen Resultate nach der neuen Regel", async () => {
    const rows = [
      { id: "a", total: 144, zeros: 0, passed: true as boolean | null },
      { id: "b", total: 30, zeros: 5, passed: false as boolean | null },
    ];
    const updates: Array<{ id: string; passed: boolean | null }> = [];
    const db = {
      matchParticipant: {
        findMany: async (args: { where: unknown }) => {
          expect(args.where).toEqual({ isOfficial: true, match: { programId: "p1" } });
          return rows;
        },
        update: async (args: { where: { id: string }; data: { passed: boolean | null } }) => {
          updates.push({ id: args.where.id, passed: args.data.passed });
          return {};
        },
      },
    };
    // @ts-expect-error minimaler Ersatz für den Prisma-Client
    expect(await recomputeProgramPasses(db, "p1", { passMinScore: null, passMaxZeros: null })).toBe(2);
    expect(updates).toEqual([{ id: "a", passed: null }, { id: "b", passed: null }]);
    updates.length = 0;
    // @ts-expect-error minimaler Ersatz für den Prisma-Client
    expect(await recomputeProgramPasses(db, "p1", { passMinScore: 150, passMaxZeros: null })).toBe(1);
    expect(updates).toEqual([{ id: "a", passed: false }]);
  });
});
