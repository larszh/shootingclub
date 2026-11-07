import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ExternalLink } from "lucide-react";
import { Alert, Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { CopyButton } from "@/components/ui/controls";
import { appUrl } from "@/lib/mail";
import { zurichParts } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/i18n/core";
import { getLiveBoard, liveFormOptions, nowDate, requireLiveAdmin } from "@/modules/live/admin";
import { isExpired } from "@/modules/live/logic";
import { LiveBoardActions } from "@/modules/live/ui/board-actions";
import { LiveBoardForm } from "@/modules/live/ui/board-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.live.title") };
}

export default async function LiveBoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireLiveAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
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
  const events = options.events.map((e) => ({ id: e.id, title: e.title, label: `${formatDate(e.startsAt, locale, { weekday: "short" })} · ${e.title}` }));
  // Gewähltes Programm/Anlass auch dann anbieten, wenn es nicht mehr in der Auswahl ist
  const programs = b.programId && !options.programs.some((p) => p.id === b.programId) ? [{ id: b.programId, name: b.programName ?? t("adm2.live.program") }, ...options.programs] : options.programs;
  if (b.eventId && !events.some((e) => e.id === b.eventId)) events.unshift({ id: b.eventId, title: b.eventTitle ?? t("adm2.live.event"), label: b.eventTitle ?? t("adm2.live.event") });
  const exp = b.expiresAt ? zurichParts(b.expiresAt) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={b.title} subtitle={expired ? t("adm2.live.expiredSubtitle") : t("adm2.live.activeUntil", { date: b.expiresAt ? formatDateTime(b.expiresAt, locale) : t("adm2.live.untilFurther") })} back={{ href: "/admin/live", label: t("adm2.live.title") }} />
      {expired ? <Alert tone="info" className="mb-4">{t("adm2.live.expiredHint")}</Alert> : null}

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t("adm2.live.qrAlt")} className="h-44 w-44 shrink-0 self-center rounded-control border border-line bg-white p-2" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t("adm2.live.secretLink")}</span>
              {expired ? <Badge tone="outline">{t("adm2.live.expired")}</Badge> : <Badge tone="ok">{t("adm2.live.activeBadge")}</Badge>}
            </div>
            <p className="mt-1 break-all rounded-control bg-surface-2 px-3 py-2 font-mono text-xs">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={url} label={t("adm2.live.copy")} copiedMessage={t("adm2.live.copied")} />
              <LinkButton href={`/live/${b.token}`} target="_blank" rel="noopener noreferrer" variant="secondary" prefetch={false}><ExternalLink className="h-4 w-4" /> {t("adm2.live.open")}</LinkButton>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              {t("adm2.live.linkHint")}
            </p>
          </div>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <LiveBoardActions id={b.id} title={b.title} active={!expired} />
        </div>
      </Card>

      <SectionTitle>{t("adm2.live.settings")}</SectionTitle>
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
