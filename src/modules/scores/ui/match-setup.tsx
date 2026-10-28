"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Plus, Search, Star, UserPlus, X } from "lucide-react";
import { disciplineLabel, formatDistances } from "@/modules/scores/types";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { useSyncStatus } from "@/lib/offline/hooks";
import { uuid } from "@/lib/offline/idb";
import { requestFlush } from "@/lib/offline/outbox";
import { createOfflineMatch, ensureSession } from "@/lib/offline/store";
import type { CreateMatchPayload, ScoreMatch, SnapshotMember, SnapshotProgram, SyncResponse } from "@/lib/offline/types";

type Member = SnapshotMember;
type Me = { id: string; name: string; avatarUrl: string | null };
type Participant = { key: string; userId?: string; guestName?: string; name: string; isGuest: boolean; note?: string; avatarUrl: string | null };

const CREATE_TIMEOUT = 8_000;

/** Lokale Ansicht eines offline erstellten Durchgangs (Teilnehmer-Schlüssel = Index). */
function buildOfflineView(clientId: string, program: SnapshotProgram, participants: Participant[], me: Me, payload: CreateMatchPayload): ScoreMatch {
  const now = new Date().toISOString();
  return {
    id: null,
    clientId,
    title: payload.title ?? null,
    date: payload.date ? new Date(payload.date).toISOString() : now,
    generatedAt: now,
    status: "OPEN",
    locationNote: payload.locationNote ?? null,
    createdByName: me.name,
    canEdit: true,
    canDelete: true,
    program: { id: program.id, name: program.name, discipline: program.discipline, scoringMode: program.scoringMode, stages: program.stages, totals: program.totals },
    participants: participants.map((p, i) => ({
      id: String(i),
      userId: p.userId ?? null,
      name: p.name,
      isGuest: p.isGuest,
      note: p.note ?? null,
      isMe: p.userId === me.id,
      avatarUrl: p.avatarUrl,
      results: [],
    })),
  };
}

async function postCreate(op: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CREATE_TIMEOUT);
  try {
    return await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ ops: [op] }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Durchgang einrichten. Online wird direkt auf dem Server erstellt; ohne Verbindung (oder wenn der
 * Server nicht antwortet) entsteht der Durchgang lokal und wird später übertragen.
 * `offlineOnly`: Daten stammen aus dem Offline-Snapshot (Seite /offline/new).
 */
