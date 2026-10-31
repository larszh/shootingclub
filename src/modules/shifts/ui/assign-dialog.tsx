"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, UserPlus } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { assignMembersAction } from "@/modules/shifts/actions";

export type AssignMember = { userId: string; name: string; memberNumber: string | null; qualified: boolean };

/** Mitglieder einteilen (Mehrfachauswahl mit Suche). Qualifizierte Personen sind markiert. */
export function AssignButton({ shiftId, members, open: openSlots, qualificationLabel }: { shiftId: string; members: AssignMember[]; open: number; qualificationLabel: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!members.length}><UserPlus className="h-4 w-4" /> Einteilen</Button>
      {open ? <AssignDialog shiftId={shiftId} members={members} openSlots={openSlots} qualificationLabel={qualificationLabel} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AssignDialog({ shiftId, members, openSlots, qualificationLabel, onClose }: { shiftId: string; members: AssignMember[]; openSlots: number; qualificationLabel: string | null; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? members.filter((m) => m.name.toLowerCase().includes(q) || (m.memberNumber ?? "").toLowerCase().includes(q)) : members;
    // Qualifizierte zuerst, wenn eine Qualifikation verlangt ist
    return qualificationLabel ? [...filtered].sort((a, b) => Number(b.qualified) - Number(a.qualified)) : filtered;
  }, [members, query, qualificationLabel]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        const r = await assignMembersAction(shiftId, [...picked]);
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Eingeteilt.");
        onClose();
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  const over = picked.size > openSlots;
  return (
    <Dialog open onClose={onClose} title="Mitglieder einteilen" description={openSlots > 0 ? `Noch ${openSlots} ${openSlots === 1 ? "Platz" : "Plätze"} frei.` : "Alle Plätze sind besetzt."} size="lg"
      footer={<Button onClick={submit} disabled={pending || !picked.size}>{pending ? <Spinner /> : <Check className="h-4 w-4" />} {picked.size ? `${picked.size} einteilen` : "Einteilen"}</Button>}>
      <div className="space-y-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name oder Nummer suchen" className="pl-9" aria-label="Mitglied suchen" data-autofocus />
        </div>
        <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-control border border-line">
          {list.length === 0 ? <li className="p-4 text-sm text-ink-3">Niemand gefunden.</li> : null}
          {list.map((m) => {
            const on = picked.has(m.userId);
            return (
              <li key={m.userId}>
                <button type="button" onClick={() => toggle(m.userId)} aria-pressed={on}
                  className={cn("flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2", on && "bg-accent-soft")}>
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-accent bg-accent text-white" : "border-line")} aria-hidden>{on ? <Check className="h-4 w-4" /> : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{m.name}</span>
                    {m.memberNumber ? <span className="block text-xs text-ink-3">Nr. {m.memberNumber}</span> : null}
                  </span>
                  {qualificationLabel && m.qualified ? <span className="shrink-0 rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">{qualificationLabel}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {over ? <Alert tone="warn">Mehr Personen als freie Plätze ausgewählt. Das ist möglich, der Einsatz ist dann überbesetzt.</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}
