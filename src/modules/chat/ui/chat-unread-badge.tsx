"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";
import { tPlural } from "@/modules/billing/ui/i18n";
import { chatStreamUserId, subscribeChatStream } from "./stream-client";

/**
 * Zähler ungelesener Chat-Nachrichten für die Navigation.
 * `initial` kommt vom Server (getUnreadChatCount); danach live über den Chat-Stream.
 * Rendert nichts bei 0.
 */
export function ChatUnreadBadge({ initial, className, locale = "de" }: { initial: number; className?: string; locale?: Locale }) {
  const [state, setState] = useState({ initial, count: initial });
  // Neuer Wert vom Server (z.B. nach router.refresh) hat Vorrang.
  if (state.initial !== initial) setState({ initial, count: initial });
  const count = state.initial === initial ? state.count : initial;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const res = await fetch("/api/chat/unread", { cache: "no-store", credentials: "same-origin" });
          if (!res.ok) return;
          const data = (await res.json()) as { count?: number };
          if (alive && typeof data.count === "number") setState((s) => ({ ...s, count: data.count! }));
        } catch {
          // offline: Zähler bleibt stehen
        }
      }, 500);
    };
    const unsubscribe = subscribeChatStream((ev) => {
      const me = chatStreamUserId();
      if (ev.type === "hello" || ev.type === "conversation") refetch();
      else if (ev.type === "message" && ev.message.senderId !== me && !ev.muted) refetch();
      else if (ev.type === "read" && ev.userId === me) refetch();
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums leading-none text-accent-ink", className)}
      aria-label={tPlural(getT(locale), "money.chat.unread", count)}
      role="status"
    >
      {label}
    </span>
  );
}
