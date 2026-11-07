"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, ShieldAlert } from "lucide-react";
import { Alert, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { checkDutyQualificationAction, openDayAction } from "@/modules/range/actions";
import { useT } from "@/components/locale";
import { callAction } from "./action-call";

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
  const t = useT();

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
      <div className="flex items-center gap-2 font-semibold"><DoorOpen className="h-5 w-5" aria-hidden /> {t("adm2.range.open.title")}</div>
      {resources.length ? (
        <Field label={t("adm2.common.resource")}>
          <Select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
            <option value="">{t("adm2.common.wholeFacility")}</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
      ) : null}
      <Field label={t("adm2.range.open.duty")}>
        <Select value={dutyUserId} onChange={(e) => changeDuty(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.userId === currentUserId ? t("adm2.common.me") : ""}</option>)}
        </Select>
      </Field>
      {checking ? <p className="text-sm text-ink-3">{t("adm2.range.open.checking")}</p> : qualified === false ? <Alert tone="warn" icon={<ShieldAlert className="h-4 w-4" />}>{t("adm2.range.open.qualWarning")}</Alert> : null}
      <Field label={t("adm2.common.noteOptional")}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={5000} placeholder={t("adm2.range.open.notePlaceholder")} />
      </Field>
      <Button size="lg" className="h-14 w-full" onClick={submit} disabled={pending || !dutyUserId}>{pending ? <Spinner /> : null} {t("adm2.range.open.submit")}</Button>
      <p className="text-xs text-ink-3">{t("adm2.range.responsibility")}</p>
    </Card>
  );
}
