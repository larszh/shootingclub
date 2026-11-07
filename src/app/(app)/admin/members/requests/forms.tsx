"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button, Field, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { Switch } from "@/components/ui/controls";
import { isNavigationError, isNetworkError, toast } from "@/lib/ui-feedback";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { approveJoinRequestAction, rejectJoinRequestAction, setJoinApprovalAction } from "@/modules/core/join-requests";

function failureMessage(t: TFunction, err: unknown) {
  if (isNavigationError(err)) throw err;
  return isNetworkError(err) ? t("adm1.common.offline") : t("adm1.common.failed");
}

export function JoinApprovalToggle({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const t = getT(locale);
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Switch
      label={t("adm1.req.toggle")}
      description={t("adm1.req.toggleHint")}
      checked={on}
      disabled={pending}
      onChange={(v) => {
        setOn(v);
        start(async () => {
          try {
            const r = await setJoinApprovalAction(v);
            if (!r.ok) { setOn(!v); toast.error(r.error); } else toast.success(r.message ?? t("adm1.common.saved"));
          } catch (e) {
            setOn(!v);
            toast.error(failureMessage(t, e));
          }
          router.refresh();
        });
      }}
    />
  );
}

export function JoinRequestRow({ locale, membershipId, name, email, avatarUrl, since }: { locale: Locale; membershipId: string; name: string; email: string | null; avatarUrl: string | null; since: string }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? t("adm1.common.error"));
        else { setRejecting(false); toast.success(r.message ?? t("adm1.common.saved")); }
      } catch (e) {
        toast.error(failureMessage(t, e));
      }
      router.refresh();
    });
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatarUrl} size={40} tone="soft" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{name}</div>
          <div className="text-xs text-ink-3 truncate">{email ? `${email} · ` : ""}{t("adm1.req.requested", { date: since })}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" disabled={pending} onClick={() => run(() => approveJoinRequestAction(membershipId))}><Check className="h-4 w-4" /> {t("adm1.req.approve")}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => { setReason(""); setRejecting(true); }}><X className="h-4 w-4" /> {t("adm1.req.reject")}</Button>
      </div>
      <Dialog
        open={rejecting}
        onClose={() => { if (!pending) setRejecting(false); }}
        title={t("adm1.req.rejectTitle", { name })}
        description={t("adm1.req.rejectHint")}
        dismissible={!pending}
        footer={
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setRejecting(false)}>{t("adm1.common.cancel")}</Button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => run(() => rejectJoinRequestAction(membershipId, reason.trim() || undefined))}>{pending ? <Spinner /> : null} {t("adm1.req.reject")}</Button>
          </div>
        }
      >
        <Field label={t("adm1.req.reason")}>
          <Textarea name="reason" rows={3} maxLength={191} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
