"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RotateCcw, SendHorizontal, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/components/locale";
import { readAiStream } from "@/lib/ai/stream-client";
import { cn } from "@/lib/utils";
import { HELP_MAX_QUESTION_CHARS, trimHistory, type ChatTurn } from "@/modules/ai/help/history";
import { MarkdownLite } from "./markdown";

/** Angezeigte Nachricht (error: i18n-Schlüssel eines Fehlers zu dieser Antwort). */
type ShownTurn = ChatTurn & { error?: string; pending?: boolean };

/** Höchstens so viele Nachrichten bleiben sichtbar (älteste fallen weg). */
const MAX_SHOWN = 40;

function loadStored(key: string | undefined): ShownTurn[] {
  if (!key) return [];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is ChatTurn => !!x && typeof x === "object" && (x.role === "user" || x.role === "assistant") && typeof x.content === "string")
      .slice(-MAX_SHOWN)
      .map((x) => ({ role: x.role, content: x.content }));
  } catch {
    return [];
  }
}

function store(key: string | undefined, turns: ShownTurn[]) {
  if (!key) return;
  try {
    const keep = turns.filter((x) => !x.pending && !x.error && x.content).map((x) => ({ role: x.role, content: x.content }));
    sessionStorage.setItem(key, JSON.stringify(keep.slice(-MAX_SHOWN)));
  } catch {
    // Speicher nicht verfügbar (privates Fenster) – Verlauf nur im Speicher
  }
}

export type AiChatProps = {
  /** Route-Handler, z.B. "/api/ai/help" */
  endpoint: string;
  /** Verlauf in sessionStorage merken (pro Tab) */
  storageKey?: string;
  /** Begrüssung über dem leeren Verlauf */
  intro?: string;
  /** Vorschläge zum Antippen (bereits übersetzt) */
  suggestions?: string[];
  placeholder?: string;
  /** Wird beim Klick auf einen Link in einer Antwort aufgerufen (z.B. Panel schliessen) */
  onNavigate?: () => void;
  /** Höhe des Verlaufs begrenzen (Panel) */
  className?: string;
  autoFocus?: boolean;
};

/**
 * Chat mit Claude über einen Streaming-Route-Handler. Der Verlauf bleibt im Browser; pro Anfrage
 * gehen die letzten Nachrichten mit (gekürzt mit trimHistory).
 */
export function AiChat({ endpoint, storageKey, intro, suggestions, placeholder, onNavigate, className, autoFocus }: AiChatProps) {
  const t = useT();
  const [turns, setTurns] = useState<ShownTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loaded = useRef(false);
  const inputId = useId();

  useEffect(() => {
    // Gespeicherten Verlauf erst nach der Hydrierung laden (Server und Client rendern zuerst leer).
    const id = setTimeout(() => {
      const stored = loadStored(storageKey);
      loaded.current = true;
      if (stored.length) setTurns((prev) => (prev.length ? prev : stored));
    }, 0);
    return () => clearTimeout(id);
  }, [storageKey]);

  useEffect(() => {
    if (loaded.current) store(storageKey, turns);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, storageKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim().slice(0, HELP_MAX_QUESTION_CHARS);
      if (!q || busy) return;
      const history = trimHistory([...turns.filter((x) => !x.error && !x.pending), { role: "user", content: q }]);
      setDraft("");
      setBusy(true);
      setTurns((prev) => [...prev, { role: "user" as const, content: q }, { role: "assistant" as const, content: "", pending: true }].slice(-MAX_SHOWN));
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const update = (patch: Partial<ShownTurn>) =>
        setTurns((prev) => {
          const next = [...prev];
          const last = next.at(-1);
          if (last && last.role === "assistant") next[next.length - 1] = { ...last, ...patch };
          return next;
        });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let key = "ai.error.unknown";
          try {
            const body = (await res.json()) as { error?: unknown };
            if (typeof body.error === "string" && /^ai(help)?\.[A-Za-z.]+$/.test(body.error)) key = body.error;
          } catch {
            // keine JSON-Antwort
          }
          update({ pending: false, content: "", error: key });
          return;
        }
        const out = await readAiStream(res, (text) => update({ content: text, pending: !text }));
        if (ctrl.signal.aborted || out.error === "aborted") update({ pending: false, content: out.text, error: out.text ? undefined : "ai.error.aborted" });
        else if (out.error) update({ pending: false, content: out.error === "refused" ? "" : out.text, error: out.error === "rateLimited" ? "aihelp.error.rateLimited" : `ai.error.${out.error}` });
        else update({ pending: false, content: out.text, error: out.text ? undefined : "ai.error.unknown" });
      } catch {
        update({ pending: false, error: ctrl.signal.aborted ? "ai.error.aborted" : "ai.error.network" });
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, endpoint, turns],
  );

  const reset = () => {
    abortRef.current?.abort();
    setTurns([]);
    setDraft("");
    inputRef.current?.focus();
  };

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-0 flex-col">
      <div ref={listRef} className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto", className)} aria-live="polite" aria-busy={busy}>
        {empty ? (
          <div className="space-y-3">
            {intro ? (
              <p className="flex items-start gap-2 text-[15px] text-ink-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <span>{intro}</span>
              </p>
            ) : null}
            {suggestions?.length ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={busy}
                    className="press min-h-11 rounded-full border border-line bg-surface px-3.5 py-2 text-left text-sm text-ink-2 hover:bg-surface-2"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          turns.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[15px] text-bg">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[15px] text-ink">
                  {m.pending && !m.content ? (
                    <span className="inline-flex items-center gap-1 py-1" aria-label={t("aihelp.chat.thinking")}>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:300ms]" />
                    </span>
                  ) : m.content ? (
                    <MarkdownLite text={m.content} onNavigate={onNavigate} />
                  ) : null}
                  {m.error ? <p className={cn("text-sm text-danger", m.content && "mt-2")} role="alert">{t(m.error)}</p> : null}
                </div>
              </div>
            ),
          )
        )}
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor={inputId} className="sr-only">{t("aihelp.chat.inputLabel")}</label>
        <textarea
          id={inputId}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          maxLength={HELP_MAX_QUESTION_CHARS}
          placeholder={placeholder ?? t("aihelp.chat.placeholder")}
          autoFocus={autoFocus}
          enterKeyHint="send"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-control border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent [field-sizing:content]"
        />
        {busy ? (
          <Button type="button" variant="secondary" className="h-11 w-11 shrink-0 px-0" onClick={() => abortRef.current?.abort()} aria-label={t("aihelp.chat.stop")} title={t("aihelp.chat.stop")}>
            <Square className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" className="h-11 w-11 shrink-0 px-0" disabled={!draft.trim()} aria-label={t("aihelp.chat.send")} title={t("aihelp.chat.send")}>
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </form>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{t("aihelp.chat.disclaimer")}</p>
        {!empty ? (
          <button type="button" onClick={reset} className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2 text-sm text-ink-2 hover:bg-surface-2">
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t("aihelp.chat.newChat")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
