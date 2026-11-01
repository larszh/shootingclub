"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CloudOff, NotebookPen, Search, Trash2, Undo2, UserRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Alert, Badge, Button, Card, EmptyState, Input, SectionTitle } from "@/components/ui";
import { useOnlineStatus } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { uuid } from "@/lib/offline/idb";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { recordEntriesAction, undoBatchAction } from "@/modules/kiosk/actions";
import { UNDO_WINDOW_MS, cartTotal, groupByCategory, normalizeCart, MAX_QUANTITY } from "@/modules/kiosk/logic";
import type { EntryInput } from "@/modules/kiosk/types";
import { QuantityStepper } from "@/modules/ammo/ui/stepper";

export type KioskCounterMember = { userId: string; name: string; memberNumber: string | null; avatarUrl: string | null };
export type KioskCounterProduct = { id: string; name: string; category: string | null; priceCents: number; sortOrder: number };
export type KioskRecentBatch = { batchId: string; who: string; paidCash: boolean; createdAtMs: number; totalCents: number; billed: boolean; items: string[] };

type Customer = { kind: "member"; userId: string } | { kind: "guest" };
type Pending = { batchId: string; input: EntryInput; label: string; at: number };
type LastBatch = { batchId: string; label: string; at: number };

const OUTBOX_PREFIX = "standchef.kiosk.outbox.";
/** Aktuelle Zeit (nur in Event-Handlern und Timern verwendet). */
const nowMs = () => Date.now();

function readOutbox(key: string): Pending[] {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as Pending[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.batchId === "string" && p.input) : [];
  } catch {
    return [];
  }
}

function writeOutbox(key: string, list: Pending[]) {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list));
    else localStorage.removeItem(key);
  } catch {
    // Speicher voll oder gesperrt: Erfassung bleibt nur im Arbeitsspeicher
  }
}

/**
 * Theke der Schützenstube (Tablet): Kundschaft wählen (Mitglied oder Gast bar), Produkte antippen,
 * «Aufschreiben». Jede Erfassung hat eine Geräte-ID (batchId); ohne Verbindung bleibt sie im
 * Browser gespeichert und wird später übertragen. Der Server bucht dieselbe batchId nie doppelt.
 */
