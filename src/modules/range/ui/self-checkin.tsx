"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, LogOut } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { selfCheckInAction, selfCheckOutAction } from "@/modules/range/actions";
import { newClientId } from "@/modules/range/types";
import { callAction } from "./action-call";

export type SelfDay = { id: string; title: string; dutyName: string | null };

export function SelfCheckIn({ days, myVisit, rules, rulesAccepted, children }: {
  days: SelfDay[];
  myVisit: { id: string; since: string; title: string; hasWeapon: boolean } | null;
  rules: { id: string; version: number; title: string } | null;
  rulesAccepted: boolean;
  /** Text der Standordnung (serverseitig gerendert) */
  children?: React.ReactNode;
}) {
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [accept, setAccept] = useState(false);
  const [pending, start] = useTransition();
  const cid = useRef<string | null>(null);
  const router = useRouter();
  const needRules = !!rules && !rulesAccepted;

  function checkIn() {
    cid.current ??= newClientId();
    const clientId = cid.current;
    start(async () => {
      const res = await callAction(() => selfCheckInAction({ dayId, clientId, acceptRulesId: needRules && accept ? rules!.id : null }));
      if (res.ok) {
        cid.current = null;
        if (res.data && "needsRules" in res.data) router.refresh();
      } else if (!res.network) cid.current = null;
    });
  }

  function checkOut() {
    if (!myVisit) return;
    start(async () => {
      await callAction(() => selfCheckOutAction(myVisit.id));
    });
  }

  if (myVisit) {
    return (
      <Card className="animate-rise p-5 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-ok" aria-hidden />
        <h2 className="mt-2 text-lg font-semibold">Du bist eingecheckt</h2>
        <p className="text-sm text-ink-3">{myVisit.title} · seit {myVisit.since}</p>
        {myVisit.hasWeapon ? <Alert tone="info" className="mt-3 text-left">Du hast eine Vereinswaffe. Bitte beim Standdienst zurückgeben, er checkt dich dann aus.</Alert> : null}
        <Button size="lg" variant="secondary" className="mt-4 h-14 w-full" onClick={checkOut} disabled={pending || myVisit.hasWeapon}>
          {pending ? <Spinner /> : <LogOut className="h-5 w-5" />} Auschecken
        </Button>
      </Card>
    );
  }

  if (!days.length) {
    return (
      <Card className="animate-rise p-5 text-center">
        <h2 className="text-lg font-semibold">Der Stand ist geschlossen</h2>
        <p className="mt-1 text-sm text-ink-3">Zurzeit ist kein Standbuch offen. Bitte beim Standdienst melden.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {days.length > 1 ? (
        <div role="radiogroup" aria-label="Anlage wählen" className="grid gap-2">
          {days.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={d.id === dayId} onClick={() => setDayId(d.id)}
              className={cn("press flex min-h-14 items-center justify-between rounded-control border px-4 text-left", d.id === dayId ? "border-ink bg-surface-2" : "border-line bg-surface")}>
              <span className="font-medium">{d.title}</span>
              <span className="text-xs text-ink-3">{d.dutyName ? `Dienst: ${d.dutyName}` : ""}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-3">{days[0]!.title}{days[0]!.dutyName ? ` · Standdienst: ${days[0]!.dutyName}` : ""}</p>
      )}

      {needRules ? (
        <Card className="animate-rise p-4">
          <h2 className="font-semibold">{rules!.title} <span className="text-sm font-normal text-ink-3">(Version {rules!.version})</span></h2>
          <p className="mb-3 text-sm text-ink-3">Bitte vor dem ersten Schiessen lesen und bestätigen.</p>
          <div className="max-h-[45dvh] overflow-y-auto rounded-control border border-line bg-surface-2 p-3">{children}</div>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="h-6 w-6 shrink-0 accent-accent" />
            <span className="text-[15px]">Ich habe die Standordnung gelesen und halte mich daran.</span>
          </label>
        </Card>
      ) : null}

      <Button size="lg" className="h-16 w-full text-lg" onClick={checkIn} disabled={pending || !dayId || (needRules && !accept)}>
        {pending ? <Spinner /> : <LogIn className="h-6 w-6" />} Einchecken
      </Button>
    </div>
  );
}
