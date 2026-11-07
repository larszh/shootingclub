import { describe, expect, it } from "vitest";
import { can as canPerm, type Permission } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/modules";
import { MODULES } from "@/lib/modules";
import { FAQ_SOURCES, faqVisible, visibleFaq } from "@/app/(app)/help/faq-access";
import { HELP_ROUTES, MODULE_ABOUT, faqAsText, moduleOverview, visibleRoutes, type HelpAccess } from "./knowledge";

function access(role: string | null, modules: ModuleKey[], isSuperAdmin = false): HelpAccess {
  const can = (p: Permission) => canPerm({ isSuperAdmin, role }, p);
  return { isAdmin: can("tenant.manage"), can, isSuperAdmin, role, enabledModules: modules };
}

describe("FAQ permission filter (same as /help)", () => {
  it("members see member entries only", () => {
    const a = access("MEMBER", []);
    const entries = visibleFaq(a, "de");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.audience === "member")).toBe(true);
  });

  it("trainers additionally see entries unlocked by a staff permission", () => {
    const member = visibleFaq(access("MEMBER", []), "de").map((e) => e.id);
    const trainer = visibleFaq(access("TRAINER", []), "de").map((e) => e.id);
    expect(trainer.length).toBeGreaterThan(member.length);
    expect(trainer).toContain("standbuch");
    expect(member).not.toContain("standbuch");
    // aber keine reinen Admin-Anleitungen ohne Einzelrecht
    const adminOnly = FAQ_SOURCES.filter((e) => e.audience === "admin" && !faqVisible(e, access("TRAINER", []))).map((e) => e.id);
    expect(adminOnly.length).toBeGreaterThan(0);
    for (const id of adminOnly) expect(trainer).not.toContain(id);
  });

  it("admins see everything", () => {
    expect(visibleFaq(access("ADMIN", []), "de").length).toBe(FAQ_SOURCES.length);
  });

  it("uses the requested locale and falls back to German", () => {
    const fr = visibleFaq(access("MEMBER", []), "fr");
    const de = visibleFaq(access("MEMBER", []), "de");
    expect(fr[0]!.q).not.toBe(de[0]!.q);
    const en = visibleFaq(access("MEMBER", []), "en");
    expect(en.length).toBe(de.length);
  });
});

describe("visibleRoutes", () => {
  it("filters by module, permission, tenant and super admin", () => {
    const member = visibleRoutes(access("MEMBER", ["scores", "events"]), "de", true).map((r) => r.href);
    expect(member).toContain("/scores");
    expect(member).toContain("/events");
    expect(member).not.toContain("/bookings");
    expect(member).not.toContain("/admin");
    expect(member).not.toContain("/admin/ai");
    expect(member).not.toContain("/super/support");
    expect(member).not.toContain("/scores/import");

    const admin = visibleRoutes(access("ADMIN", ["bookings"]), "de", true).map((r) => r.href);
    expect(admin).toContain("/admin");
    expect(admin).toContain("/admin/bookings");
    expect(admin).toContain("/admin/ai");
    expect(admin).not.toContain("/admin/kiosk");

    const noTenant = visibleRoutes(access(null, [], true), "de", false).map((r) => r.href);
    expect(noTenant).toContain("/super/support");
    expect(noTenant).not.toContain("/scores");
  });

  it("labels routes in the user's language", () => {
    const de = visibleRoutes(access("MEMBER", ["bookings"]), "de", true).find((r) => r.href === "/bookings");
    const fr = visibleRoutes(access("MEMBER", ["bookings"]), "fr", true).find((r) => r.href === "/bookings");
    expect(de?.label).toBe("Buchen");
    expect(fr?.label).toBe("Réserver");
  });

  it("only lists safe internal paths", () => {
    for (const r of HELP_ROUTES) expect(r.href).toMatch(/^\/[a-z0-9/-]*$/);
  });
});

describe("module overview", () => {
  it("describes every module and marks enabled ones", () => {
    for (const m of MODULES) expect(MODULE_ABOUT[m.key]).toBeTruthy();
    const o = moduleOverview(["scores"]);
    expect(o.find((m) => m.key === "scores")?.on).toBe(true);
    expect(o.find((m) => m.key === "bookings")?.on).toBe(false);
  });

  it("renders FAQ entries as compact text with lists", () => {
    const txt = faqAsText([{ id: "x", audience: "member", q: "Frage?", a: [{ p: "Text" }, { ol: ["a", "b"] }, { ul: ["c"] }], search: "" }]);
    expect(txt).toBe("### Frage?\nText\n1. a\n2. b\n- c");
  });
});
