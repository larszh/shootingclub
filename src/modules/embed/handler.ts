import "server-only";
import { NextResponse } from "next/server";
import { getBaseUrl } from "@/modules/events/queries";
import { parsePeriod } from "@/modules/scores/analytics";
import { EVENT_KINDS, kindMeta } from "@/modules/events/types";
import { parseKindFilter } from "./icalendar";
import { parseLimit, parseTheme, WIDGETS, type EmbedTheme, type WidgetKey } from "./logic";
import { verifyEmbed } from "./signing";
import { renderCalendarBody, renderMessagePage, renderRankingBody, renderShell, renderTimesBody } from "./render";
import { embedLogoUrl, findEmbedTenant, isModuleOn, loadCalendar, loadChampionshipRanking, loadProgramRanking, loadTimes } from "./service";

/** Antwort eines Widgets: öffentlich, kurz cachebar, nicht indexieren, keine Cookies. */
function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=300" : "public, max-age=60",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function message(status: number, title: string, text: string, theme: EmbedTheme, appUrl: string) {
  return html(renderMessagePage(title, text, theme, appUrl), status);
}

/**
 * Gemeinsamer Einstieg für /embed/<token>/<widget>. Token muss gültig sein (Verein nicht gelöscht),
 * das Modul aktiv; Rangliste und Meisterschaft zusätzlich mit gültiger Signatur (?sig=).
 */
export async function handleEmbed(req: Request, rawToken: string, widget: WidgetKey) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const theme = parseTheme(sp.get("theme"));
  const appUrl = await getBaseUrl();

  const tenant = await findEmbedTenant(rawToken);
  if (!tenant) return message(404, "Link nicht gültig", "Dieses Widget gibt es nicht (mehr). Bitte beim Verein den aktuellen Code verlangen.", theme, appUrl);

  const meta = WIDGETS[widget];
  if (!(await isModuleOn(tenant.id, meta.module))) return message(404, meta.label, "Dieses Widget ist beim Verein nicht aktiviert.", theme, appUrl);

  const shell = (title: string, subtitle: string | null, body: string, footerNote?: string | null) =>
    html(renderShell({ title, subtitle, clubName: tenant.name, logoUrl: embedLogoUrl(tenant), theme, brandColor: tenant.brandColor, body, appUrl, footerNote: footerNote ?? tenant.name }));
  const now = new Date();

  if (widget === "calendar") {
    const kinds = parseKindFilter(sp.get("kind"), EVENT_KINDS);
    const limit = parseLimit(sp.get("limit"), 8, 1, 30);
    const { items, icalUrl } = await loadCalendar(tenant, { kinds, limit, baseUrl: appUrl, now });
    const subtitle = kinds.length ? kinds.map((k) => kindMeta(k).plural).join(", ") : tenant.name;
    return shell("Nächste Anlässe", subtitle, renderCalendarBody(items, { icalUrl, emptyText: "Zurzeit sind keine Anlässe geplant." }));
  }

  if (widget === "times") {
    const groups = await loadTimes(tenant);
    return shell("Schiesszeiten", tenant.name, renderTimesBody(groups, { emptyText: "Es sind keine Schiesszeiten hinterlegt.", note: "Bewilligte Schiesszeiten der Anlage. Ausnahmen (z.B. Anlässe, Feiertage) sind möglich." }));
  }

  if (widget === "ranking") {
    const program = sp.get("program") ?? "";
    const period = parsePeriod(sp.get("period"));
    if (!verifyEmbed(tenant.token, "ranking", { program, period: sp.get("period") ?? "" }, sp.get("sig"))) {
      return message(403, "Rangliste", "Dieser Code ist nicht freigegeben. Bitte in Standchef unter Verwaltung → Website-Widgets neu erzeugen.", theme, appUrl);
    }
    const board = await loadProgramRanking(tenant, program, period, now);
    if (!board) return message(404, "Rangliste", "Das Programm gibt es nicht mehr.", theme, appUrl);
    return shell(
      `Rangliste ${board.programName}`,
      `${board.periodLabel} · bestes Resultat pro Mitglied`,
      renderRankingBody(board.rows, {
        emptyText: "Im gewählten Zeitraum gibt es noch keine abgeschlossenen Durchgänge.",
        note: board.total > board.rows.length ? `Gezeigt werden die besten ${board.rows.length} von ${board.total}.` : board.max ? `Maximum: ${board.max}` : null,
      }),
    );
  }

  // championship
  const id = sp.get("id") ?? "";
  if (!verifyEmbed(tenant.token, "championship", { id }, sp.get("sig"))) {
    return message(403, "Jahresmeisterschaft", "Dieser Code ist nicht freigegeben. Bitte in Standchef unter Verwaltung → Website-Widgets neu erzeugen.", theme, appUrl);
  }
  const ch = await loadChampionshipRanking(tenant, id);
  if (!ch) return message(404, "Jahresmeisterschaft", "Diese Meisterschaft ist nicht (mehr) veröffentlicht.", theme, appUrl);
  return shell(
    ch.name,
    `Jahresmeisterschaft ${ch.year}`,
    renderRankingBody(ch.rows, {
      emptyText: "Noch niemand ist klassiert.",
      note: ch.unclassified ? `${ch.unclassified} weitere noch nicht klassiert (Pflichtprogramme fehlen).` : null,
    }),
  );
}
