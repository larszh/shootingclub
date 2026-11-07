/**
 * Produktwissen für den Hilfe-Assistenten (rein, ohne DB): sichtbare FAQ, Funktionsübersicht
 * aus der Modul-Registry und die Seiten, die die Person öffnen darf. Gleiche Rechteprüfung wie /help.
 */
import { MODULES, type ModuleKey } from "@/lib/modules";
import type { Permission } from "@/lib/permissions";
import { getT } from "@/lib/i18n/core";
import type { Locale } from "@/lib/i18n/locales";
import { blockTexts, type FaqEntry } from "@/app/(app)/help/faq-types";
import { visibleFaq, type FaqAccess } from "@/app/(app)/help/faq-access";

/** Wer fragt (aus dem AppContext). */
export type HelpAccess = FaqAccess & {
  isSuperAdmin: boolean;
  /** Rolle im Verein (null = Super-Admin ohne Mitgliedschaft) */
  role: string | null;
  enabledModules: readonly ModuleKey[];
};

/** Kurzbeschreibung jedes Moduls (Englisch, nur für den Prompt). */
export const MODULE_ABOUT: Record<ModuleKey, string> = {
  scores: "Record shooting results (series, programmes), matches with club mates or guests, statistics, leaderboards, live leaderboard screen.",
  targets: "Printable target templates (A4/A5/A6), own designs.",
  events: "Club calendar (trainings, competitions, obligatory shooting dates), sign up/out, announcements.",
  bookings: "Reserve facilities and lanes, approval, invoice or online payment (not for ammunition).",
  billing: "Membership fees: categories, annual invoices with Swiss QR bill, payment overview, reminders.",
  files: "Document storage with folders and visibility per group.",
  chat: "Direct messages and group chats between club members.",
  ammo: "Order and hand out ammunition; billed only by invoice with QR bill (never paid online); stock and inventory.",
  federal: "Federal exercises (Obligatorisch, Feldschiessen): confirm official results, deadlines, export for SAT-Admin, proof of shooting.",
  range: "Range operations: range log with check-in, guests, range rules, permitted shooting times, half-day quota, incidents.",
  weapons: "Club weapons inventory with loans, shot counter and maintenance.",
  shifts: "Volunteer shifts for events and range duty, work-hour account with replacement fee, qualifications.",
  courses: "Courses (young shooters, J+S, training, qualification shooting) with attendance and mandatory programmes.",
  championship: "Annual club championship with drop results, mandatory programmes, categories and ranking.",
  kiosk: "Clubhouse (Schützenstube): record consumptions and bill them collectively with QR bill.",
  ai: "AI assistant (Claude): help chat, translations, writing help, training tips, reports – with the club's own API key.",
};

export type HelpRoute = {
  href: string;
  /** i18n-Schlüssel für den Menünamen in der Sprache der Person (optional) */
  labelKey?: string;
  about: string;
  /** Mindestens eines dieser Module muss eingeschaltet sein */
  modules?: ModuleKey[];
  permission?: Permission;
  superAdmin?: boolean;
  /** Nur mit aktivem Verein */
  tenant?: boolean;
};

