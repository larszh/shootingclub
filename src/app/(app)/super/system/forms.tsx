"use client";

import { useTransition } from "react";
import { Play, RotateCw, Send } from "lucide-react";
import { retryAllFailedMailsAction, retryMailAction, runJobAction, sendTestMailAction } from "./actions";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";

function report(res: ActionResult) {
  if (res.ok) toast.success(res.message ?? "Erledigt");
  else toast.error(res.error);
}

export function TestMailButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => report(await sendTestMailAction()))}>
      {pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />} Testmail an mich ({email})
    </Button>
  );
}

export function JobRunButton({ name }: { name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="sm" className="h-11" disabled={pending} aria-label={`Job ${name} jetzt ausführen`} onClick={() => start(async () => report(await runJobAction(name)))}>
      {pending ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} Jetzt
    </Button>
  );
}

export function RetryAllButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="text-sm font-medium text-ink-2 hover:text-ink disabled:opacity-50" onClick={() => start(async () => report(await retryAllFailedMailsAction()))}>
      {pending ? "Wird eingereiht…" : "Alle erneut senden"}
    </button>
  );
}

export function FailedMailRow({ id, to, subject, kind, attempts, error, createdAt }: { id: string; to: string; subject: string; kind: string; attempts: number; error: string; createdAt: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{subject}</p>
        <p className="truncate text-xs text-ink-3">{to} · {kind} · {createdAt} · {attempts} Versuche</p>
        {error ? <p className="mt-1 break-words text-xs text-danger">{error}</p> : null}
      </div>
      <Button type="button" variant="secondary" size="sm" className="h-11 shrink-0" disabled={pending} onClick={() => start(async () => report(await retryMailAction(id)))}>
        {pending ? <Spinner /> : <RotateCw className="h-4 w-4" aria-hidden />} Erneut senden
      </Button>
    </div>
  );
}
