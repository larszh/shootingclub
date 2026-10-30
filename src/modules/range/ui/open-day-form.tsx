"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, ShieldAlert } from "lucide-react";
import { Alert, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { checkDutyQualificationAction, openDayAction } from "@/modules/range/actions";
import { RESPONSIBILITY_HINT } from "@/modules/range/types";
import { callAction } from "./action-call";

const QUAL_WARNING = "Für diese Person ist keine gültige Qualifikation als Schützenmeister oder Standchef erfasst. Du kannst trotzdem öffnen – bitte prüfen, ob die Aufsicht gemäss Vorgaben sichergestellt ist.";

export function OpenDayForm({ resources, members, currentUserId, currentQualified }: {
  resources: Array<{ id: string; name: string }>;
  members: Array<{ userId: string; name: string }>;
  currentUserId: string;
  currentQualified: boolean;
}) {
  const [resourceId, setResourceId] = useState("");
  const [dutyUserId, setDutyUserId] = useState(currentUserId);
  const [qualified, setQualified] = useState<boolean | null>(currentQualified);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [checking, startCheck] = useTransition();
  const router = useRouter();

  function changeDuty(id: string) {
    setDutyUserId(id);
    setQualified(null);
    if (!id) return;
    startCheck(async () => {
      try {
        const res = await checkDutyQualificationAction(id);
        setQualified(res.ok ? (res.data?.qualified ?? false) : false);
      } catch {
        setQualified(null);
      }
    });
  }

  function submit() {
    start(async () => {
      const res = await callAction(() => openDayAction({ resourceId: resourceId || null, dutyUserId: dutyUserId || null, notes }));
      if (res.ok && res.data) router.push(`/range?day=${res.data.id}`);
    });
  }

  return (
    <Card className="animate-rise space-y-4 p-4">
      <div className="flex items-center gap-2 font-semibold"><DoorOpen className="h-5 w-5" aria-hidden /> Stand öffnen</div>
      {resources.length ? (
        <Field label="Anlage">
          <Select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
            <option value="">Ganze Anlage</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
      ) : null}
      <Field label="Standdienst (Schützenmeister / Standchef)">
        <Select value={dutyUserId} onChange={(e) => changeDuty(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.userId === currentUserId ? " (ich)" : ""}</option>)}
        </Select>
      </Field>
      {checking ? <p className="text-sm text-ink-3">Qualifikation wird geprüft…</p> : qualified === false ? <Alert tone="warn" icon={<ShieldAlert className="h-4 w-4" />}>{QUAL_WARNING}</Alert> : null}
      <Field label="Notiz (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={5000} placeholder="z.B. Training 300 m, Jungschützen ab 14 Uhr" />
      </Field>
      <Button size="lg" className="h-14 w-full" onClick={submit} disabled={pending || !dutyUserId}>{pending ? <Spinner /> : null} Standbuch öffnen</Button>
      <p className="text-xs text-ink-3">{RESPONSIBILITY_HINT}</p>
    </Card>
  );
}
