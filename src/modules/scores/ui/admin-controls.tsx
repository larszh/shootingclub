"use client";

import { useTransition } from "react";
import { Archive, Eye, EyeOff } from "lucide-react";
import { archiveProgramAction, setProgramHiddenAction } from "@/modules/scores/actions";
import { Button } from "@/components/ui";

export function ProgramHiddenToggle({ programId, hidden }: { programId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => start(() => setProgramHiddenAction(programId, !hidden).then(() => undefined))}>
      {hidden ? <><Eye className="h-4 w-4" /> Im Verein anzeigen</> : <><EyeOff className="h-4 w-4" /> Im Verein verstecken</>}
    </Button>
  );
}

export function ProgramArchiveButton({ programId, archived }: { programId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending}
      onClick={() => { if (archived || confirm("Programm archivieren? Bestehende Durchgänge bleiben erhalten.")) start(() => archiveProgramAction(programId, !archived).then(() => undefined)); }}>
      <Archive className="h-4 w-4" /> {archived ? "Wiederherstellen" : "Archivieren"}
    </Button>
  );
}
