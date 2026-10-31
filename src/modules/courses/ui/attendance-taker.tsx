"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Save, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { isNetworkError } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { saveAttendanceAction } from "@/modules/courses/actions";

type Person = { id: string; name: string; sub: string | null; present: boolean | null };

/** Präsenz am Handy: grosse Umschalter pro Person, «Alle anwesend», Speichern. */
export function AttendanceTaker({ sessionId, people, backHref }: { sessionId: string; people: Person[]; backHref: string }) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, boolean | null>>(() => Object.fromEntries(people.map((p) => [p.id, p.present])));
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const presentCount = Object.values(marks).filter((x) => x === true).length;
  const open = Object.values(marks).filter((x) => x === null).length;

  function setMark(id: string, v: boolean) {
    setMarks((m) => ({ ...m, [id]: v }));
    setDirty(true);
  }
  function allPresent() {
    setMarks(Object.fromEntries(people.map((p) => [p.id, true])));
    setDirty(true);
  }

  function save(thenBack: boolean) {
    // Nicht erfasste gelten beim Speichern als abwesend.
    const entries = people.map((p) => ({ participantId: p.id, present: marks[p.id] === true }));
    start(async () => {
      try {
        const res = await saveAttendanceAction(sessionId, entries);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Gespeichert.");
        setMarks(Object.fromEntries(entries.map((e) => [e.participantId, e.present])));
        setDirty(false);
        if (thenBack) router.push(backHref);
        else router.refresh();
      } catch (err) {
        toast.error(isNetworkError(err) ? "Keine Verbindung. Bitte nochmals speichern, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.");
      }
    });
  }

  if (!people.length) return <p className="text-sm text-ink-3">Noch keine aktiven Teilnehmenden.</p>;

  return (
    <div className="pb-24">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-ink-2" aria-live="polite">
          <span className="font-semibold tabular-nums text-ink">{presentCount}</span> von {people.length} anwesend{open ? ` · ${open} offen` : ""}
        </div>
        <Button type="button" variant="secondary" onClick={allPresent}><CheckCheck className="h-4 w-4" /> Alle anwesend</Button>
      </div>
      <ul className="space-y-2">
        {people.map((p) => {
          const v = marks[p.id];
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-medium">{p.name}</div>
                {p.sub ? <div className="truncate text-xs text-ink-3">{p.sub}</div> : null}
              </div>
              <div role="group" aria-label={`Präsenz ${p.name}`} className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-pressed={v === true}
                  aria-label={`${p.name} anwesend`}
                  onClick={() => setMark(p.id, true)}
                  className={cn(
                    "press inline-flex h-14 w-16 items-center justify-center rounded-control border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                    v === true ? "border-ok bg-ok text-white" : "border-line bg-surface-2 text-ink-3",
                  )}
                >
                  <Check className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-pressed={v === false}
                  aria-label={`${p.name} abwesend`}
                  onClick={() => setMark(p.id, false)}
                  className={cn(
                    "press inline-flex h-14 w-16 items-center justify-center rounded-control border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                    v === false ? "border-danger bg-danger text-white" : "border-line bg-surface-2 text-ink-3",
                  )}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-4 md:left-64 md:px-8">
        <div className="mx-auto flex max-w-xl gap-2 rounded-card border border-line bg-surface/95 p-2 shadow-lg backdrop-blur">
          <Button type="button" className="flex-1" disabled={pending} onClick={() => save(true)} aria-busy={pending || undefined}>
            {pending ? <Spinner /> : <Save className="h-4 w-4" />} Speichern &amp; zurück
          </Button>
          {dirty ? <Button type="button" variant="secondary" disabled={pending} onClick={() => save(false)}>Speichern</Button> : null}
        </div>
      </div>
    </div>
  );
}