export function MatchSetup({
  programs,
  members,
  me,
  tenantId,
  tenantName = null,
  today,
  initialProgramId,
  initialParticipantIds = [],
  offlineOnly = false,
}: {
  programs: SnapshotProgram[];
  members: Member[];
  me: Me;
  tenantId: string;
  tenantName?: string | null;
  today: string;
  initialProgramId?: string;
  initialParticipantIds?: string[];
  offlineOnly?: boolean;
}) {
  const router = useRouter();
  const { online } = useSyncStatus();
  const [programId, setProgramId] = useState(initialProgramId && programs.some((p) => p.id === initialProgramId) ? initialProgramId : "");
  const [q, setQ] = useState("");
  const [participants, setParticipants] = useState<Participant[]>(() => [
    { key: "me", userId: me.id, name: me.name, isGuest: false, avatarUrl: me.avatarUrl },
    ...members.filter((m) => initialParticipantIds.includes(m.id)).map((m) => ({ key: m.id, userId: m.id, name: m.name, isGuest: false, avatarUrl: m.avatarUrl ?? null })),
  ]);
  const [guestName, setGuestName] = useState("");
  const [guestNote, setGuestNote] = useState("");
  const [showGuest, setShowGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const program = programs.find((p) => p.id === programId);
  const sorted = [...programs].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  const filteredPrograms = sorted.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const selectedIds = new Set(participants.filter((p) => p.userId).map((p) => p.userId));
  const offline = offlineOnly || !online;

  const toggleMember = (m: Member) => {
    setParticipants((ps) => (ps.some((p) => p.userId === m.id) ? ps.filter((p) => p.userId !== m.id) : [...ps, { key: m.id, userId: m.id, name: m.name, isGuest: false, avatarUrl: m.avatarUrl }]));
  };
  const addGuest = () => {
    const name = guestName.trim() || "Gast";
    setParticipants((ps) => [...ps, { key: `g-${uuid()}`, guestName: name, name, isGuest: true, note: guestNote.trim() || undefined, avatarUrl: null }]);
    setGuestName("");
    setGuestNote("");
    setShowGuest(false);
  };
  const remove = (key: string) => setParticipants((ps) => ps.filter((p) => p.key !== key));

  const createLocally = async (id: string, payload: CreateMatchPayload) => {
    if (!program) return;
    await ensureSession(me, { id: tenantId, name: tenantName });
    const view = buildOfflineView(id, program, participants, me, payload);
    const key = await createOfflineMatch(view, payload, tenantId, me.id);
    requestFlush(0);
    // Offline-Seite ist vorab gespeichert und funktioniert ohne Server
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- harte Navigation, damit der Service Worker die Offline-Seite liefert
    window.location.assign(`/offline/match?key=${encodeURIComponent(key)}`);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!program || busy) return;
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
    // Gleiche clientId bei Wiederholung: der Server erstellt den Durchgang nie doppelt
    const id = clientId ?? uuid();
    setClientId(id);
    const payload: CreateMatchPayload = {
      clientId: id,
      programId: program.id,
      title: str("title"),
      date: str("date"),
      locationNote: str("locationNote"),
      participants: participants.map((p) => ({ userId: p.userId, guestName: p.guestName, note: p.note })),
    };
    setBusy(true);
    setError(null);

    if (!offlineOnly && navigator.onLine) {
      try {
        const res = await postCreate({ id: uuid(), type: "createMatch", tenantId, userId: me.id, payload });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as SyncResponse;
          const r = data.results[0];
          if (r?.ok && r.matchId) {
            router.push(`/scores/matches/${r.matchId}`);
            return;
          }
          if (r && r.retry === false) {
            setError(r.error ?? "Durchgang konnte nicht erstellt werden.");
            setClientId(null);
            setBusy(false);
            return;
          }
        }
        // Serverfehler: wie offline behandeln
      } catch {
        // Keine Verbindung oder Zeitüberschreitung: lokal erstellen
      }
    }

    try {
      await createLocally(id, payload);
    } catch {
      setError("Der Durchgang konnte auf diesem Gerät nicht gespeichert werden. Bitte mit Internetverbindung nochmals versuchen.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {offline ? (
        <div className="animate-fade flex items-start gap-3 rounded-control bg-warn/10 px-3.5 py-3 text-sm text-ink-2">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>Du bist offline. Der Durchgang wird auf diesem Gerät gespeichert und automatisch übertragen, sobald wieder Empfang da ist.</span>
        </div>
      ) : null}

      {/* Schritt 1: Programm */}
      <section className="animate-rise">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">1 · Programm</h2>
        {program ? (
          <Card className="p-4 flex items-center gap-3 border-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-bg"><Check className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{program.name}</div>
              <div className="text-xs text-ink-3">{disciplineLabel(program.discipline)} · {formatDistances(program.totals.distances)} · {program.totals.shots} Schuss</div>
            </div>
            <button type="button" onClick={() => setProgramId("")} className="h-10 px-2 text-sm text-ink-3 hover:text-ink">Ändern</button>
          </Card>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Programm suchen…" aria-label="Programm suchen" className="w-full h-11 rounded-control border border-line bg-surface pl-10 pr-3.5 text-[15px] focus:outline-none focus:border-ink" />
            </div>
            <Card className="divide-y divide-line overflow-hidden max-h-80 overflow-y-auto">
              {filteredPrograms.map((p) => (
                <button key={p.id} type="button" onClick={() => setProgramId(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  {p.favorite ? <Star className="h-4 w-4 text-accent fill-current shrink-0" /> : <span className="w-4" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-ink-3">{disciplineLabel(p.discipline)} · {formatDistances(p.totals.distances)} · {p.totals.shots} Schuss</div>
                  </div>
                </button>
              ))}
              {filteredPrograms.length === 0 ? <p className="p-4 text-sm text-ink-3">Kein Programm gefunden.</p> : null}
            </Card>
          </>
        )}
      </section>

      {/* Schritt 2: Teilnehmer */}
      <section className={cn("animate-rise [animation-delay:80ms]", !program && "opacity-50 pointer-events-none")}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">2 · Teilnehmer</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {participants.map((p) => (
            <span key={p.key} className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-surface-2 pl-1 pr-2 h-10 text-sm">
              <Avatar name={p.name} src={p.avatarUrl} size={30} tone={p.isGuest ? "guest" : "ink"} />
              <span className="font-medium">{p.name}</span>
              {p.isGuest ? <span className="text-ink-3 text-xs">Gast</span> : null}
              {p.key !== "me" ? (
                <button type="button" onClick={() => remove(p.key)} className="-mr-1 flex h-8 w-8 items-center justify-center text-ink-3 hover:text-ink" aria-label={`${p.name} entfernen`}>
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          ))}
        </div>

        <Card className="divide-y divide-line overflow-hidden">
          {members.length ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-line">
              {members.map((m) => {
                const sel = selectedIds.has(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => toggleMember(m)} aria-pressed={sel} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                    <span className="relative">
                      <Avatar name={m.name} src={m.avatarUrl} size={36} tone={sel ? "ink" : "soft"} />
                      {sel ? (
                        <span className="animate-pop absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ok text-ok-ink ring-2 ring-surface">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </span>
                    <span className="flex-1 min-w-0"><span className="block font-medium truncate">{m.name}</span></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">Noch keine weiteren Mitglieder im Verein.</p>
          )}
          {showGuest ? (
            <div className="p-4 space-y-3 bg-surface-2/50">
              <Field label="Name des Gasts"><Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="z.B. Max (Besucher)" autoFocus /></Field>
              <Field label="Bemerkung (optional)"><Input value={guestNote} onChange={(e) => setGuestNote(e.target.value)} placeholder="z.B. Schnupperschiessen" /></Field>
              <div className="flex gap-2">
                <button type="button" onClick={addGuest} className="press h-11 px-4 rounded-control bg-ink text-bg text-sm font-medium">Hinzufügen</button>
                <button type="button" onClick={() => setShowGuest(false)} className="h-11 px-4 rounded-control text-sm text-ink-3">Abbrechen</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowGuest(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-ink-2 hover:bg-surface-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-line"><UserPlus className="h-4 w-4" /></span>
              <span className="font-medium">Gast hinzufügen</span>
            </button>
          )}
        </Card>
      </section>

      {/* Schritt 3: Details */}
      <section className={cn("animate-rise [animation-delay:160ms]", !program && "opacity-50 pointer-events-none")}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">3 · Details (optional)</h2>
        <Card className="p-4 space-y-3">
          <Field label="Titel"><Input name="title" maxLength={80} placeholder={program ? program.name : "z.B. Vereinsmeisterschaft"} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum"><Input name="date" type="date" defaultValue={today} /></Field>
            <Field label="Stand / Bahn"><Input name="locationNote" maxLength={120} placeholder="z.B. Bahn 3" /></Field>
          </div>
        </Card>
      </section>

      {error ? <Alert>{error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <Button type="submit" size="lg" className="w-full shadow-lg" disabled={!program || busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2"><Spinner /> Wird erstellt…</span>
          ) : (
            <><Plus className="h-5 w-5" /> Los geht&apos;s{offline ? " (offline)" : ""}</>
          )}
        </Button>
      </div>
    </form>
  );
}
