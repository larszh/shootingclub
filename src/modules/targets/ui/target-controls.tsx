"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { deleteTargetAction, setTargetHiddenAction } from "@/modules/targets/actions";
import { Button } from "@/components/ui";

export function TargetHiddenToggle({ targetId, hidden }: { targetId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => start(() => setTargetHiddenAction(targetId, !hidden).then(() => undefined))}>
      {hidden ? <><Eye className="h-4 w-4" /> Im Verein anzeigen</> : <><EyeOff className="h-4 w-4" /> Im Verein verstecken</>}
    </Button>
  );
}

export function TargetDeleteButton({ targetId, redirectTo = "/targets" }: { targetId: string; redirectTo?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-ink-3"
      onClick={() => { if (confirm("Scheibe wirklich löschen?")) start(async () => { const r = await deleteTargetAction(targetId); if (r.ok) router.push(redirectTo); }); }}>
      <Trash2 className="h-4 w-4" /> Löschen
    </Button>
  );
}