/** Seiten der App, auf die der Assistent verlinken darf (nur wenn die Person sie öffnen kann). */
export const HELP_ROUTES: HelpRoute[] = [
  { href: "/", labelKey: "shell.nav.start", about: "Start page with what is coming up." },
  { href: "/me", labelKey: "shell.nav.more", about: "More: profile, language, appearance, notifications, switch or join another club, sign out, links to admin areas." },
  { href: "/me/notifications", about: "Notification settings (push, e-mail)." },
  { href: "/me/security", about: "Password, two-factor authentication, sessions." },
  { href: "/me/privacy", about: "Privacy: data export, delete account." },
  { href: "/help", labelKey: "shell.common.help", about: "Help: searchable FAQ and this assistant." },
  { href: "/scores", labelKey: "shell.nav.scores", modules: ["scores"], tenant: true, about: "Shooting: start a series, record shots, own results." },
  { href: "/scores/stats", modules: ["scores"], tenant: true, about: "Personal statistics and training trends." },
  { href: "/scores/matches", modules: ["scores"], tenant: true, about: "Matches (competitions within the club or with guests)." },
  { href: "/scores/leaderboard", modules: ["scores"], tenant: true, about: "Leaderboards." },
  { href: "/scores/programs", modules: ["scores"], tenant: true, about: "Shooting programmes." },
  { href: "/scores/import", labelKey: "shell.nav.scoreImport", modules: ["scores"], permission: "match.viewAll", tenant: true, about: "Import results from files (staff)." },
  { href: "/chat", labelKey: "shell.nav.chat", modules: ["chat"], tenant: true, about: "Chat with club members." },
  { href: "/events", labelKey: "shell.nav.events", modules: ["events"], tenant: true, about: "Events and announcements; sign up or out." },
  { href: "/bookings", labelKey: "shell.nav.bookings", modules: ["bookings"], tenant: true, about: "Reserve facilities/lanes, own bookings." },
  { href: "/bookings/history", modules: ["bookings"], tenant: true, about: "Past bookings." },
  { href: "/targets", labelKey: "shell.nav.targets", modules: ["targets"], tenant: true, about: "Print targets." },
  { href: "/files", labelKey: "shell.nav.files", modules: ["files"], tenant: true, about: "Club documents and photos." },
  { href: "/ammo", labelKey: "shell.nav.ammo", modules: ["ammo"], tenant: true, about: "Order ammunition (billed by invoice)." },
  { href: "/payments", labelKey: "shell.nav.payments", modules: ["billing", "bookings", "ammo"], tenant: true, about: "Own invoices and payments (QR bill)." },
  { href: "/federal", labelKey: "shell.nav.federal", modules: ["federal"], tenant: true, about: "Federal exercises: own status, dates, proof of shooting." },
  { href: "/federal/nachweis", modules: ["federal"], tenant: true, about: "Proof of shooting (Schiessnachweis)." },
  { href: "/championship", labelKey: "shell.nav.championship", modules: ["championship"], tenant: true, about: "Annual championship ranking." },
  { href: "/range", labelKey: "shell.nav.range", modules: ["range"], tenant: true, about: "Range: rules, shooting times, range log." },
  { href: "/range/rules", modules: ["range"], tenant: true, about: "Range rules of the club (Standordnung)." },
  { href: "/range/checkin", modules: ["range"], permission: "range.duty", tenant: true, about: "Check shooters in (range duty)." },
  { href: "/shifts", labelKey: "shell.nav.shifts", modules: ["shifts"], tenant: true, about: "Volunteer shifts, sign up, own work hours." },
  { href: "/courses", labelKey: "shell.nav.courses", modules: ["courses"], tenant: true, about: "Courses and attendance." },
  { href: "/weapons", labelKey: "shell.nav.weapons", modules: ["weapons"], permission: "weapons.loan", tenant: true, about: "Club weapons, loans, maintenance." },
  { href: "/kiosk", labelKey: "shell.nav.kiosk", modules: ["kiosk"], tenant: true, about: "Clubhouse: own consumptions." },
  { href: "/members", modules: [], permission: "members.view", tenant: true, about: "Member directory with contact details." },
  { href: "/admin", labelKey: "shell.admin.settings", permission: "tenant.manage", tenant: true, about: "Club settings: modules, logo, colours, join code." },
  { href: "/admin/members", labelKey: "shell.admin.members", permission: "members.view", tenant: true, about: "Manage members, roles, invitations." },
  { href: "/admin/members/requests", labelKey: "shell.admin.requests", permission: "members.approve", tenant: true, about: "Approve membership requests." },
  { href: "/admin/members/import", labelKey: "shell.admin.import", permission: "members.manage", tenant: true, about: "Import members from a spreadsheet." },
  { href: "/admin/members/households", labelKey: "shell.admin.households", permission: "members.manage", tenant: true, about: "Households (shared invoices)." },
  { href: "/admin/events", modules: ["events"], permission: "events.manage", tenant: true, about: "Create and edit events, sign-up lists." },
  { href: "/admin/billing", modules: ["billing"], permission: "tenant.manage", tenant: true, about: "Membership fees: categories, invoice runs, settings." },
  { href: "/admin/bookings", modules: ["bookings"], permission: "tenant.manage", tenant: true, about: "Booking settings: facilities, prices, approval, online payment." },
  { href: "/admin/payments", permission: "tenant.manage", tenant: true, about: "Payment providers and bank account (QR-IBAN)." },
  { href: "/admin/ammo", modules: ["ammo"], permission: "ammo.manage", tenant: true, about: "Ammunition: assortment, hand-out, invoices, inventory." },
  { href: "/admin/files", modules: ["files"], permission: "files.manage", tenant: true, about: "File storage settings and folders." },
  { href: "/admin/range", modules: ["range"], permission: "range.manage", tenant: true, about: "Range rules, shooting times, quota." },
  { href: "/admin/shifts", modules: ["shifts"], permission: "shifts.manage", tenant: true, about: "Plan shifts, confirm hours." },
  { href: "/admin/qualifications", permission: "qualifications.manage", tenant: true, about: "Qualifications of members." },
  { href: "/admin/weapons", modules: ["weapons"], permission: "weapons.manage", tenant: true, about: "Club weapons inventory and maintenance." },
  { href: "/admin/kiosk", labelKey: "shell.admin.kiosk", modules: ["kiosk"], permission: "kiosk.manage", tenant: true, about: "Clubhouse assortment, prices, billing." },
  { href: "/admin/accounting", labelKey: "shell.admin.accounting", permission: "accounting.export", tenant: true, about: "Accounting export and chart of accounts." },
  { href: "/admin/live", labelKey: "shell.nav.live", modules: ["scores"], permission: "match.viewAll", tenant: true, about: "Live leaderboard screen for the clubhouse." },
  { href: "/admin/embed", labelKey: "shell.admin.embed", permission: "tenant.manage", tenant: true, about: "Widgets for the club website." },
  { href: "/admin/association", labelKey: "shell.admin.association", permission: "tenant.manage", tenant: true, about: "Link to the cantonal association." },
  { href: "/admin/audit", labelKey: "shell.admin.audit", permission: "audit.view", tenant: true, about: "Log of changes in the club." },
  { href: "/admin/ai", permission: "ai.manage", tenant: true, about: "AI assistant settings: API key, features, limits." },
  { href: "/super", superAdmin: true, about: "Platform administration (super admin)." },
  { href: "/super/support", superAdmin: true, about: "Platform support assistant (super admin)." },
];

