"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, Bell, BellOff, Check, Copy, Info, Paperclip, Pencil, SendHorizontal, Trash2, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useOnlineStatus } from "@/components/ui/controls";
import { Dialog, confirmDialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { getT, type Locale } from "@/lib/i18n/core";
import { localizeMessage, tPlural } from "@/modules/billing/ui/i18n";
import { deleteMessageAction, editMessageAction, setMutedAction } from "../actions";
import type { ConversationDetail, PickerMember } from "../queries";
import { EDIT_WINDOW_MS, MAX_MESSAGE_LENGTH, type ChatMessageDTO, type ChatReadDTO, type MessagesResponse } from "../types";
import { ConversationAvatar } from "./conversation-list";
import { chatTitle, dayKey, dayLabel, useNow } from "./format";
import { GroupInfoSheet } from "./group-info-sheet";
import { DayDivider, MessageBubble, UnreadDivider, type BubbleState } from "./message-bubble";
import { addToOutbox, deliverEntry, flushOutbox, newClientId, onDelivered, removeFromOutbox, retryEntry, useOutbox } from "./outbox";
import { subscribeChatStream, useChatStreamStatus } from "./stream-client";

type Upload = { clientId: string; file: File; createdAt: string; status: "uploading" | "failed"; error?: string };

/** Nachrichten zusammenführen (nach id), aufsteigend nach Zeit sortiert. */
function mergeMessages(list: ChatMessageDTO[], incoming: ChatMessageDTO[]) {
  if (!incoming.length) return list;
  const map = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
}

function readsToMap(reads: ChatReadDTO[]) {
  const out: Record<string, string> = {};
  for (const r of reads) out[r.userId] = r.lastReadAt;
  return out;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const NEAR_BOTTOM_PX = 96;
const LOAD_OLDER_PX = 240;
const MAX_TEXTAREA_PX = 160;

type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "unread"; key: string }
  | {
      kind: "msg";
      key: string;
      msg: ChatMessageDTO;
      mine: boolean;
      showSender: boolean;
      showAvatar: boolean | "space";
      state: BubbleState;
      error?: string;
      receipt?: string | null;
      localFile?: { name: string; size: number } | null;
      retry?: () => void;
      discard?: () => void;
    };

export function ConversationView({
  me,
  detail,
  tenantMembers,
  canManageClub,
  locale = "de",
}: {
  me: { id: string; name: string; avatarUrl: string | null };
  detail: ConversationDetail;
  tenantMembers: PickerMember[];
  canManageClub: boolean;
  locale?: Locale;
}) {
  const t = useMemo(() => getT(locale), [locale]);
  const id = detail.id;
  const router = useRouter();
  const online = useOnlineStatus();
  const streamStatus = useChatStreamStatus();
  const now = useNow();
  const outbox = useOutbox(me.id);

  const [messages, setMessages] = useState<ChatMessageDTO[]>(detail.messages);
  const [hasMore, setHasMore] = useState(detail.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reads, setReads] = useState<Record<string, string>>(() => readsToMap(detail.reads));
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<ChatMessageDTO | null>(null);
  const [selected, setSelected] = useState<ChatMessageDTO | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [mutedOverride, setMutedOverride] = useState<{ base: boolean; value: boolean } | null>(null);
  const muted = mutedOverride && mutedOverride.base === detail.muted ? mutedOverride.value : detail.muted;
  const [savingEdit, startEditTransition] = useTransition();
  // Lesestand beim Öffnen: Markierung «Neue Nachrichten» bleibt stehen, bis die Seite neu geladen wird.
  const [openedReadAt] = useState(detail.lastReadAt);
  // Nur Nachrichten, die beim Öffnen schon da waren, können die Markierung tragen; live eingehende nicht.
  const [openedLatestAt] = useState(() => detail.messages.reduce<string | null>((max, m) => (!max || m.createdAt > max ? m.createdAt : max), null));

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const stickRef = useRef(true);
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef(detail.cursor);
  const knownIdsRef = useRef<Set<string>>(new Set(detail.messages.map((m) => m.id)));
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isGroup = detail.kind === "GROUP";
  const canWrite = !(detail.kind === "DIRECT" && detail.otherLeft);

  /* ------------------------------------------------------------ Lesen */

  const markReadSoon = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void fetch(`/api/chat/${encodeURIComponent(id)}/read`, { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => undefined);
    }, 600);
  }, [id]);

  /** Eingehende Nachrichten übernehmen; neue fremde Nachrichten als gelesen markieren oder zählen. */
  const receive = useCallback(
    (incoming: ChatMessageDTO[]) => {
      if (!incoming.length) return;
      let fresh = 0;
      for (const m of incoming) {
        if (!knownIdsRef.current.has(m.id)) {
          knownIdsRef.current.add(m.id);
          if (m.senderId !== me.id && !m.deletedAt) fresh += 1;
        }
      }
      setMessages((list) => mergeMessages(list, incoming));
      if (fresh > 0) {
        if (atBottomRef.current) {
          stickRef.current = true;
          markReadSoon();
        } else setNewCount((n) => n + fresh);
      }
    },
    [me.id, markReadSoon],
  );

  /** Verpasste Änderungen seit dem Cursor holen (nach Wiederverbinden und im Polling-Rückfall). */
  const catchingUpRef = useRef(false);
  const catchUp = useCallback(async () => {
    if (catchingUpRef.current) return;
    catchingUpRef.current = true;
    try {
      // Bei vielen verpassten Änderungen seitenweise nachladen (höchstens 10 Seiten pro Durchlauf).
      for (let page = 0; page < 10; page++) {
        const res = await fetch(`/api/chat/${encodeURIComponent(id)}/messages?after=${encodeURIComponent(cursorRef.current)}`, { cache: "no-store", credentials: "same-origin" });
        if (res.status === 404) {
          router.replace("/chat");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as MessagesResponse;
        cursorRef.current = data.cursor;
        receive(data.messages);
        setReads(readsToMap(data.reads));
        if (!data.hasMore) break;
      }
    } catch {
      // offline – nächster Versuch folgt
    } finally {
      catchingUpRef.current = false;
    }
  }, [id, receive, router]);

  // Live-Ereignisse
  useEffect(() => {
    const refreshSoon = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 300);
    };
    const unsubscribe = subscribeChatStream((ev) => {
      if (ev.type === "hello") {
        void catchUp();
        void flushOutbox(me.id);
        return;
      }
      if (ev.conversationId !== id) return;
      if (ev.type === "message") receive([ev.message]);
      else if (ev.type === "read") setReads((r) => (r[ev.userId] && r[ev.userId]! >= ev.lastReadAt ? r : { ...r, [ev.userId]: ev.lastReadAt }));
      else if (ev.type === "conversation") refreshSoon();
    });
    const offDelivered = onDelivered((m) => {
      if (m.conversationId === id) receive([m]);
    });
    return () => {
      clearTimeout(refreshTimer.current);
      unsubscribe();
      offDelivered();
    };
  }, [id, receive, catchUp, router, me.id]);

  // Wartende Nachrichten regelmässig erneut versuchen (z.B. nach Serverfehlern).
  const hasPending = outbox.some((e) => e.status === "queued");
  useEffect(() => {
    if (!hasPending || !online) return;
    const t = setInterval(() => void flushOutbox(me.id), 15_000);
    return () => clearInterval(t);
  }, [hasPending, online, me.id]);

  // Polling-Rückfall, wenn der Stream nicht funktioniert
  useEffect(() => {
    if (streamStatus !== "degraded" || !online) return;
    const t = setInterval(() => void catchUp(), 5000);
    return () => clearInterval(t);
  }, [streamStatus, online, catchUp]);

  // Beim Öffnen und bei Rückkehr in den Tab als gelesen markieren; Ausgangskorb senden.
  useEffect(() => {
    markReadSoon();
    void flushOutbox(me.id);
    const onVisible = () => {
      if (document.visibilityState === "visible" && atBottomRef.current) markReadSoon();
    };
    const onOnline = () => {
      void flushOutbox(me.id);
      void catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(readTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [me.id, markReadSoon, catchUp]);

  // Bildschirmtastatur (v.a. iOS Safari): Ansicht über der Tastatur enden lassen, damit das
  // Eingabefeld sichtbar bleibt. Nur mobil (unterhalb md), direkt am Element ohne Re-Render.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    if (!vv || !el) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (mobile.matches && keyboard > 80) {
        el.style.bottom = `${Math.round(keyboard)}px`;
        el.style.zIndex = "30";
        if (stickRef.current && scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      } else {
        el.style.bottom = "";
        el.style.zIndex = "";
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      el.style.bottom = "";
      el.style.zIndex = "";
    };
  }, []);

  /* ------------------------------------------------------------ Scrollen */

  // Erstes Rendern: zur Markierung «Neue Nachrichten» oder ans Ende springen.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const marker = el.querySelector<HTMLElement>("#chat-unread-marker");
    if (marker) {
      el.scrollTop = Math.max(0, marker.offsetTop - 16);
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      atBottomRef.current = bottom;
      stickRef.current = bottom;
    } else el.scrollTop = el.scrollHeight;
  }, []);

  const pendingForConv = useMemo(() => outbox.filter((e) => e.conversationId === id), [outbox, id]);

  // Nach Änderungen: Position halten (ältere geladen) oder am Ende bleiben.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (prependRef.current) {
      el.scrollTop = prependRef.current.top + (el.scrollHeight - prependRef.current.height);
      prependRef.current = null;
      return;
    }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, pendingForConv.length, uploads.length]);

  const loadOlder = useCallback(
    async (oldestId: string) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoadingOlder(true);
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(id)}/messages?before=${encodeURIComponent(oldestId)}`, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as MessagesResponse;
        const el = scrollerRef.current;
        if (el && data.messages.length) prependRef.current = { height: el.scrollHeight, top: el.scrollTop };
        for (const m of data.messages) knownIdsRef.current.add(m.id);
        setMessages((list) => mergeMessages(list, data.messages));
        setHasMore(data.hasMore);
      } catch {
        toast.error(t("money.chat.olderFailed"));
      } finally {
        loadingRef.current = false;
        setLoadingOlder(false);
      }
    },
    [id, t],
  );

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = bottom;
    stickRef.current = bottom;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom && newCount > 0) {
      setNewCount(0);
      markReadSoon();
    }
    if (el.scrollTop < LOAD_OLDER_PX && hasMore && messages[0]) void loadOlder(messages[0].id);
  }

  function jumpToBottom() {
    const el = scrollerRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    setNewCount(0);
    markReadSoon();
  }

  /* ------------------------------------------------------------ Senden */

  function autosize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(MAX_TEXTAREA_PX, ta.scrollHeight)}px`;
  }

  useLayoutEffect(() => {
    autosize();
  }, [text]);

  function sendText() {
    const body = text.replace(/\r\n/g, "\n").trim();
    if (!body) return;
    if (body.length > MAX_MESSAGE_LENGTH) {
      toast.error(t("money.chat.maxChars", { max: MAX_MESSAGE_LENGTH }));
      return;
    }
    if (editing) return saveEdit(body);
    const entry = { clientId: newClientId(), conversationId: id, body, createdAt: new Date().toISOString(), status: "queued" as const };
    addToOutbox(me.id, entry);
    stickRef.current = true;
    setText("");
    textareaRef.current?.focus();
    void deliverEntry(me.id, entry).then((r) => {
      if (!r.ok && !r.retry) toast.error(localizeMessage(r.error, locale));
    });
  }

  function saveEdit(body: string) {
    const target = editing;
    if (!target) return;
    if (body === target.body) {
      setEditing(null);
      setText("");
      return;
    }
    startEditTransition(async () => {
      const res = await editMessageAction(target.id, body);
      if (res.ok && res.data) {
        receive([res.data]);
        setEditing(null);
        setText("");
      } else if (!res.ok) toast.error(localizeMessage(res.error, locale));
    });
  }

  async function uploadFile(up: Upload) {
    setUploads((list) => list.map((u) => (u.clientId === up.clientId ? { ...u, status: "uploading", error: undefined } : u)));
    const fd = new FormData();
    fd.set("clientId", up.clientId);
    fd.set("file", up.file, up.file.name);
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(id)}/attachments`, { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { message?: ChatMessageDTO; error?: string };
      if (res.ok && data.message) {
        receive([data.message]);
        setUploads((list) => list.filter((u) => u.clientId !== up.clientId));
        return;
      }
      const error = data.error ?? t("money.chat.attachFailed");
      setUploads((list) => list.map((u) => (u.clientId === up.clientId ? { ...u, status: "failed", error } : u)));
    } catch {
      setUploads((list) => list.map((u) => (u.clientId === up.clientId ? { ...u, status: "failed", error: t("money.chat.noConnection") } : u)));
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!navigator.onLine) {
      toast.error(t("money.chat.attachOffline"));
      return;
    }
    const up: Upload = { clientId: newClientId(), file, createdAt: new Date().toISOString(), status: "uploading" };
    stickRef.current = true;
    setUploads((list) => [...list, up]);
    void uploadFile(up);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && editing) {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // Desktop (Maus/Trackpad): Enter sendet, Shift+Enter neue Zeile. Mobil: Zeilenumbruch, Senden per Knopf.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    e.preventDefault();
    sendText();
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  /* ------------------------------------------------------------ Aktionen */

  function canChange(m: ChatMessageDTO) {
    return m.senderId === me.id && !m.deletedAt && Date.now() - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;
  }

  function startEdit(m: ChatMessageDTO) {
    setSelected(null);
    if (!canChange(m)) {
      toast.error(t("money.chat.editWindow"));
      return;
    }
    setEditing(m);
    setText(m.body);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }

  async function remove(m: ChatMessageDTO) {
    setSelected(null);
    const ok = await confirmDialog({ title: t("money.chat.deleteConfirm.title"), message: t("money.chat.deleteConfirm.message"), tone: "danger", confirmLabel: t("money.chat.delete") });
    if (!ok) return;
    const res = await deleteMessageAction(m.id);
    if (res.ok && res.data) {
      receive([res.data]);
      if (editing?.id === m.id) cancelEdit();
    } else if (!res.ok) toast.error(localizeMessage(res.error, locale));
  }

  async function copy(m: ChatMessageDTO) {
    setSelected(null);
    try {
      await navigator.clipboard.writeText(m.body);
      toast.success(t("money.chat.textCopied"));
    } catch {
      toast.error(t("money.chat.copyFailed"));
    }
  }

  async function toggleMute(v: boolean) {
    setMutedOverride({ base: detail.muted, value: v });
    const res = await setMutedAction(id, v);
    if (res.ok) toast.success(res.message ?? (v ? t("money.chat.mutedDone") : t("money.chat.unmutedDone")));
    else {
      setMutedOverride(null);
      toast.error(localizeMessage(res.error, locale));
    }
  }

  /* ------------------------------------------------------------ Darstellung */

  const otherMembers = useMemo(() => detail.members.filter((m) => m.userId !== me.id), [detail.members, me.id]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const sentIds = new Set(messages.map((m) => m.clientId).filter(Boolean));

    // Lesebestätigung nur bei der letzten eigenen Nachricht
    let lastOwn: ChatMessageDTO | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.senderId === me.id && !messages[i]!.deletedAt) {
        lastOwn = messages[i];
        break;
      }
    }
    let receipt: string | null = null;
    if (lastOwn) {
      const readers = otherMembers.filter((m) => (reads[m.userId] ?? "") >= lastOwn!.createdAt).length;
      if (!isGroup) receipt = readers > 0 ? t("money.chat.read") : t("money.chat.sent");
      else if (otherMembers.length > 0 && readers === otherMembers.length) receipt = t("money.chat.readByAll");
      else receipt = readers > 0 ? t("money.chat.readBy", { n: readers }) : t("money.chat.sent");
    }

    type Item = { msg: ChatMessageDTO; state: BubbleState; error?: string; localFile?: { name: string; size: number }; retry?: () => void; discard?: () => void };
    const pending: Item[] = [];
    for (const e of pendingForConv) {
      if (sentIds.has(e.clientId)) continue;
      pending.push({
        msg: { id: `pending:${e.clientId}`, conversationId: id, clientId: e.clientId, senderId: me.id, senderName: me.name, senderAvatar: me.avatarUrl, body: e.body, createdAt: e.createdAt, editedAt: null, deletedAt: null, file: null },
        state: e.status === "failed" || (online && e.error) ? "failed" : online ? "pending" : "queued",
        error: e.error,
        retry: () =>
          void retryEntry(me.id, e.clientId)?.then((r) => {
            if (r && !r.ok && !r.retry) toast.error(localizeMessage(r.error, locale));
          }),
        discard: () => removeFromOutbox(me.id, e.clientId),
      });
    }
    for (const u of uploads) {
      if (sentIds.has(u.clientId)) continue;
      pending.push({
        msg: { id: `pending:${u.clientId}`, conversationId: id, clientId: u.clientId, senderId: me.id, senderName: me.name, senderAvatar: me.avatarUrl, body: "", createdAt: u.createdAt, editedAt: null, deletedAt: null, file: null },
        state: u.status === "failed" ? "failed" : "pending",
        error: u.error,
        localFile: { name: u.file.name, size: u.file.size },
        retry: () => void uploadFile(u),
        discard: () => setUploads((list) => list.filter((x) => x.clientId !== u.clientId)),
      });
    }
    pending.sort((a, b) => a.msg.createdAt.localeCompare(b.msg.createdAt));

    const all: Item[] = [...messages.map((msg): Item => ({ msg, state: "sent" })), ...pending];
    let prevDay = "";
    let prevSender: string | null | undefined;
    let prevTime = 0;
    let unreadPlaced = false;
    for (const item of all) {
      const m = item.msg;
      const day = dayKey(m.createdAt);
      if (day !== prevDay) {
        out.push({ kind: "day", key: `day-${day}`, label: dayLabel(m.createdAt, now, locale) });
        prevDay = day;
        prevSender = undefined;
      }
      const mine = m.senderId === me.id;
      if (!unreadPlaced && openedReadAt && openedLatestAt && !mine && item.state === "sent" && m.createdAt > openedReadAt && m.createdAt <= openedLatestAt) {
        out.push({ kind: "unread", key: "unread" });
        unreadPlaced = true;
        prevSender = undefined;
      }
      const t = new Date(m.createdAt).getTime();
      const newRun = prevSender !== m.senderId || t - prevTime > 5 * 60_000;
      // Avatar bei der letzten Nachricht einer Folge wäre üblich; hier bei der ersten (einfacher, mit Name).
      out.push({
        kind: "msg",
        key: m.clientId ? `c-${m.clientId}` : m.id,
        msg: m,
        mine,
        showSender: isGroup && newRun,
        showAvatar: isGroup && !mine ? (newRun ? true : "space") : false,
        state: item.state,
        error: item.error,
        receipt: item.state === "sent" && lastOwn && m.id === lastOwn.id ? receipt : null,
        localFile: item.localFile ?? null,
        retry: item.retry,
        discard: item.discard,
      });
      prevSender = m.senderId;
      prevTime = t;
    }
    return out;
    // uploadFile ist eine stabile Hilfsfunktion dieser Komponente (nur Setter und id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, pendingForConv, uploads, reads, otherMembers, isGroup, me.id, me.name, me.avatarUrl, id, online, now, openedReadAt, openedLatestAt, locale, t]);

  const selectedOwn = selected?.senderId === me.id;
  const selectedChangeable = selected ? selectedOwn && !selected.deletedAt : false;
  const selectedAdminDelete = selected ? isGroup && detail.myRole === "ADMIN" && !selected.deletedAt : false;
  const subtitle = isGroup
    ? tPlural(t, "money.chat.memberCount", detail.members.length)
    : detail.otherLeft
      ? t("money.chat.otherLeft")
      : null;
  const remaining = MAX_MESSAGE_LENGTH - text.length;

  return (
    <div
      ref={rootRef}
      className={cn(
        // Mobil: volle Höhe zwischen Kopfzeile (56 px + Rand) und Tableiste (≈ 72 px), safe-area-bewusst.
        "fixed inset-x-0 top-[calc(57px+env(safe-area-inset-top))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col bg-bg",
        // Desktop: in den Inhaltsbereich eingepasst, volle Fensterhöhe.
        "md:static md:inset-auto md:z-auto md:-mt-5 md:-mb-10 md:h-dvh md:py-4",
      )}
    >
      {/* Kopf */}
      <header className="flex shrink-0 items-center gap-1 border-b border-line bg-bg/95 px-2 py-1.5 backdrop-blur md:rounded-t-card md:border md:bg-surface">
        <Link href="/chat" aria-label={t("money.chat.back")} className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <button type="button" onClick={() => setInfoOpen(true)} className="press flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control px-1 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
          <ConversationAvatar item={{ kind: detail.kind, isClub: detail.isClub, avatarUrl: detail.avatarUrl, avatarName: detail.title }} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold leading-tight">{chatTitle(detail.title, locale)}</span>
            {subtitle ? <span className="block truncate text-xs text-ink-3">{subtitle}</span> : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void toggleMute(!muted)}
          aria-pressed={muted}
          aria-label={muted ? t("money.chat.unmute") : t("money.chat.mute")}
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {muted ? <BellOff className="h-5 w-5" aria-hidden /> : <Bell className="h-5 w-5" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label={isGroup ? t("money.chat.groupInfo") : t("money.chat.convInfo")}
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Info className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {!online ? (
        <div className="flex shrink-0 items-center gap-2 bg-warn px-4 py-2 text-sm text-warn-ink" role="status">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> {t("money.chat.offline")}
        </div>
      ) : streamStatus === "degraded" ? (
        <div className="shrink-0 bg-surface-2 px-4 py-1.5 text-xs text-ink-3" role="status">{t("money.chat.degraded")}</div>
      ) : null}

      {/* Nachrichten */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 pb-3 md:border-x md:border-line md:bg-surface-2/40"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={t("money.chat.logLabel", { title: chatTitle(detail.title, locale) })}
        >
          {hasMore ? (
            <div className="flex justify-center py-3">
              {loadingOlder ? (
                <span className="inline-flex items-center gap-2 text-sm text-ink-3"><Spinner /> {t("money.chat.olderLoading")}</span>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => messages[0] && void loadOlder(messages[0].id)}>
                  {t("money.chat.loadOlder")}
                </Button>
              )}
            </div>
          ) : messages.length > 0 ? (
            <p className="py-4 text-center text-xs text-ink-3">{t("money.chat.start")}</p>
          ) : null}

          {rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-ink-3">
              <p className="font-medium text-ink-2">{t("money.chat.noMessages")}</p>
              <p className="mt-1 text-sm">{isGroup ? t("money.chat.firstGroup") : t("money.chat.firstDirect", { name: chatTitle(detail.title, locale) })}</p>
            </div>
          ) : (
            rows.map((r) =>
              r.kind === "day" ? (
                <DayDivider key={r.key} label={r.label} />
              ) : r.kind === "unread" ? (
                <UnreadDivider key={r.key} id="chat-unread-marker" locale={locale} />
              ) : (
                <MessageBubble
                  key={r.key}
                  msg={r.msg}
                  mine={r.mine}
                  showSender={r.showSender}
                  showAvatar={r.showAvatar}
                  state={r.state}
                  error={r.error}
                  receipt={r.receipt}
                  localFile={r.localFile}
                  onOpenActions={r.state === "sent" ? () => setSelected(r.msg) : undefined}
                  onRetry={r.retry}
                  onDiscard={r.discard}
                  locale={locale}
                />
              ),
            )
          )}
        </div>

        {!atBottom || newCount > 0 ? (
          <button
            type="button"
            onClick={jumpToBottom}
            className={cn(
              "press absolute bottom-3 right-3 inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium shadow-lg focus-visible:outline-2 focus-visible:outline-accent",
              newCount > 0 && "border-accent bg-accent text-accent-ink",
            )}
            aria-label={newCount > 0 ? t("money.chat.showNew", { n: newCount }) : t("money.chat.jumpEnd")}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            {newCount > 0 ? tPlural(t, "money.chat.newCount", newCount) : null}
          </button>
        ) : null}
      </div>

      {/* Eingabe */}
      <div className="shrink-0 border-t border-line bg-bg px-2 pt-2 pb-2 md:rounded-b-card md:border md:bg-surface">
        {editing ? (
          <div className="mb-2 flex items-center gap-2 rounded-control bg-accent-soft px-3 py-1.5 text-sm text-accent">
            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{t("money.chat.editing")}</span>
            <button type="button" onClick={cancelEdit} aria-label={t("money.chat.cancelEdit")} className="press -my-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
        {canWrite ? (
          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              sendText();
            }}
          >
            {!editing ? (
              <>
                <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden onChange={onPickFile} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t("money.chat.attach")}
                  className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Paperclip className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : null}
            <label htmlFor="chat-input" className="sr-only">{t("money.chat.message")}</label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={t("money.chat.placeholder")}
              enterKeyHint="enter"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-2.5 text-[16px] leading-snug text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <button
              type="submit"
              disabled={!text.trim() || savingEdit}
              aria-label={editing ? t("money.chat.saveEdit") : t("money.chat.send")}
              className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {savingEdit ? <Spinner /> : editing ? <Check className="h-5 w-5" aria-hidden /> : <SendHorizontal className="h-5 w-5" aria-hidden />}
            </button>
          </form>
        ) : (
          <p className="px-2 py-2 text-center text-sm text-ink-3">{t("money.chat.cannotWrite")}</p>
        )}
        {remaining < 300 ? <p className={cn("mt-1 px-14 text-right text-xs tabular-nums", remaining < 0 ? "text-danger" : "text-ink-3")}>{t("money.chat.charsLeft", { n: remaining })}</p> : null}
      </div>

      {/* Aktionen zu einer Nachricht */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} title={t("money.chat.message")} variant="auto" size="sm">
        {selected ? (
          <div className="-mx-2 flex flex-col pb-2">
            {selected.body ? (
              <button type="button" onClick={() => void copy(selected)} className="press flex min-h-12 items-center gap-3 rounded-control px-3 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
                <Copy className="h-5 w-5 text-ink-3" aria-hidden /> {t("money.chat.copyText")}
              </button>
            ) : null}
            {selectedChangeable && selected.body ? (
              <button type="button" onClick={() => startEdit(selected)} className="press flex min-h-12 items-center gap-3 rounded-control px-3 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
                <Pencil className="h-5 w-5 text-ink-3" aria-hidden /> {t("money.chat.edit")}
              </button>
            ) : null}
            {selectedChangeable || selectedAdminDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedAdminDelete && !canChange(selected)) {
                    setSelected(null);
                    toast.error(t("money.chat.deleteWindow"));
                    return;
                  }
                  void remove(selected);
                }}
                className="press flex min-h-12 items-center gap-3 rounded-control px-3 text-left text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Trash2 className="h-5 w-5" aria-hidden /> {t("money.chat.delete")}
              </button>
            ) : null}
            {selectedOwn ? <p className="px-3 pt-2 text-xs text-ink-3">{t("money.chat.ownHint")}</p> : null}
          </div>
        ) : null}
      </Dialog>

      <GroupInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        detail={detail}
        meId={me.id}
        tenantMembers={tenantMembers}
        canManageClub={canManageClub}
        muted={muted}
        onToggleMute={(v) => void toggleMute(v)}
        locale={locale}
      />
    </div>
  );
}
