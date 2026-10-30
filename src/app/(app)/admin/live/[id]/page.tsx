import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ExternalLink } from "lucide-react";
import { Alert, Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { CopyButton } from "@/components/ui/controls";
import { appUrl } from "@/lib/mail";
import { formatDateTimeZurich, formatDateZurich, zurichParts } from "@/lib/time";
import { getLiveBoard, liveFormOptions, nowDate, requireLiveAdmin } from "@/modules/live/admin";
import { isExpired } from "@/modules/live/logic";
import { LiveBoardActions } from "@/modules/live/ui/board-actions";
import { LiveBoardForm } from "@/modules/live/ui/board-form";

export const metadata: Metadata = { title: "Live-Rangliste" };

export default async function LiveBoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireLiveAdmin();
  const { id } = await params;
  const b = await getLiveBoard(ctx.tenant.id, id);
  if (!b) notFound();
  const now = nowDate();
  const expired = isExpired(b.expiresAt, now);
  const url = appUrl(`/live/${b.token}`);
  const [qr, options] = await Promise.all([
    QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 480 }),
    liveFormOptions(ctx.tenant.id, now),
  ]);
  const events = options.events.map((e) => ({ id: e.id, title: e.title, label: `${formatDateZurich(e.startsAt)} · ${e.title}` }));
  // Gewähltes Programm/Anlass auch dann anbieten, wenn es nicht mehr in der Auswahl ist
  const programs = b.programId && !options.programs.some((p) => p.id === b.programId) ? [{ id: b.programId, name: b.programName ?? "Programm" }, ...options.programs] : options.programs;
  if (b.eventId && !events.some((e) => e.id === b.eventId)) events.unshift({ id: b.eventId, title: b.eventTitle ?? "Anlass", label: b.eventTitle ?? "Anlass" });
  const exp = b.expiresAt ? zurichParts(b.expiresAt) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={b.title} subtitle={expired ? "Abgelaufen" : `Aktiv bis ${b.expiresAt ? formatDateTimeZurich(b.expiresAt) : "auf Weiteres"}`} back={{ href: "/admin/live", label: "Live-Rangliste" }} />
      {expired ? <Alert tone="info" className="mb-4">Der Link zeigt nur noch eine Schlussmeldung. Verlängere «Gültig bis», um ihn wieder zu nutzen.</Alert> : null}

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR-Code zur Live-Rangliste" className="h-44 w-44 shrink-0 self-center rounded-control border border-line bg-white p-2" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Geheimer Link</span>
              {expired ? <Badge tone="outline">abgelaufen</Badge> : <Badge tone="ok">aktiv</Badge>}
            </div>
            <p className="mt-1 break-all rounded-control bg-surface-2 px-3 py-2 font-mono text-xs">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={url} label="Link kopieren" copiedMessage="Link kopiert" />
              <LinkButton href={`/live/${b.token}`} target="_blank" rel="noopener noreferrer" variant="secondary" prefetch={false}><ExternalLink className="h-4 w-4" /> Öffnen</LinkButton>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Ohne Anmeldung sichtbar für alle, die den Link kennen. Nur auf dem Bildschirm im Schützenhaus öffnen und nicht öffentlich teilen. Namen erscheinen gekürzt («Vorname N.»), Gäste mit dem erfassten Namen. Mit «?ticker=0» am Ende des Links wird die Zeile «Letzte Schüsse» ausgeblendet.
            </p>
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <LiveBoardActions id={b.id} title={b.title} active={!expired} />
        </div>
      </Card>

      <SectionTitle>Einstellungen</SectionTitle>
      <Card className="p-4">
        <LiveBoardForm
          programs={programs}
          events={events}
          values={{
            id: b.id, title: b.title, programId: b.programId ?? "", eventId: b.eventId ?? "", date: b.day ?? zurichParts(b.createdAt).dateStr,
            showDecimals: b.showDecimals, expiresAt: exp ? `${exp.dateStr}T${exp.timeStr}` : "",
          }}
        />
      </Card>
    </div>
  );
}
