import { describe, expect, it } from "vitest";
import { accessStatusWhere, hasTenantAccess, NO_ACCESS_STATUSES } from "./membership-access";

describe("hasTenantAccess", () => {
  it("sperrt ausgetretene und wartende Mitglieder", () => {
    expect(hasTenantAccess("LEFT")).toBe(false);
    expect(hasTenantAccess("PENDING")).toBe(false);
    expect(hasTenantAccess(null)).toBe(false);
    expect(hasTenantAccess("")).toBe(false);
  });
  it("lässt alle übrigen Status zu", () => {
    for (const s of ["ACTIVE", "PASSIVE", "HONORARY", "JUNIOR", "SUPPORTER"]) expect(hasTenantAccess(s)).toBe(true);
  });
  it("liefert den passenden Prisma-Filter", () => {
    expect(accessStatusWhere()).toEqual({ notIn: ["LEFT", "PENDING"] });
    expect(NO_ACCESS_STATUSES).toContain("PENDING");
  });
});
