import { describe, expect, it } from "vitest";
import { decideJoin, joinAttempt, joinStatusFor } from "./join-approval";

describe("Beitritt mit Freigabe", () => {
  it("Status beim Beitritt", () => {
    expect(joinStatusFor({ joinApproval: false })).toBe("ACTIVE");
    expect(joinStatusFor({ joinApproval: true })).toBe("PENDING");
  });

  it("Übergänge aus PENDING", () => {
    expect(decideJoin("PENDING", "APPROVE")).toEqual({ ok: true, next: "ACTIVE" });
    expect(decideJoin("PENDING", "REJECT")).toEqual({ ok: true, next: "DELETE" });
    expect(decideJoin("PENDING", "WITHDRAW")).toEqual({ ok: true, next: "DELETE" });
  });

  it("nichts ausser PENDING ist entscheidbar", () => {
    for (const s of ["ACTIVE", "PASSIVE", "LEFT", null, undefined]) {
      expect(decideJoin(s, "APPROVE")).toEqual({ ok: false, error: "notPending" });
      expect(decideJoin(s, "REJECT")).toEqual({ ok: false, error: "notPending" });
    }
    expect(decideJoin("PENDING", "FOO" as never)).toEqual({ ok: false, error: "invalid" });
  });

  it("Beitritt mit bestehender Mitgliedschaft", () => {
    expect(joinAttempt(null, { joinApproval: true })).toEqual({ kind: "create", status: "PENDING" });
    expect(joinAttempt(undefined, { joinApproval: false })).toEqual({ kind: "create", status: "ACTIVE" });
    expect(joinAttempt("PENDING", { joinApproval: true })).toEqual({ kind: "alreadyPending" });
    // Freigabe später ausgeschaltet: offene Anfrage bleibt offen, bis jemand entscheidet
    expect(joinAttempt("PENDING", { joinApproval: false })).toEqual({ kind: "alreadyPending" });
    expect(joinAttempt("LEFT", { joinApproval: false })).toEqual({ kind: "left" });
    expect(joinAttempt("ACTIVE", { joinApproval: true })).toEqual({ kind: "alreadyMember" });
  });
});
