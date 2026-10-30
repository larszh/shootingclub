import type { Metadata, Viewport } from "next";
import { DEFAULT_ACCENT } from "@/lib/brand";
import { boardExpired, buildSnapshot, findBoardByToken } from "@/modules/live/service";
import { LiveMessage } from "@/modules/live/ui/live-message";
import { LiveView } from "@/modules/live/ui/live-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Live-Rangliste",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#050607", colorScheme: "dark" };

/**
 * Öffentliche Live-Rangliste für TV/Beamer: ohne Anmeldung, ohne App-Shell.
 * Zugang nur über den geheimen Token; ?ticker=0 blendet die «Letzte Schüsse»-Zeile aus.
 */
export default async function LiveBoardPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ticker?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const board = await findBoardByToken(token);
  if (!board) {
    return <LiveMessage title="Dieser Link ist nicht gültig" text="Die Live-Rangliste gibt es nicht (mehr). Bitte beim Verein den aktuellen Link verlangen." />;
  }
  const logoUrl = board.hasLogo ? `/api/live/${encodeURIComponent(board.token)}/logo?v=${board.logoVersion}` : null;
  if (boardExpired(board)) {
    return <LiveMessage clubName={board.clubName} title="Die Live-Rangliste ist beendet" text="Vielen Dank fürs Mitmachen! Die definitive Rangliste gibt es beim Verein." />;
  }
  const snapshot = await buildSnapshot(board);
  return <LiveView token={board.token} initial={snapshot} brandColor={board.brandColor ?? DEFAULT_ACCENT} logoUrl={logoUrl} showTicker={sp.ticker !== "0"} />;
}