export function routeVisible(r: HelpRoute, access: HelpAccess, hasTenant: boolean): boolean {
  if (r.superAdmin && !access.isSuperAdmin) return false;
  if (r.tenant && !hasTenant) return false;
  if (r.modules && r.modules.length > 0 && !r.modules.some((m) => access.enabledModules.includes(m))) return false;
  if (r.permission && !access.can(r.permission)) return false;
  return true;
}

export type VisibleRoute = { href: string; label: string | null; about: string };

/** Seiten, die die Person öffnen darf, mit Menünamen in ihrer Sprache. */
export function visibleRoutes(access: HelpAccess, locale: Locale, hasTenant: boolean, routes: HelpRoute[] = HELP_ROUTES): VisibleRoute[] {
  const t = getT(locale);
  return routes
    .filter((r) => routeVisible(r, access, hasTenant))
    .map((r) => ({ href: r.href, label: r.labelKey ? t(r.labelKey) : null, about: r.about }));
}

/** Modulübersicht: welche Funktionen im Verein eingeschaltet sind. */
export function moduleOverview(enabledModules: readonly ModuleKey[]): Array<{ key: ModuleKey; on: boolean; about: string }> {
  return MODULES.filter((m) => m.status === "ready").map((m) => ({ key: m.key, on: enabledModules.includes(m.key), about: MODULE_ABOUT[m.key] }));
}

/** FAQ als kompakter Text (Auszeichnung wie im Assistenten: [Text](/pfad), **fett**). */
export function faqAsText(entries: FaqEntry[]): string {
  return entries
    .map((e) => {
      const body = e.a
        .map((b) => {
          if ("p" in b) return b.p;
          const items = blockTexts(b);
          return "ol" in b ? items.map((x, i) => `${i + 1}. ${x}`).join("\n") : items.map((x) => `- ${x}`).join("\n");
        })
        .join("\n");
      return `### ${e.q}\n${body}`;
    })
    .join("\n\n");
}

/** Sichtbare FAQ für die Person (gleiches Rechte-Filter wie die Seite /help). */
export function helpFaq(access: FaqAccess, locale: Locale): FaqEntry[] {
  return visibleFaq(access, locale);
}
