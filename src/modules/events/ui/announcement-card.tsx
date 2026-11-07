import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { formatDate, getT, type Locale } from "@/lib/i18n/core";
import type { AnnouncementView } from "../queries";
import { RichText } from "./bits";

const LONG = 260;

export function AnnouncementCard({ a, compact, children, locale = "de" }: { a: AnnouncementView; compact?: boolean; children?: React.ReactNode; locale?: Locale }) {
  const t = getT(locale);
  const long = a.body.length > LONG;
  return (
    <Card className={cn("p-4", a.pinned && "border-accent/40 bg-accent-soft/40")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", a.pinned ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
          {a.pinned ? <Pin className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="font-semibold leading-snug">{a.title}</h3>
            {a.isExpired ? <span className="text-xs text-ink-3">{t("money.news.expired")}</span> : null}
          </div>
          {compact || !long ? (
            <RichText text={compact && long ? a.body.slice(0, 160).trimEnd() + "…" : a.body} className={cn("mt-1 text-sm text-ink-2", compact && "line-clamp-3")} />
          ) : (
            <details className="group mt-1">
              <summary className="cursor-pointer list-none break-words text-sm text-ink-2 [overflow-wrap:anywhere] [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{a.body.slice(0, LONG).trimEnd()}… <span className="font-medium text-accent">{t("money.news.readMore")}</span></span>
                <span className="hidden group-open:inline text-xs font-medium text-ink-3">{t("money.news.showLess")}</span>
              </summary>
              <RichText text={a.body} className="mt-1 text-sm text-ink-2" />
            </details>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
            {a.authorName ? <Avatar name={a.authorName} src={a.authorAvatarUrl} size={20} tone="soft" /> : null}
            <span>{a.authorName ? `${a.authorName} · ` : ""}{formatDate(a.createdAt, locale)}</span>
          </div>
          {children}
        </div>
      </div>
    </Card>
  );
}
