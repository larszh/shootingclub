"use client";

import { useActionState, useState } from "react";
import { Check, Plus, Search, Star, UserPlus, X } from "lucide-react";
import { createMatchAction } from "@/modules/scores/actions";
import { disciplineLabel, formatDistances } from "@/modules/scores/types";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { cn, initials } from "@/lib/utils";

type ProgramOpt = { id: string; name: string; discipline: string; shots: number; stages: number; favorite: boolean; distances: number[] };
type Member = { id: string; name: string; email: string };
type Participant = { key: string; userId?: string; guestName?: string; name: string; isGuest: boolean; note?: string };

export function MatchSetup({ programs, members, me, initialProgramId }: { programs: ProgramOpt[]; members: Member[]; me: { id: string; name: string }; initialProgramId?: string }) {
  const [state, action] = useActionState(createMatchAction, null);
  const [programId, setProgramId] = useState(initialProgramId && programs.some((p) => p.id === initialProgramId) ? initialProgramId : "");
  const [q, setQ] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([{ key: "me", userId: me.id, name: me.name, isGuest: false }]);
  const [guestName, setGuestName] = useState("");
  const [guestNote, setGuestNote] = useState("");
  const [showGuest, setShowGuest] = useState(false);

  const program = programs.find((p) => p.id === programId);
  const sorted = [...programs].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  const filteredPrograms = sorted.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const selectedIds = new Set(participants.filter((p) => p.userId).map((p) => p.userId));

  const toggleMember = (m: Member) => {
    setParticipants((ps) => (ps.some((p) => p.userId === m.id) ? ps.filter((p) => p.userId !== m.id) : [...ps, { key: m.id, userId: m.id, name: m.name, isGuest: false }]));
  };
  const addGuest = () => {
    const name = guestName.trim() || "Gast";
    setParticipants((ps) => [...ps, { key: `g-${Date.now()}`, guestName: name, name, isGuest: true, note: guestNote.trim() || undefined }]);
    setGuestName("");
    setGuestNote("");
    setShowGuest(false);
  };
  const remove = (key: string) => setParticipants((ps) => ps.filter((p) => p.key !== key));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="participantsJson" value={JSON.stringify(participants.map((p) => ({ userId: p.userId, guestName: p.guestName, note: p.note })))} />

      {/* Schritt 1: Programm */}
      <section className="animate-rise">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">1 · Programm</h2>
        {program ? (
          <Card className="p-4 flex items-center gap-3 border-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-bg"><Check className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{program.name}</div>
              <div className="text-xs text-ink-3">{disciplineLabel(program.discipline)} · {formatDistances(program.distances)} · {program.shots} Schuss</div>
            </div>
            <button type="button" onClick={() => setProgramId("")} className="text-sm text-ink-3 hover:text-ink">Ändern</button>
          </Card>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Programm suchen…" className="w-full h-11 rounded-control border border-line bg-surface pl-10 pr-3.5 text-[15px] focus:outline-none focus:border-ink" />
            </div>
            <Card className="divide-y divide-line overflow-hidden max-h-80 overflow-y-auto">
              {filteredPrograms.map((p) => (
                <button key={p.id} type="button" onClick={() => setProgramId(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  {p.favorite ? <Star className="h-4 w-4 text-accent fill-current shrink-0" /> : <span className="w-4" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-ink-3">{disciplineLabel(p.discipline)} · {formatDistances(p.distances)} · {p.shots} Schuss</div>
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
            <span key={p.key} className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-surface-2 pl-1 pr-2 h-9 text-sm">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold", p.isGuest ? "bg-warn/20 text-warn" : "bg-ink text-bg")}>{initials(p.name)}</span>
              <span className="font-medium">{p.name}</span>
              {p.isGuest ? <span className="text-ink-3 text-xs">Gast</span> : null}
              {p.key !== "me" ? <button type="button" onClick={() => remove(p.key)} className="ml-0.5 text-ink-3 hover:text-ink" aria-label="Entfernen"><X className="h-3.5 w-3.5" /></button> : null}
            </span>
          ))}
        </div>

        <Card className="divide-y divide-line overflow-hidden">
          {members.length ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-line">
              {members.map((m) => {
                const sel = selectedIds.has(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => toggleMember(m)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", sel ? "bg-ink text-bg" : "bg-surface-2 text-ink-2")}>{sel ? <Check className="h-4 w-4" /> : initials(m.name)}</span>
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
                <button type="button" onClick={addGuest} className="press h-10 px-4 rounded-control bg-ink text-bg text-sm font-medium">Hinzufügen</button>
                <button type="button" onClick={() => setShowGuest(false)} className="h-10 px-4 rounded-control text-sm text-ink-3">Abbrechen</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowGuest(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-ink-2 hover:bg-surface-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-line"><UserPlus className="h-4 w-4" /></span>
              <span className="font-medium">Gast hinzufügen</span>
            </button>
          )}
        </Card>
      </section>

      {/* Schritt 3: Details */}
      <section className={cn("animate-rise [animation-delay:160ms]", !program && "opacity-50 pointer-events-none")}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2">3 · Details (optional)</h2>
        <Card className="p-4 space-y-3">
          <Field label="Titel"><Input name="title" placeholder={program ? program.name : "z.B. Vereinsmeisterschaft"} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Stand / Bahn"><Input name="locationNote" placeholder="z.B. Bahn 3" /></Field>
          </div>
        </Card>
      </section>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <div className="sticky bottom-24 md:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg" disabled={!program} pendingText="Wird erstellt…"><Plus className="h-5 w-5" /> Los geht&apos;s</SubmitButton>
      </div>
    </form>
  );
}
