"use client";

import { startTransition, useActionState, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { deleteAccountAction } from "./actions";
import { Alert, Card, Field } from "@/components/ui";
import { PasswordInput } from "@/components/ui/controls";
import { SubmitButton } from "@/components/ui/form";
import { confirmDialog } from "@/components/ui/dialog";
import { buttonClasses } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

export function ExportCard() {
  const t = useT();
  return (
    <Card className="animate-rise p-4">
      <p className="text-sm text-ink-2">
        {t("shell.privacy.exportText")}
      </p>
      <a href="/api/export/me" download className={cn(buttonClasses("secondary", "md"), "mt-3 w-full sm:w-auto")}>
        <Download className="h-4 w-4" /> {t("shell.privacy.download")}
      </a>
    </Card>
  );
}

export function DeleteAccountCard({ blockers }: { blockers: string[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(deleteAccountAction, null);
  const [open, setOpen] = useState(false);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  if (blockers.length) {
    return (
      <Card className="animate-rise p-4">
        <Alert tone="warn" title={t("shell.privacy.blockedTitle")}>
          {t("shell.privacy.blockedText", { clubs: blockers.map((b) => t("shell.quoted", { text: b })).join(", ") })}
        </Alert>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card className="animate-rise p-4">
        <p className="text-sm text-ink-2">{t("shell.privacy.deleteIntro")}</p>
        <button type="button" onClick={() => setOpen(true)} className={cn(buttonClasses("secondary", "md"), "mt-3 w-full sm:w-auto text-danger")}>
          <Trash2 className="h-4 w-4" /> {t("shell.privacy.deleteOpen")}
        </button>
      </Card>
    );
  }

  return (
    <Card className="animate-rise p-4 border-danger/40">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const ok = await confirmDialog({ title: t("shell.privacy.confirmTitle"), message: t("shell.privacy.confirmText"), tone: "danger", confirmLabel: t("shell.privacy.confirmLabel") });
          if (ok) startTransition(() => formAction(fd));
        }}
        className="space-y-3"
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>{t("shell.privacy.effect1")}</li>
          <li>{t("shell.privacy.effect2")}</li>
          <li>{t("shell.privacy.effect3")}</li>
          <li>{t("shell.privacy.effect4")}</li>
        </ul>
        <Field label={t("shell.privacy.yourPassword")} error={errors.password}>
          <PasswordInput name="password" autoComplete="current-password" required maxLength={191} />
        </Field>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="confirm" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-danger)]" required />
          <span>{t("shell.privacy.understood")}</span>
        </label>
        {state && !state.ok ? <Alert>{state.error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={() => setOpen(false)} className={buttonClasses("secondary", "md")}>{t("shell.common.cancel")}</button>
          <SubmitButton variant="danger" pending={pending} pendingText={t("shell.privacy.deleting")}>{t("shell.privacy.deleteFinal")}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