export function KioskCounter({ tenantId, members, recentIds, products, recent, currency }: {
  tenantId: string; members: KioskCounterMember[]; recentIds: string[]; products: KioskCounterProduct[]; recent: KioskRecentBatch[]; currency: string;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const outboxKey = OUTBOX_PREFIX + tenantId;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [paidCash, setPaidCash] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [outbox, setOutbox] = useState<Pending[]>([]);
  const [last, setLast] = useState<LastBatch | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const flushing = useRef(false);
  const submitLock = useRef(false);

  const byId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const groups = useMemo(() => groupByCategory(products), [products]);
  const lines = useMemo(() => normalizeCart(Object.entries(qty).map(([productId, quantity]) => ({ productId, quantity }))), [qty]);
  const total = cartTotal(lines, products);
  const member = customer?.kind === "member" ? byId.get(customer.userId) ?? null : null;

  // Uhr für «Rückgängig» (2 Minuten); startet erst im Browser, damit Server und Client gleich rendern.
  useEffect(() => {
    const first = setTimeout(() => setNow(nowMs()), 0);
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const send = useCallback(async (p: Pending): Promise<"ok" | "offline" | "error"> => {
    try {
      const r = await recordEntriesAction(p.input);
      if (!r.ok) {
        toast.error(`${p.label}: ${r.error}`);
        return "error";
      }
      return "ok";
    } catch (e) {
      if (isNavigationError(e)) throw e;
      // Netzwerkfehler (oder Server kurz nicht erreichbar): in der Warteschlange lassen, später erneut.
      if (!isNetworkError(e)) console.warn("Schützenstube: Übertragung fehlgeschlagen", e);
      return "offline";
    }
  }, []);

  /** Ausstehende Erfassungen nacheinander übertragen. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let list = readOutbox(outboxKey);
      setOutbox(list);
      let sent = 0;
      for (const p of [...list]) {
        const res = await send(p);
        if (res === "offline") break;
        list = readOutbox(outboxKey).filter((x) => x.batchId !== p.batchId);
        writeOutbox(outboxKey, list);
        setOutbox(list);
        if (res === "ok") sent += 1;
      }
      if (sent) {
        toast.success(`${sent} ${sent === 1 ? "ausstehende Erfassung" : "ausstehende Erfassungen"} übertragen.`);
        router.refresh();
      }
    } finally {
      flushing.current = false;
    }
  }, [outboxKey, send, router]);

  useEffect(() => {
    const first = setTimeout(() => void flush(), 0);
    const t = setInterval(() => void flush(), 30_000);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  function reset() {
    setCustomer(null);
    setQuery("");
    setQty({});
    setPaidCash(false);
    setGuestName("");
    setError(null);
  }

  function add(id: string, delta: number) {
    setQty((s) => ({ ...s, [id]: Math.max(0, Math.min(MAX_QUANTITY, (s[id] ?? 0) + delta)) }));
  }

  async function submit() {
    if (!customer || !lines.length || submitLock.current) return;
    submitLock.current = true;
    setSending(true);
    setError(null);
    const isGuest = customer.kind === "guest";
    const label = isGuest ? (guestName.trim() ? `Gast ${guestName.trim()}` : "Gast") : member?.name ?? "Mitglied";
    const batchId = uuid();
    const p: Pending = {
      batchId,
      label,
      at: nowMs(),
      input: { batchId, userId: isGuest ? null : customer.userId, guestName: isGuest ? guestName.trim().slice(0, 80) : undefined, paidCash: isGuest ? true : paidCash, lines },
    };
    // Zuerst lokal sichern: geht die Verbindung unterwegs verloren, wird später übertragen.
    const list = [...readOutbox(outboxKey), p];
    writeOutbox(outboxKey, list);
    setOutbox(list);
    try {
      const r = await recordEntriesAction(p.input);
      writeOutbox(outboxKey, readOutbox(outboxKey).filter((x) => x.batchId !== p.batchId));
      setOutbox(readOutbox(outboxKey));
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Aufgeschrieben.");
      setLast({ batchId: p.batchId, label: `${label}: ${formatMoney(total, currency)}`, at: nowMs() });
      reset();
      router.refresh();
    } catch (e) {
      if (isNavigationError(e)) throw e;
      // Keine Verbindung: bleibt in der Warteschlange, die Theke kann weiterarbeiten.
      toast(`Ohne Verbindung gespeichert (${label}). Wird automatisch übertragen.`);
      reset();
    } finally {
      submitLock.current = false;
      setSending(false);
    }
  }

  async function undo(batchId: string) {
    setUndoing(batchId);
    try {
      const r = await undoBatchAction(batchId);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.message ?? "Rückgängig gemacht.");
        if (last?.batchId === batchId) setLast(null);
        router.refresh();
      }
    } catch (e) {
      if (isNavigationError(e)) throw e;
      toast.error("Keine Verbindung. Bitte nochmals versuchen.");
    } finally {
      setUndoing(null);
    }
  }

  const undoLeft = (at: number) => (now ? Math.max(0, Math.ceil((at + UNDO_WINDOW_MS - now) / 1000)) : 0);
  const fmtLeft = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const lastLeft = last ? undoLeft(last.at) : 0;

  const status = (
    <>
      {!online || outbox.length ? (
        <Alert tone="warn" icon={<CloudOff className="h-4 w-4" />} className="mb-3">
          {!online ? "Keine Verbindung. Erfassungen werden auf diesem Gerät gespeichert. " : ""}
          {outbox.length ? `${outbox.length} ${outbox.length === 1 ? "Erfassung wartet" : "Erfassungen warten"} auf Übertragung.` : ""}
          {online && outbox.length ? <button type="button" onClick={() => void flush()} className="ml-2 underline">Jetzt senden</button> : null}
        </Alert>
      ) : null}
      {last && lastLeft > 0 ? (
        <Card className="mb-3 flex min-h-14 items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1 text-sm"><span className="font-medium">Erfasst:</span> {last.label}</div>
          <Button type="button" variant="secondary" disabled={undoing === last.batchId} onClick={() => void undo(last.batchId)}>
            {undoing === last.batchId ? <Spinner /> : <Undo2 className="h-4 w-4" />} Rückgängig <span className="tabular-nums text-ink-3">{fmtLeft(lastLeft)}</span>
          </Button>
        </Card>
      ) : null}
    </>
  );

  // ---------------------------------------------------------------- Kundschaft wählen
  if (!customer) {
    const q = query.trim().toLowerCase();
    const recentMembers = recentIds.map((id) => byId.get(id)).filter((m): m is KioskCounterMember => !!m);
    const hits = q
      ? members.filter((m) => m.name.toLowerCase().includes(q) || (m.memberNumber ?? "").toLowerCase().includes(q)).slice(0, 40)
      : [...recentMembers, ...members.filter((m) => !recentIds.includes(m.userId))].slice(0, 40);
    return (
      <div>
        {status}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mitglied suchen (Name oder Nr.)" aria-label="Mitglied suchen" className="h-14 pl-12 text-lg" />
          </div>
          <Button type="button" size="lg" variant="secondary" className="h-14" onClick={() => { setCustomer({ kind: "guest" }); setPaidCash(true); }}>
            <Banknote className="h-5 w-5" /> Gast bar
          </Button>
        </div>
        <SectionTitle>{q ? "Treffer" : recentMembers.length ? "Zuletzt bedient, dann alle" : "Mitglieder"}</SectionTitle>
        {hits.length ? (
          <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {hits.map((m) => (
              <button key={m.userId} type="button" onClick={() => setCustomer({ kind: "member", userId: m.userId })}
                className="press flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 text-left hover:bg-surface-2">
                <Avatar name={m.name} src={m.avatarUrl} size={40} tone="soft" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-ink-3">{recentIds.includes(m.userId) && !q ? "zuletzt" : m.memberNumber ? `Nr. ${m.memberNumber}` : " "}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Search className="h-5 w-5" />} title="Niemand gefunden" text="Anderen Namen versuchen oder als Gast bar erfassen." />
        )}
        <RecentList recent={recent} now={now} undoing={undoing} onUndo={(id) => void undo(id)} currency={currency} fmtLeft={fmtLeft} />
      </div>
    );
  }

  // ---------------------------------------------------------------- Produkte
  return (
    <div>
      {status}
      <Card className="mb-3 flex flex-wrap items-center gap-3 p-3">
        {member ? <Avatar name={member.name} src={member.avatarUrl} size={48} tone="soft" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn/20 text-warn"><UserRound className="h-5 w-5" /></span>}
        <div className="min-w-0 flex-1 basis-40">
          {member ? (
            <>
              <div className="text-lg font-semibold">{member.name}</div>
              <div className="text-xs text-ink-3">{member.memberNumber ? `Nr. ${member.memberNumber} · ` : ""}{paidCash ? "bezahlt bar" : "auf Rechnung"}</div>
            </>
          ) : (
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={80} placeholder="Gast (Name optional)" aria-label="Name des Gasts (optional)" />
          )}
        </div>
        <Button type="button" variant="secondary" onClick={() => { setCustomer(null); setError(null); }}><ArrowLeft className="h-4 w-4" /> Wechseln</Button>
      </Card>

      <div className="md:grid md:grid-cols-[1fr_20rem] md:items-start md:gap-4">
        <div>
          {groups.length ? groups.map((g) => (
            <section key={g.category}>
              <SectionTitle>{g.category}</SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {g.items.map((p) => {
                  const n = qty[p.id] ?? 0;
                  return (
                    <button key={p.id} type="button" onClick={() => add(p.id, 1)} aria-label={`${p.name}, ${formatMoney(p.priceCents, currency)}${n ? `, ${n} gewählt` : ""}`}
                      className={cn("press relative flex min-h-24 flex-col justify-between rounded-card border-2 bg-surface p-3 text-left hover:bg-surface-2", n ? "border-ink" : "border-line")}>
                      <span className="text-[17px] font-semibold leading-snug">{p.name}</span>
                      <span className="text-sm tabular-nums text-ink-2">{formatMoney(p.priceCents, currency)}</span>
                      {n ? <span className="absolute right-2 top-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-ink px-2 text-sm font-semibold tabular-nums text-bg">{n}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          )) : <EmptyState icon={<NotebookPen className="h-5 w-5" />} title="Kein Sortiment" text="Die Verwaltung legt die Produkte unter «Schützenstube verwalten → Sortiment» an." />}
        </div>

        <div className="sticky bottom-24 z-10 mt-4 md:bottom-auto md:top-4 md:mt-11">
          <Card className="space-y-3 p-4 shadow-lg">
            {lines.length ? (
              <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
                {lines.map((l) => {
                  const p = products.find((x) => x.id === l.productId);
                  if (!p) return null;
                  return (
                    <li key={l.productId} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{p.name}</span>
                        <span className="block text-xs tabular-nums text-ink-3">{formatMoney(p.priceCents * l.quantity, currency)}</span>
                      </span>
                      <QuantityStepper label={p.name} value={l.quantity} max={MAX_QUANTITY} onChange={(v) => setQty((s) => ({ ...s, [p.id]: v }))} />
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-ink-3">Produkte antippen, um sie hinzuzufügen.</p>}
            {member ? (
              <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3", paidCash ? "border-ok bg-ok/10" : "border-line")}>
                <input type="checkbox" checked={paidCash} onChange={(e) => setPaidCash(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
                <span className="text-sm font-medium">Bar bezahlt (nicht auf Rechnung)</span>
              </label>
            ) : <Badge tone="warn">Gast: bar bezahlt</Badge>}
            {error ? <Alert>{error}</Alert> : null}
            <div className="flex items-end justify-between gap-2">
              <div className="text-2xl font-semibold tabular-nums">{formatMoney(total, currency)}</div>
              {lines.length ? (
                <button type="button" onClick={() => setQty({})} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm text-ink-3 hover:bg-surface-2"><Trash2 className="h-4 w-4" /> Leeren</button>
              ) : null}
            </div>
            <Button type="button" size="lg" className="w-full" disabled={sending || !lines.length} onClick={() => void submit()} aria-busy={sending || undefined}>
              {sending ? <span className="inline-flex items-center gap-2"><Spinner /> Bitte warten…</span> : member && !paidCash ? <><NotebookPen className="h-5 w-5" /> Aufschreiben</> : <><Banknote className="h-5 w-5" /> Bar erfassen</>}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecentList({ recent, now, undoing, onUndo, currency, fmtLeft }: {
  recent: KioskRecentBatch[]; now: number; undoing: string | null; onUndo: (batchId: string) => void; currency: string; fmtLeft: (s: number) => string;
}) {
  if (!recent.length) return null;
  return (
    <>
      <SectionTitle>Heute von dir erfasst</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        {recent.map((b) => {
          const left = now && !b.billed ? Math.max(0, Math.ceil((b.createdAtMs + UNDO_WINDOW_MS - now) / 1000)) : 0;
          const time = new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" }).format(new Date(b.createdAtMs));
          return (
            <div key={b.batchId} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-sm"><span className="font-medium">{b.who}</span>{b.paidCash ? <Badge tone="outline">bar</Badge> : null}</div>
                <div className="truncate text-xs text-ink-3">{time} · {b.items.join(", ")}</div>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">{formatMoney(b.totalCents, currency)}</span>
              {left > 0 ? (
                <Button type="button" variant="ghost" size="sm" className="h-11" disabled={undoing === b.batchId} onClick={() => onUndo(b.batchId)} aria-label={`Erfassung ${b.who} rückgängig machen`}>
                  <Undo2 className="h-4 w-4" /> <span className="tabular-nums">{fmtLeft(left)}</span>
                </Button>
              ) : null}
            </div>
          );
        })}
      </Card>
    </>
  );
}
