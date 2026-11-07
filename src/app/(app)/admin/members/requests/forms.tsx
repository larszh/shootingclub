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
import { approveJoinRequestAction, rejectJoinRequestAction, setJoinApprovalAction } from "@/modules/core/join-requests";

function failureMessage(err: unknown) {
  if (isNavigationError(err)) throw err;
  return isNetworkError(err) ? "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist." : "Das hat nicht geklappt. Bitte nochmals versuchen.";
}

export function JoinApprovalToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Switch
      label="Beitritt mit Freigabe"
      description="Beitritt per Code erst nach Prüfung durch die Verwaltung."
      checked={on}
      disabled={pending}
      onChange={(v) => {
        setOn(v);
        start(async () => {
          try {
            const r = await setJoinApprovalAction(v);
            if (!r.ok) { setOn(!v); toast.error(r.error); } else toast.success(r.message ?? "Gespeichert.");
          } catch (e) {
            setOn(!v);
            toast.error(failureMessage(e));
          }
          router.refresh();
        });
      }}
    />
  );
}

export function JoinRequestRow({ membershipId, name, email, avatarUrl, since }: { membershipId: string; name: string; email: string | null; avatarUrl: string | null; since: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) toast.error(r.error ?? "Fehler");
        else { setRejecting(false); toast.success(r.message ?? "Gespeichert."); }
      } catch (e) {
        toast.error(failureMessage(e));
      }
      router.refresh();
    });
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatarUrl} size={40} tone="soft" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{name}</div>
          <div className="text-xs text-ink-3 truncate">{email ? `${email} · ` : ""}angefragt {since}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" disabled={pending} onClick={() => run(() => approveJoinRequestAction(membershipId))}><Check className="h-4 w-4" /> Freigeben</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => { setReason(""); setRejecting(true); }}><X className="h-4 w-4" /> Ablehnen</Button>
      </div>
      <Dialog
        open={rejecting}
        onClose={() => { if (!pending) setRejecting(false); }}
        title={`Anfrage von ${name} ablehnen?`}
        description="Die Person erhält eine Mitteilung und kann später erneut anfragen."
        dismissible={!pending}
        footer={
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setRejecting(false)}>Abbrechen</Button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => run(() => rejectJoinRequestAction(membershipId, reason.trim() || undefined))}>{pending ? <Spinner /> : null} Ablehnen</Button>
          </div>
        }
      >
        <Field label="Grund (optional)">
          <Textarea name="reason" rows={3} maxLength={191} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
