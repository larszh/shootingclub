"use client";

import { useTransition } from "react";
import { Play, RotateCw, Send } from "lucide-react";
import { retryAllFailedMailsAction, retryMailAction, runJobAction, sendTestMailAction } from "./actions";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/components/locale";
import type { TFunction } from "@/lib/i18n/core";

function report(res: ActionResult, t: TFunction) {
  if (res.ok) toast.success(res.message ?? t("adm2.super.sys.done"));
  else toast.error(res.error);
}

export function TestMailButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => report(await sendTestMailAction(), t))}>
      {pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />} {t("adm2.super.sys.testMail", { email })}
    </Button>
  );
}

export function JobRunButton({ name }: { name: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <Button type="button" variant="secondary" size="sm" className="h-11" disabled={pending} aria-label={t("adm2.super.sys.runAria", { name })} onClick={() => start(async () => report(await runJobAction(name), t))}>
      {pending ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} {t("adm2.super.sys.now")}
    </Button>
  );
}

export function RetryAllButton() {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <button type="button" disabled={pending} className="text-sm font-medium text-ink-2 hover:text-ink disabled:opacity-50" onClick={() => start(async () => report(await retryAllFailedMailsAction(), t))}>
      {pending ? t("adm2.super.sys.queuing") : t("adm2.super.sys.retryAll")}
    </button>
  );
}

export function FailedMailRow({ id, to, subject, kind, attempts, error, createdAt }: { id: string; to: string; subject: string; kind: string; attempts: number; error: string; createdAt: string }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{subject}</p>
        <p className="truncate text-xs text-ink-3">{to} · {kind} · {createdAt} · {t("adm2.super.sys.attempts", { n: attempts })}</p>
        {error ? <p className="mt-1 break-words text-xs text-danger">{error}</p> : null}
      </div>
      <Button type="button" variant="secondary" size="sm" className="h-11 shrink-0" disabled={pending} onClick={() => start(async () => report(await retryMailAction(id), t))}>
        {pending ? <Spinner /> : <RotateCw className="h-4 w-4" aria-hidden />} {t("adm2.super.sys.retry")}
      </Button>
    </div>
  );
}
