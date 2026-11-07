import { describe, expect, it } from "vitest";
import {
  associationAccess,
  associationTransition,
  canManageClubs,
  canReadAggregates,
  clubTransition,
  hasAnyAssociationAccess,
  nameSharingClubIds,
  normalizeAssociationCode,
  readableClubIds,
  sharesAggregates,
  sharesNames,
  type MemberLinkLite,
} from "./access";

const assoc = { id: "a1", deletedAt: null };
const deletedAssoc = { id: "a1", deletedAt: new Date("2026-01-01") };
const consent = new Date("2026-03-01");

function link(p: Partial<MemberLinkLite> & { tenantId: string }): MemberLinkLite {
  return { status: "APPROVED", consentAt: consent, shareNames: false, tenantDeletedAt: null, ...p };
}

describe("associationAccess", () => {
  it("gibt Super-Admins immer Zugang, auch zu gelöschten Verbänden", () => {
    expect(associationAccess({ isSuperAdmin: true }, assoc, [])).toBe("SUPER");
    expect(associationAccess({ isSuperAdmin: true }, deletedAssoc, [])).toBe("SUPER");
  });
  it("gibt Verbandsadmins ihre Rolle nur für den eigenen Verband", () => {
    expect(associationAccess({ isSuperAdmin: false }, assoc, [{ associationId: "a1", role: "ADMIN" }])).toBe("ADMIN");
    expect(associationAccess({ isSuperAdmin: false }, assoc, [{ associationId: "a1", role: "VIEWER" }])).toBe("VIEWER");
    expect(associationAccess({ isSuperAdmin: false }, assoc, [{ associationId: "a2", role: "ADMIN" }])).toBeNull();
  });
  it("sperrt gelöschte Verbände, unbekannte Rollen und fehlende Verbände", () => {
    expect(associationAccess({ isSuperAdmin: false }, deletedAssoc, [{ associationId: "a1", role: "ADMIN" }])).toBeNull();
    expect(associationAccess({ isSuperAdmin: false }, assoc, [{ associationId: "a1", role: "OWNER" }])).toBeNull();
    expect(associationAccess({ isSuperAdmin: false }, null, [{ associationId: "a1", role: "ADMIN" }])).toBeNull();
  });
  it("unterscheidet Lesen und Verwalten", () => {
    expect(canManageClubs("SUPER")).toBe(true);
    expect(canManageClubs("ADMIN")).toBe(true);
    expect(canManageClubs("VIEWER")).toBe(false);
    expect(canManageClubs(null)).toBe(false);
    expect(canReadAggregates("VIEWER")).toBe(true);
    expect(canReadAggregates(null)).toBe(false);
  });
  it("zeigt den Navigationseintrag nur mit gültiger Rolle", () => {
    expect(hasAnyAssociationAccess({ isSuperAdmin: false }, [])).toBe(false);
    expect(hasAnyAssociationAccess({ isSuperAdmin: false }, [{ associationId: "a1", role: "X" }])).toBe(false);
    expect(hasAnyAssociationAccess({ isSuperAdmin: false }, [{ associationId: "a1", role: "VIEWER" }])).toBe(true);
    expect(hasAnyAssociationAccess({ isSuperAdmin: true }, [])).toBe(true);
  });
});

describe("Datenfreigabe", () => {
  it("teilt Kennzahlen nur bei APPROVED mit Zustimmung und aktivem Verein", () => {
    expect(sharesAggregates(link({ tenantId: "t1" }))).toBe(true);
    expect(sharesAggregates(link({ tenantId: "t1", status: "PENDING" }))).toBe(false);
    expect(sharesAggregates(link({ tenantId: "t1", status: "REVOKED" }))).toBe(false);
    expect(sharesAggregates(link({ tenantId: "t1", consentAt: null }))).toBe(false);
    expect(sharesAggregates(link({ tenantId: "t1", tenantDeletedAt: new Date() }))).toBe(false);
  });
  it("teilt Namen nur zusätzlich mit shareNames", () => {
    expect(sharesNames(link({ tenantId: "t1", shareNames: true }))).toBe(true);
    expect(sharesNames(link({ tenantId: "t1", shareNames: false }))).toBe(false);
    expect(sharesNames(link({ tenantId: "t1", shareNames: true, status: "REVOKED" }))).toBe(false);
  });
  it("liefert lesbare Vereine nur mit Zugang", () => {
    const members = [
      link({ tenantId: "t1", shareNames: true }),
      link({ tenantId: "t2" }),
      link({ tenantId: "t3", status: "PENDING", shareNames: true }),
      link({ tenantId: "t4", status: "REVOKED" }),
      link({ tenantId: "t5", tenantDeletedAt: new Date(), shareNames: true }),
    ];
    expect(readableClubIds("VIEWER", members)).toEqual(["t1", "t2"]);
    expect(nameSharingClubIds("ADMIN", members)).toEqual(["t1"]);
    expect(readableClubIds(null, members)).toEqual([]);
    expect(nameSharingClubIds(null, members)).toEqual([]);
  });
});

describe("Statuswechsel", () => {
  it("erlaubt dem Verein Anfrage und Austritt", () => {
    expect(clubTransition(null, "request")).toEqual({ ok: true, status: "PENDING" });
    expect(clubTransition("REVOKED", "request")).toEqual({ ok: true, status: "PENDING" });
    expect(clubTransition("PENDING", "request").ok).toBe(false);
    expect(clubTransition("APPROVED", "request").ok).toBe(false);
    expect(clubTransition("APPROVED", "leave")).toEqual({ ok: true, status: "REVOKED" });
    expect(clubTransition("PENDING", "leave")).toEqual({ ok: true, status: "REVOKED" });
    expect(clubTransition("REVOKED", "leave").ok).toBe(false);
    expect(clubTransition(null, "leave").ok).toBe(false);
  });
  it("erlaubt dem Verband Freigabe, Ablehnung und Entfernen", () => {
    expect(associationTransition("PENDING", "approve")).toEqual({ ok: true, status: "APPROVED" });
    expect(associationTransition("APPROVED", "approve").ok).toBe(false);
    expect(associationTransition("REVOKED", "approve").ok).toBe(false);
    expect(associationTransition("PENDING", "reject")).toEqual({ ok: true, status: "REVOKED" });
    expect(associationTransition("APPROVED", "reject").ok).toBe(false);
    expect(associationTransition("APPROVED", "remove")).toEqual({ ok: true, status: "REVOKED" });
    expect(associationTransition("PENDING", "remove").ok).toBe(false);
  });
});

describe("normalizeAssociationCode", () => {
  it("normalisiert und prüft Codes", () => {
    expect(normalizeAssociationCode(" ksv-zh 12 ")).toBe("KSVZH12");
    expect(normalizeAssociationCode("ABCD1234")).toBe("ABCD1234");
    expect(normalizeAssociationCode("ABC")).toBeNull();
    expect(normalizeAssociationCode("ABCDEFGHI")).toBeNull();
    expect(normalizeAssociationCode("ÄBCD")).toBeNull();
    expect(normalizeAssociationCode(null)).toBeNull();
  });
});
