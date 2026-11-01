import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CreditCard,
  Crosshair,
  HelpCircle,
  MessageCircle,
  Package,
  Play,
  Printer,
  Receipt,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { getAppContext, type AppContext, type ActiveTenant } from "@/lib/tenant";
import type { ModuleKey } from "@/lib/modules";
import { isTenantRole } from "@/lib/permissions";
import { INTL_LOCALE, formatDate, formatMoneyLocale, getRequestLocale, getT, type Locale, type TFunction } from "@/lib/i18n";
import { brandColors, contrastRatio } from "@/lib/brand";
import { cn, formatScore, zurichHour } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import {
  Alert,
  Card,
  ChecklistItem,
  EmptyState,
  LinkButton,
  ProgressBar,
  SectionTitle,
  StatCard,
  TargetIllustration,
} from "@/components/ui";
import { listMatches, listPrograms, userStats } from "@/modules/scores/queries";
import { listMyBookings, partitionBookings } from "@/modules/bookings/queries";
import { nowDate } from "@/modules/billing/dates";
import { anyPaymentModule, summarizeMyOpenPayments } from "@/modules/billing/overview";
import { AnnouncementsCard, UpcomingEventsCard } from "@/modules/events/ui/dashboard-cards";
import { listConversations } from "@/modules/chat/queries";
import { canSeeFolder, loadFolderTree } from "@/modules/files/queries";
import { FileTypeIcon } from "@/modules/files/ui/file-icon";
import { PushPrompt } from "@/components/pwa/push-prompt";
import { TwoFactorHint } from "../me/security/hint";
import { ModuleStatusCards } from "./module-cards";

type TenantCtx = AppContext & { tenant: ActiveTenant };

/* ------------------------------------------------------------ Formatierung */

/** Tageszeitabhängiger Gruss in Schweizer Zeit. */
function greetingKey(at: Date = new Date()) {
  const hour = zurichHour(at);
  if (hour >= 5 && hour < 11) return "shell.home.greeting.morning";
  if (hour < 18) return "shell.home.greeting.day";
  return "shell.home.greeting.evening";
}

/** Einzahl/Mehrzahl über zwei Schlüssel mit {count}. */
function countLabel(t: TFunction, n: number, one: string, many: string) {
  return t(n === 1 ? one : many, { count: n });
}

/** Wochentag kurz + Datum, z.B. «Sa., 01.11.2026» bzw. «sam. 01.11.2026». */
function weekdayDate(d: Date, locale: Locale) {
  return formatDate(d, locale, { weekday: "short" });
}

function timeRange(start: Date, end: Date, locale: Locale) {
  const f = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
  return `${f.format(start)}–${f.format(end)}`;
}

/* ---------------------------------------------------------------- Daten */

/**
 * «Weiter wo du warst»: nur eigene offene Durchgänge, nicht alle des Vereins (Trainer).
 * Zuerst die ids der eigenen offenen Durchgänge (im Verein) holen, dann ab dem ältesten
 * davon laden – so fehlen sie auch in sehr aktiven Vereinen nicht.
 */
async function loadOpenMine(ctx: TenantCtx) {
  const mine = await db.match.findMany({
    where: { tenantId: ctx.tenant.id, status: "OPEN", participants: { some: { userId: ctx.user.id } } },
    orderBy: { date: "desc" },
    take: 3,
    select: { id: true, date: true },
  });
  if (!mine.length) return [];
  const ids = new Set(mine.map((m) => m.id));
  const from = mine[mine.length - 1]!.date;
  const open = await listMatches(ctx, { status: "OPEN", from, limit: 100 });
  return open.filter((m) => ids.has(m.id));
}

async function loadScores(ctx: TenantCtx) {
  const [programs, openMine, recent, stats] = await Promise.all([
    listPrograms(ctx),
    loadOpenMine(ctx),
    listMatches(ctx, { status: "FINISHED", limit: 3 }),
    userStats(ctx),
  ]);
  return {
    favorites: programs.filter((p) => p.favorite).slice(0, 4),
    openMine,
    recent,
    stats,
  };
}

