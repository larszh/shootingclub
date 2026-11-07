"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, MessageCirclePlus, Paperclip, Search, Shield, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EmptyState, Input, LinkButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import type { ConversationListItem } from "../queries";
import { chatTitle, listTimeLabel, useNow } from "./format";
import { tPlural } from "@/modules/billing/ui/i18n";
import { flushOutbox, useOutbox } from "./outbox";
import { subscribeChatStream } from "./stream-client";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ConversationAvatar({ item, size = 48 }: { item: Pick<ConversationListItem, "kind" | "isClub" | "avatarUrl" | "avatarName">; size?: number }) {
  if (item.kind === "GROUP") {
    const Icon = item.isClub ? Shield : Users;
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full", item.isClub ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent")} style={{ width: size, height: size }} aria-hidden>
        <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
      </span>
    );
  }
  return <Avatar name={item.avatarName} src={item.avatarUrl} size={size} />;
}

/** Chat-Übersicht mit Suche, Live-Aktualisierung und ungelesenen Zählern. */
export function ConversationList({ userId, items, locale = "de" }: { userId: string; items: ConversationListItem[]; locale?: Locale }) {
  const t = getT(locale);
  const router = useRouter();
  const now = useNow();
  const outbox = useOutbox(userId);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [live, setLive] = useState({ base: items, list: items });
  if (live.base !== items) setLive({ base: items, list: items });
  const list = live.base === items ? live.list : items;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const knownIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    knownIds.current = new Set(list.map((c) => c.id));
  }, [list]);

  useEffect(() => {
    const refreshSoon = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    };
    const unsubscribe = subscribeChatStream((ev) => {
      if (ev.type === "hello" || ev.type === "conversation") return refreshSoon();
      if (ev.type === "read") {
        if (ev.userId !== userId) return;
        setLive((s) => ({ ...s, list: s.list.map((c) => (c.id === ev.conversationId ? { ...c, unread: 0 } : c)) }));
        return;
      }
      if (ev.type !== "message") return;
      const m = ev.message;
      if (!knownIds.current.has(ev.conversationId)) return refreshSoon();
      setLive((s) => {
        const isNew = !m.editedAt && !m.deletedAt;
        const next = s.list.map((c) => {
          if (c.id !== ev.conversationId) return c;
          const latest = !c.lastMessageAt || m.createdAt >= c.lastMessageAt;
          return {
            ...c,
            unread: isNew && m.senderId !== userId ? c.unread + 1 : c.unread,
            lastMessageAt: latest ? m.createdAt : c.lastMessageAt,
            preview: latest
              ? { text: m.body ? m.body.slice(0, 140) : (m.file?.name ?? ""), senderName: m.senderName, mine: m.senderId === userId, deleted: !!m.deletedAt, hasFile: !!m.file }
              : c.preview,
          };
        });
        next.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
        return { ...s, list: next };
      });
    });
    return () => {
      clearTimeout(refreshTimer.current);
      unsubscribe();
    };
  }, [router, userId]);

  // Wartende Nachrichten senden, sobald die Liste offen ist bzw. die Verbindung zurück ist.
  useEffect(() => {
    void flushOutbox(userId);
    const onOnline = () => void flushOutbox(userId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  const filtered = useMemo(() => {
    const q = normalize(deferred.trim());
    if (!q) return list;
    return list.filter((c) => normalize(c.title).includes(q) || normalize(c.preview?.text ?? "").includes(q));
  }, [list, deferred]);

  const pendingByConv = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of outbox) map.set(e.conversationId, (map.get(e.conversationId) ?? 0) + 1);
    return map;
  }, [outbox]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <LinkButton href="/chat/new" variant="primary">
          <MessageCirclePlus className="h-5 w-5" aria-hidden /> {t("money.chat.newMessage")}
        </LinkButton>
        <LinkButton href="/chat/new-group" variant="secondary">
          <Users className="h-5 w-5" aria-hidden /> {t("money.chat.newGroup")}
        </LinkButton>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<MessageCirclePlus className="h-6 w-6" />}
          title={t("money.chat.empty.title")}
          text={t("money.chat.empty.text")}
        />
      ) : (
        <>
          <div className="relative mb-3">
            <label htmlFor="chat-search" className="sr-only">{t("money.chat.searchLabel")}</label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input id="chat-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("money.chat.search")} className="pl-10" autoComplete="off" enterKeyHint="search" />
          </div>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">{t("money.chat.noneFound")}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {filtered.map((c) => (
                <li key={c.id}>
                  <ConversationRow item={c} now={now} pending={pendingByConv.get(c.id) ?? 0} t={t} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ConversationRow({ item: c, now, pending, t, locale }: { item: ConversationListItem; now: number; pending: number; t: TFunction; locale: Locale }) {
  const unread = c.unread > 0;
  const preview = c.preview;
  let text: React.ReactNode = <span className="italic">{t("money.chat.noMessages")}</span>;
  if (preview) {
    const prefix = preview.mine ? t("money.chat.youPrefix") : c.kind === "GROUP" && preview.senderName ? `${preview.senderName.split(" ")[0]}: ` : "";
    if (preview.deleted) text = <span className="italic">{t("money.chat.deleted")}</span>;
    else
      text = (
        <>
          {prefix}
          {preview.hasFile ? <Paperclip className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-label={t("money.chat.attachment")} /> : null}
          {preview.text || (preview.hasFile ? t("money.chat.attachment") : "")}
        </>
      );
  }
  return (
    <Link
      href={`/chat/${c.id}`}
      className="press flex min-h-[72px] items-center gap-3 px-4 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <ConversationAvatar item={c} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-[15px]", unread ? "font-semibold" : "font-medium")}>{chatTitle(c.title, locale)}</span>
          <span className={cn("shrink-0 text-xs tabular-nums", unread ? "font-semibold text-accent" : "text-ink-3")}>{listTimeLabel(c.lastMessageAt, now, locale)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "text-ink" : "text-ink-3")}>
            {pending > 0 ? <span className="text-warn">{t("money.chat.sending")} · </span> : null}
            {text}
          </span>
          {c.muted ? <BellOff className="h-4 w-4 shrink-0 text-ink-3" aria-label={t("money.chat.muted")} /> : null}
          {unread ? (
            <span
              className={cn("inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums", c.muted ? "bg-surface-2 text-ink-2" : "bg-accent text-accent-ink")}
              aria-label={tPlural(t, "money.chat.unread", c.unread)}
            >
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
