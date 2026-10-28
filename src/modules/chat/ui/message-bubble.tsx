"use client";

import { Fragment } from "react";
import { AlertCircle, Clock, FileText, MoreHorizontal } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { DELETED_LABEL, chatFileUrl, formatBytes, isImageMime, type ChatMessageDTO } from "../types";
import { timeLabel } from "./format";

const URL_RE = /(https?:\/\/[^\s<>"]+[^\s<>"'.,:;!?)\]])/g;

/** Text mit klickbaren Links (nur http/https). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all" onClick={(e) => e.stopPropagation()}>
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export type BubbleState = "sent" | "pending" | "queued" | "failed";

export function MessageBubble({
  msg,
  mine,
  showSender,
  showAvatar,
  state = "sent",
  error,
  receipt,
  localFile,
  onOpenActions,
  onRetry,
  onDiscard,
}: {
  msg: ChatMessageDTO;
  mine: boolean;
  /** Name über der Blase (Gruppen, erste Nachricht einer Folge) */
  showSender: boolean;
  /** Avatar-Spalte anzeigen (Gruppen) */
  showAvatar: boolean | "space";
  state?: BubbleState;
  error?: string;
  receipt?: string | null;
  /** Vorschau eines Anhangs, der noch hochgeladen wird */
  localFile?: { name: string; size: number } | null;
  onOpenActions?: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
}) {
  const deleted = !!msg.deletedAt;
  const file = msg.file;
  const image = file && isImageMime(file.mimeType);
  const time = timeLabel(msg.createdAt);

  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", showSender ? "mt-3" : "mt-0.5")}>
      {!mine && showAvatar ? (
        showAvatar === true ? <Avatar name={msg.senderName} src={msg.senderAvatar} size={32} /> : <span className="w-8 shrink-0" aria-hidden />
      ) : null}
      <div className={cn("group relative flex min-w-0 max-w-[82%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        {showSender && !mine ? <span className="mb-0.5 px-3 text-xs font-medium text-ink-3">{msg.senderName}</span> : null}
        <div
          onClick={deleted || state !== "sent" ? undefined : onOpenActions}
          className={cn(
            "relative min-w-0 max-w-full rounded-2xl text-[15px] leading-snug",
            image && !deleted ? "overflow-hidden p-1" : "px-3.5 py-2",
            mine ? "rounded-br-md bg-accent text-accent-ink" : "rounded-bl-md border border-line bg-surface text-ink",
            deleted && "border border-dashed border-line bg-transparent text-ink-3",
            state === "failed" && "opacity-80 ring-2 ring-danger",
            (state === "pending" || state === "queued") && "opacity-75",
            !deleted && state === "sent" && onOpenActions && "cursor-pointer",
          )}
        >
          {deleted ? (
            <span className="italic">{DELETED_LABEL}</span>
          ) : (
            <>
              {file ? (
                image ? (
                  <a href={chatFileUrl(file.id)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chatFileUrl(file.id)} alt={file.name} loading="lazy" decoding="async" className="max-h-72 w-auto max-w-full rounded-xl bg-surface-2 object-contain" />
                  </a>
                ) : (
                  <a
                    href={chatFileUrl(file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={cn("my-0.5 flex min-h-11 max-w-full items-center gap-2.5 rounded-xl px-2.5 py-2", mine ? "bg-black/15" : "bg-surface-2")}
                  >
                    <FileText className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{file.name}</span>
                      <span className={cn("block text-xs", mine ? "opacity-80" : "text-ink-3")}>{formatBytes(file.sizeBytes)}</span>
                    </span>
                  </a>
                )
              ) : localFile ? (
                <span className={cn("my-0.5 flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2", mine ? "bg-black/15" : "bg-surface-2")}>
                  <FileText className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{localFile.name}</span>
                    <span className="block text-xs opacity-80">{formatBytes(localFile.size)}</span>
                  </span>
                </span>
              ) : null}
              {msg.body ? (
                <p className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", image && "px-2.5 pb-1.5 pt-1")}>
                  <Linkified text={msg.body} />
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className={cn("mt-0.5 flex items-center gap-1.5 px-1 text-[11px] tabular-nums text-ink-3", mine ? "flex-row-reverse" : "")}>
          <span>{time}</span>
          {msg.editedAt && !deleted ? <span>· bearbeitet</span> : null}
          {state === "pending" ? (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden /> Wird gesendet…</span>
          ) : state === "queued" ? (
            <span className="inline-flex items-center gap-1 text-warn"><Clock className="h-3 w-3" aria-hidden /> Wartet auf Verbindung</span>
          ) : receipt ? (
            <span>{receipt}</span>
          ) : null}
        </div>
        {state === "failed" ? (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-1 text-sm">
            <span className="inline-flex items-center gap-1 text-danger"><AlertCircle className="h-4 w-4" aria-hidden /> {error ?? "Nicht gesendet"}</span>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="press min-h-11 rounded-control px-3 font-medium text-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
                Erneut senden
              </button>
            ) : null}
            {onDiscard ? (
              <button type="button" onClick={onDiscard} className="press min-h-11 rounded-control px-3 text-ink-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
                Verwerfen
              </button>
            ) : null}
          </div>
        ) : null}
        {!deleted && state === "sent" && onOpenActions ? (
          // Für Tastatur und Screenreader: sichtbar bei Fokus bzw. Hover (Desktop).
          <button
            type="button"
            onClick={onOpenActions}
            aria-label="Aktionen zur Nachricht"
            className={cn(
              "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 opacity-0 hover:bg-surface-2 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent group-hover:opacity-100 [@media(pointer:coarse)]:hidden",
              mine ? "-left-12" : "-right-12",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="sticky top-1 z-[1] my-3 flex justify-center" role="separator" aria-label={label}>
      <span className="rounded-full border border-line bg-surface/90 px-3 py-1 text-xs font-medium text-ink-2 shadow-sm backdrop-blur">{label}</span>
    </div>
  );
}

export function UnreadDivider({ id }: { id?: string }) {
  return (
    <div id={id} className="my-3 flex items-center gap-3 text-xs font-semibold text-accent" role="separator" aria-label="Neue Nachrichten">
      <span className="h-px flex-1 bg-accent/40" />
      Neue Nachrichten
      <span className="h-px flex-1 bg-accent/40" />
    </div>
  );
}