/** Ungelesene Chats: nur Unterhaltungen mit neuen Nachrichten (stummgeschaltete zählen nicht). */
async function loadUnreadChats(ctx: TenantCtx) {
  try {
    const list = await listConversations(ctx.user.id, ctx.tenant.id);
    const unread = list.filter((c) => c.unread > 0 && !c.muted);
    return { total: unread.reduce((a, c) => a + c.unread, 0), conversations: unread.slice(0, 3) };
  } catch {
    return { total: 0, conversations: [] };
  }
}

/** Die drei neuesten Dateien, die der Benutzer sehen darf (Ordner-Sichtbarkeit wie in der Dateiablage). */
async function loadNewestFiles(ctx: TenantCtx) {
  const tree = await loadFolderTree(ctx.tenant.id);
  const visibleIds = [...tree.values()].filter((n) => canSeeFolder(n, ctx.tenant.role, ctx.user.isSuperAdmin)).map((n) => n.id);
  const files = await db.storedFile.findMany({
    // Hauptebene (folderId null) sehen alle Mitglieder, Ordner nur gemäss Mindestrolle.
    where: { tenantId: ctx.tenant.id, context: "FILES", OR: [{ folderId: null }, { folderId: { in: visibleIds } }] },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, name: true, mimeType: true, folderId: true, createdAt: true },
  });
  return files.map((f) => ({ ...f, folderName: f.folderId ? (tree.get(f.folderId)?.name ?? null) : null }));
}

/**
 * Der Verlauf (Farbe 1 → Farbe 2) trägt nur eine Textfarbe (accent-ink, passend zu Farbe 1).
 * Reicht deren Kontrast auf Farbe 2 nicht (z.B. Gold + Dunkelblau), einfarbig bleiben.
 */
function gradientReadable(tenant: ActiveTenant) {
  const c = brandColors(tenant.brandColor, tenant.brandColor2);
  if (!c) return true;
  return [c.light, c.dark].every((m) => contrastRatio(m.accentInk, m.accent2) >= Math.min(4.5, contrastRatio(m.accentInk, m.accent)));
}

/** title/text: Schlüssel shell.home.setup.<key>.title/.text */
type SetupItem = { key: string; href: string; done: boolean };

/** Erste Schritte für Admins eines neuen Vereins. Leer, wenn alles erledigt ist. */
async function loadSetupChecklist(ctx: TenantCtx): Promise<SetupItem[]> {
  const tenantId = ctx.tenant.id;
  const bookingsOn = ctx.hasModule("bookings");
  const billingOn = ctx.hasModule("billing") || ctx.hasModule("ammo"); // Munition braucht das Rechnungsprofil ebenso
  const [members, resources, profile] = await Promise.all([
    db.membership.count({ where: { tenantId } }),
    bookingsOn ? db.resource.count({ where: { tenantId } }) : Promise.resolve(0),
    bookingsOn || billingOn ? db.billingProfile.findUnique({ where: { tenantId }, select: { payeeName: true, iban: true } }) : Promise.resolve(null),
  ]);
  const items: SetupItem[] = [
    { key: "brand", href: "/admin", done: !!(ctx.tenant.logoUrl || ctx.tenant.brandColor) },
    { key: "members", href: "/admin/members", done: members >= 2 },
  ];
  // Nur vereinsweite Schritte: Favoriten sind pro Person und gehören nicht in diese Liste
  // (dafür gibt es unten den Schnellstart mit eigenem Hinweis).
  if (bookingsOn) {
    items.push({ key: "resources", href: "/admin/bookings/resources", done: resources > 0 });
  }
  if (bookingsOn || billingOn) {
    items.push({ key: "billing", href: "/admin/billing/settings", done: !!(profile?.payeeName && profile?.iban) });
  }
  return items.every((i) => i.done) ? [] : items;
}

/* --------------------------------------------------------------- Ansicht */

/** label: Schlüssel im Wörterbuch «shell» */
type QuickAction = { module: ModuleKey; href: string; label: string; icon: React.ComponentType<{ className?: string }>; primary?: boolean };

