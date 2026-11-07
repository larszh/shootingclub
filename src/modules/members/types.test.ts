import { describe, expect, it } from "vitest";
import { MEMBER_STATUSES, PENDING_LABEL, isMemberStatus, statusLabel, statusTone } from "./types";

describe("Mitgliederstatus", () => {
  it("PENDING hat Beschriftung und Warnton, ist aber nicht zuweisbar", () => {
    expect(statusLabel("PENDING")).toBe(PENDING_LABEL);
    expect(statusLabel("PENDING")).toBe("Wartet auf Freigabe");
    expect(statusTone("PENDING")).toBe("warn");
    expect(isMemberStatus("PENDING")).toBe(false);
    expect((MEMBER_STATUSES as readonly string[]).includes("PENDING")).toBe(false);
  });

  it("bekannte und unbekannte Status", () => {
    expect(statusLabel("LEFT")).toBe("Ausgetreten");
    expect(statusTone("LEFT")).toBe("danger");
    expect(statusLabel("XYZ")).toBe("XYZ");
    expect(statusLabel(null)).toBe("–");
  });
});