const QUICK_ACTIONS: QuickAction[] = [
  { module: "scores", href: "/scores/matches/new", label: "shell.home.quick.startMatch", icon: Crosshair, primary: true },
  { module: "bookings", href: "/bookings", label: "shell.home.quick.book", icon: CalendarPlus },
  { module: "targets", href: "/targets", label: "shell.home.quick.printTarget", icon: Printer },
  { module: "events", href: "/events", label: "shell.home.quick.events", icon: CalendarDays },
  { module: "billing", href: "/billing", label: "shell.home.quick.fees", icon: Receipt },
  { module: "ammo", href: "/ammo", label: "shell.home.quick.ammo", icon: Package },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ module?: string; denied?: string }> }) {
  const base = await getAppContext();
  if (!base.tenant) redirect("/onboarding");
  const ctx = base as TenantCtx;
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);

  const scoresOn = ctx.hasModule("scores");
  const bookingsOn = ctx.hasModule("bookings");
  const chatOn = ctx.hasModule("chat");
  const filesOn = ctx.hasModule("files");
  const isAdmin = ctx.can("tenant.manage");

  const [scores, nextBookings, invoices, chats, newestFiles] = await Promise.all([
    scoresOn ? loadScores(ctx) : Promise.resolve(null),
    bookingsOn ? listMyBookings(ctx).then((b) => partitionBookings(b).upcoming.slice(0, 2)) : Promise.resolve([]),
    anyPaymentModule(ctx) ? summarizeMyOpenPayments(ctx, nowDate()) : Promise.resolve(null),
    chatOn ? loadUnreadChats(ctx) : Promise.resolve(null),
    filesOn ? loadNewestFiles(ctx) : Promise.resolve([]),
  ]);
  const checklist = isAdmin ? await loadSetupChecklist(ctx) : [];

  const greeting = t(greetingKey());
  const firstName = ctx.user.name.split(" ")[0];
  const actions = QUICK_ACTIONS.filter((a) => ctx.hasModule(a.module));
  const role = ctx.tenant.role && isTenantRole(ctx.tenant.role) ? t(`role.${ctx.tenant.role}`) : ctx.user.isSuperAdmin ? t("shell.me.superAdmin") : null;
  const doneCount = checklist.filter((i) => i.done).length;
  const primaryBg = gradientReadable(ctx.tenant) ? "brand-gradient" : "bg-accent";

  return (
    <div>
      {/* Begrüssung */}
      <div className="animate-rise mb-5 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <Avatar name={ctx.tenant.name} src={ctx.tenant.logoUrl} size={22} tone="soft" className="rounded-md" />
            <span className="truncate">{ctx.tenant.name}</span>
            {role ? <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">{role}</span> : null}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t("shell.home.greetingName", { greeting, name: firstName ?? "" })}
          </h1>
        </div>
        <Link href="/me" aria-label={t("shell.home.myProfile")} className="press shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Avatar name={ctx.user.name} src={ctx.user.avatarUrl} size={52} className="ring-2 ring-surface shadow-sm" />
        </Link>
      </div>

      {sp.module ? (
        <div className="mb-4">
          <Alert tone="warn">{t("shell.home.moduleOff", { club: ctx.tenant.name })}{isAdmin ? <> {t("shell.home.moduleOffAdmin")} <Link href="/admin" className="font-semibold underline underline-offset-2">{t("shell.nav.group.club")}</Link>{t("shell.home.moduleOffAdminEnd")}</> : null}</Alert>
        </div>
      ) : null}
      {sp.denied ? (
        <div className="mb-4">
          <Alert tone="warn">{t("shell.home.denied")}</Alert>
        </div>
      ) : null}

      <PushPrompt className="mb-4" />
      <TwoFactorHint className="mb-4" />

      {/* Schnellaktionen */}
      {actions.length ? (
        <nav aria-label={t("shell.home.quickActions")} className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {actions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                "press group flex min-h-20 flex-col justify-between gap-3 rounded-card border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                a.primary ? cn(primaryBg, "border-transparent text-accent-ink shadow-sm") : "border-line bg-surface hover:border-ink/30",
                a.primary && actions.length % 2 === 1 && i === 0 && "col-span-2 sm:col-span-1",
              )}
            >
              <a.icon className={cn("h-6 w-6", a.primary ? "" : "text-accent")} />
              <span className="flex items-center justify-between gap-2 text-[15px] font-semibold leading-tight">
                {t(a.label)}
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5", a.primary ? "opacity-80" : "text-ink-3")} aria-hidden />
              </span>
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Erste Schritte für Admins */}
      {checklist.length ? (
        <>
          <SectionTitle>{t("shell.home.setup.title")}</SectionTitle>
          <Card className="animate-rise p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t("shell.home.setup.heading", { club: ctx.tenant.name })}</h2>
                <p className="text-sm text-ink-3">{t("shell.home.setup.lead")}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-2">{doneCount}/{checklist.length}</span>
            </div>
            <ProgressBar className="mt-3" value={doneCount} max={checklist.length} label={t("shell.home.setup.progress")} tone="ok" size="sm" />
            <ul className="-mx-2 mt-2">
              {checklist.map((i) => (
                <ChecklistItem key={i.key} done={i.done} href={i.href} title={t(`shell.home.setup.${i.key}.title`)} text={t(`shell.home.setup.${i.key}.text`)} />
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      {/* Offene Rechnungen (Beiträge, Reservationen, Munition) */}
      {invoices && invoices.count > 0 ? (
        <Card className={cn("animate-rise mt-4 overflow-hidden", invoices.overdue > 0 && "border-danger/50")}>
          <Link
            href="/payments"
            className="press flex items-center gap-3 p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", invoices.overdue > 0 ? "bg-danger/12 text-danger" : "bg-accent-soft text-accent")}>
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {countLabel(t, invoices.count, "shell.home.invoices.openOne", "shell.home.invoices.openMany")} · {invoices.totals.map((x) => formatMoneyLocale(x.cents, locale, x.currency)).join(" · ")}
              </div>
              <div className="text-xs text-ink-3">
                {invoices.overdue > 0
                  ? countLabel(t, invoices.overdue, "shell.home.invoices.overdueOne", "shell.home.invoices.overdueMany")
                  : invoices.nextDue
                    ? t("shell.home.invoices.nextDue", { date: formatDate(invoices.nextDue, locale) })
                    : t("shell.home.invoices.scan")}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>
          {invoices.onlinePay ? (
            <div className="border-t border-line px-4 pb-4 pt-3">
              <LinkButton href={invoices.onlinePay.href} prefetch={false} className="w-full">
                <CreditCard className="h-4 w-4" aria-hidden /> {t("shell.home.invoices.payOnline")}
              </LinkButton>
              <p className="mt-1.5 text-center text-xs text-ink-3">
                {invoices.onlinePay.count > 1 ? `${t("shell.home.invoices.feeInvoices", { count: invoices.onlinePay.count })} · ` : ""}
                {t("shell.home.invoices.via", { methods: invoices.onlinePay.methods, provider: invoices.onlinePay.provider })}
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Ungelesene Chats */}
      {chats && chats.total > 0 ? (
        <Link href={chats.conversations.length === 1 ? `/chat/${chats.conversations[0]!.id}` : "/chat"} className="press mt-4 block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Card className="animate-rise flex items-center gap-3 p-4 transition-colors hover:border-ink/30">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{countLabel(t, chats.total, "shell.home.chat.unreadOne", "shell.home.chat.unreadMany")}</div>
              <div className="truncate text-xs text-ink-3">
                {chats.conversations.map((c) => (c.unread > 1 ? `${c.title} (${c.unread})` : c.title)).join(" · ")}
              </div>
            </div>
            <div className="flex shrink-0 -space-x-2" aria-hidden>
              {chats.conversations.map((c) => (
                <Avatar key={c.id} name={c.avatarName} src={c.avatarUrl} size={28} tone="soft" className="ring-2 ring-surface" />
              ))}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Card>
        </Link>
      ) : null}

      {ctx.hasModule("events") ? <AnnouncementsCard ctx={ctx} /> : null}

      {/* Stand, Schicht, Obligatorisch, Meisterschaft: eigene kleine Abfragen, gestreamt */}
      {ctx.hasModule("range") || ctx.hasModule("shifts") || ctx.hasModule("federal") || ctx.hasModule("championship") ? (
        <Suspense fallback={null}>
          <ModuleStatusCards ctx={ctx} locale={locale} />
        </Suspense>
      ) : null}

      {scores ? (
        <>
          {/* Weiter wo du warst */}
          {scores.openMine.length ? (
            <>
              <SectionTitle action={<Link href="/scores/matches?status=OPEN" className="text-xs text-ink-3 hover:text-ink">{t("shell.home.scores.allOpen")}</Link>}>{t("shell.home.scores.continue")}</SectionTitle>
              <div className="stagger space-y-2.5">
                {scores.openMine.map((m) => {
                  const done = m.participants.find((p) => p.userId === ctx.user.id)?.total ?? 0;
                  const decimal = m.program.scoringMode === "RINGS_DECIMAL";
                  return (
                    <Link key={m.id} href={`/scores/matches/${m.id}`} className="press block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                      <Card className="flex items-center gap-3 p-4 transition-colors hover:border-ink/30">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                          <Play className="h-5 w-5 fill-current" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{m.title ?? m.program.name}</div>
                          <div className="truncate text-xs text-ink-3">
                            {formatDate(m.date, locale)} · {m.participants.length > 1 ? m.participants.map((p) => p.name).join(", ") : t("shell.home.scores.alone")}
                          </div>
                          <ProgressBar className="mt-2" size="sm" value={done} max={m.maxScore || 1} label={t("shell.home.scores.progress", { score: formatScore(done, decimal), max: m.maxScore })} />
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-semibold tabular-nums">{formatScore(done, decimal)}</div>
                          <div className="text-[11px] text-ink-3">{t("shell.home.scores.ofMax", { max: m.maxScore })}</div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}

          {/* Favoriten */}
          <SectionTitle action={<Link href="/scores/programs" className="text-xs text-ink-3 hover:text-ink">{t("shell.home.scores.allPrograms")}</Link>}>{t("shell.home.scores.quickStart")}</SectionTitle>
          {scores.favorites.length ? (
            <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {scores.favorites.map((p) => (
                <Link key={p.id} href={`/scores/matches/new?programId=${p.id}`} className="press rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-ink/30">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Star className="h-5 w-5 fill-current" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-ink-3">
                        {t("shell.home.scores.shots", { count: p.totals.shots })} · {countLabel(t, p.stages.length, "shell.home.scores.stageOne", "shell.home.scores.stageMany")}
                      </div>
                    </div>
                    <span className="sr-only">{t("shell.home.quick.startMatch")}</span>
                    <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              illustration={<TargetIllustration size={80} />}
              title={t("shell.home.scores.noFavorites")}
              text={t("shell.home.scores.noFavoritesText")}
              action={<LinkButton href="/scores/programs" variant="secondary" size="sm">{t("shell.home.scores.viewPrograms")}</LinkButton>}
            />
          )}

          {/* Statistik */}
          {scores.stats.matches > 0 ? (
            <>
              <SectionTitle action={<Link href="/scores/stats" className="text-xs text-ink-3 hover:text-ink">{t("shell.home.scores.stats")}</Link>}>{t("shell.home.scores.yourNumbers")}</SectionTitle>
              <div className="stagger grid grid-cols-3 gap-2.5">
                <StatCard label={t("shell.home.scores.matches")} value={scores.stats.matches} href="/scores/matches" />
                <StatCard label={t("shell.home.scores.shotsLabel")} value={scores.stats.totalShots.toLocaleString(INTL_LOCALE[locale])} />
                <StatCard label={t("shell.home.scores.programs")} value={scores.stats.byProgram.length} href="/scores/stats" />
              </div>
              {scores.stats.byProgram.length ? (
                <Card className="animate-rise mt-2.5 divide-y divide-line">
                  {[...scores.stats.byProgram]
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3)
                    .map((p) => (
                      <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                        <Trophy className="h-4 w-4 shrink-0 text-warn" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{p.name}</div>
                          <ProgressBar className="mt-1.5" size="sm" tone="ok" value={p.best} max={p.max || 1} label={t("shell.home.scores.bestOf", { name: p.name })} />
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold tabular-nums">{formatScore(p.best, p.decimal)}</div>
                          <div className="text-[11px] text-ink-3">{t("shell.home.scores.bestOfMax", { max: p.max })}</div>
                        </div>
                      </div>
                    ))}
                </Card>
              ) : null}
            </>
          ) : null}

          {/* Letzte Durchgänge */}
          <SectionTitle action={<Link href="/scores/matches" className="text-xs text-ink-3 hover:text-ink">{t("shell.home.scores.all")}</Link>}>{t("shell.home.scores.recent")}</SectionTitle>
          {scores.recent.length ? (
            <div className="stagger space-y-2.5">
              {scores.recent.map((m) => (
                <Link key={m.id} href={`/scores/matches/${m.id}`} className="press block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <Card className="p-4 transition-colors hover:border-ink/30">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex shrink-0 -space-x-2">
                          {m.participants.slice(0, 3).map((p) => (
                            <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={30} tone={p.isGuest ? "guest" : "soft"} className="ring-2 ring-surface" />
                          ))}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.title ?? m.program.name}</div>
                          <div className="truncate text-xs text-ink-3">
                            {formatDate(m.date, locale)} · {m.participants.map((p) => p.name).join(", ")}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold tabular-nums">
                          {m.participants.length ? formatScore(Math.max(...m.participants.map((p) => p.total)), m.program.scoringMode === "RINGS_DECIMAL") : "–"}
                        </div>
                        <div className="text-[11px] text-ink-3">{t("shell.home.scores.ofMax", { max: m.maxScore })}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : scores.openMine.length ? null : (
            <EmptyState
              icon={<Trophy className="h-5 w-5" />}
              title={t("shell.home.scores.nothingYet")}
              text={t("shell.home.scores.nothingYetText")}
              action={<LinkButton href="/scores/matches/new" size="sm"><Crosshair className="h-4 w-4" /> {t("shell.home.quick.startMatch")}</LinkButton>}
            />
          )}
        </>
      ) : null}

      {ctx.hasModule("events") ? <UpcomingEventsCard ctx={ctx} /> : null}

      {/* Neueste Dateien */}
      {filesOn && newestFiles.length ? (
        <>
          <SectionTitle action={<Link href="/files" className="text-xs text-ink-3 hover:text-ink">{t("shell.me.row.files")}</Link>}>{t("shell.home.files.new")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {newestFiles.map((f) => (
              <Link
                key={f.id}
                href={f.folderId ? `/files?folder=${encodeURIComponent(f.folderId)}` : "/files"}
                className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <FileTypeIcon mimeType={f.mimeType} name={f.name} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="truncate text-xs text-ink-3">
                    {formatDate(f.createdAt, locale)}
                    {f.folderName ? ` · ${f.folderName}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            ))}
          </Card>
        </>
      ) : null}

      {/* Nächste Reservation */}
      {bookingsOn ? (
        <>
          <SectionTitle action={<Link href="/bookings" className="text-xs text-ink-3 hover:text-ink">{t("shell.home.quick.book")}</Link>}>{t("shell.home.bookings.next")}</SectionTitle>
          {nextBookings.length ? (
            <div className="stagger space-y-2.5">
              {nextBookings.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="press block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:border-ink/30">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{b.resource.name}</div>
                      <div className="text-xs text-ink-3">
                        {weekdayDate(b.startsAt, locale)} · {timeRange(b.startsAt, b.endsAt, locale)}
                        {b.status === "PENDING" ? ` · ${t("shell.home.bookings.pending")}` : ""}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title={t("shell.home.bookings.none")}
              text={t("shell.home.bookings.noneText")}
              action={<LinkButton href="/bookings" variant="secondary" size="sm">{t("shell.home.bookings.bookNow")}</LinkButton>}
            />
          )}
        </>
      ) : null}

      {/* Fusszeile */}
      <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
        {isAdmin ? (
          <Link href="/admin/members" className="press flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-accent">
            <Users className="h-5 w-5 text-ink-3" aria-hidden />
            <span className="flex-1 text-sm font-medium">{t("shell.me.row.adminInvite")}</span>
            <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
          </Link>
        ) : null}
        <Link href="/help" className="press flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-accent">
          <HelpCircle className="h-5 w-5 text-ink-3" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t("shell.me.helpFaq")}</span>
          <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
