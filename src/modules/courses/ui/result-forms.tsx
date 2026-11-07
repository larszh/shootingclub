"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Plus } from "lucide-react";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { isNetworkError } from "@/lib/ui-feedback";
import { linkMatchResultAction, saveResultAction } from "@/modules/courses/actions";
import { useT } from "@/components/locale";

type ProgramOpt = { id: string; name: string; passMinScore: number | null; passMaxZeros: number | null };

function useRun() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }>, onOk?: () => void) {
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.message) toast.success(res.message);
        onOk?.();
        router.refresh();
      } catch (err) {
        toast.error(isNetworkError(err) ? t("adm2.common.network") : t("adm2.courses.res.failedShort"));
      }
    });
  }
  return { pending, run };
}

/** Resultat von Hand erfassen (Punkte, bestanden, Datum). */
export function ManualResultForm({ participantId, programs, today, defaultProgramId }: { participantId: string; programs: ProgramOpt[]; today: string; defaultProgramId?: string }) {
  const { pending, run } = useRun();
  const t = useT();
  const [programId, setProgramId] = useState(defaultProgramId ?? programs[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [score, setScore] = useState("");
  const [passed, setPassed] = useState(false);
  const [passedTouched, setPassedTouched] = useState(false);
  const [date, setDate] = useState(today);
  const prog = programs.find((p) => p.id === programId) ?? null;

  function changeScore(s: string) {
    setScore(s);
    const n = Number(s.replace(",", "."));
    if (!passedTouched && prog?.passMinScore != null && s.trim() && Number.isFinite(n)) setPassed(n >= prog.passMinScore);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => saveResultAction({ participantId, programId: programId || null, label, score, passed, date }),
      () => {
        setScore("");
        setLabel("");
        setPassed(false);
        setPassedTouched(false);
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("adm2.courses.res.program")}>
          <Select value={programId} onChange={(e) => { setProgramId(e.target.value); setPassedTouched(false); }}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="">{t("adm2.courses.res.other")}</option>
          </Select>
        </Field>
        {programId === "" ? (
          <Field label={t("adm2.courses.res.label")}><Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={191} required /></Field>
        ) : (
          <div className="self-end pb-2 text-xs text-ink-3">
            {prog?.passMinScore != null ? `${t("adm2.courses.res.passFrom", { min: prog.passMinScore })}${prog.passMaxZeros != null ? t("adm2.courses.res.passZeros", { max: prog.passMaxZeros }) : ""}${t("adm2.courses.res.fromProgram")}` : t("adm2.courses.res.noLimit")}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("adm2.courses.res.points")}><Input value={score} onChange={(e) => changeScore(e.target.value)} inputMode="decimal" placeholder={t("adm2.courses.res.pointsPh")} /></Field>
        <Field label={t("adm2.common.date")}><Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required /></Field>
      </div>
      <Switch label={t("adm2.courses.res.passed")} checked={passed} onChange={(v) => { setPassed(v); setPassedTouched(true); }} />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? <Spinner /> : <Plus className="h-4 w-4" />} {t("adm2.courses.res.add")}</Button>
    </form>
  );
}

export type MatchCandidate = { id: string; programName: string; dateLabel: string; total: number | null; zeros: number | null; suggestedPassed: boolean; officialHint: string | null; linked: boolean };

/** Abgeschlossene Durchgänge des Mitglieds übernehmen. */
export function LinkMatchList({ participantId, candidates }: { participantId: string; candidates: MatchCandidate[] }) {
  const t = useT();
  if (!candidates.length) return <p className="text-sm text-ink-3">{t("adm2.courses.res.noMatches")}</p>;
  return (
    <ul className="divide-y divide-line">
      {candidates.map((c) => <CandidateRow key={c.id} participantId={participantId} c={c} />)}
    </ul>
  );
}

function CandidateRow({ participantId, c }: { participantId: string; c: MatchCandidate }) {
  const { pending, run } = useRun();
  const t = useT();
  const [passed, setPassed] = useState(c.suggestedPassed);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{c.programName}</div>
        <div className="text-xs text-ink-3">
          {c.dateLabel} · {t("adm2.courses.res.pointsN", { n: c.total ?? "–" })}{c.zeros != null ? t("adm2.courses.res.zerosN", { n: c.zeros }) : ""}{c.officialHint ? ` · ${c.officialHint}` : ""}
        </div>
      </div>
      {c.linked ? (
        <Badge tone="ok">{t("adm2.courses.res.taken")}</Badge>
      ) : (
        <div className="flex items-center gap-3">
          <Switch label={<span className="text-sm">{t("adm2.courses.res.passedSmall")}</span>} checked={passed} onChange={setPassed} />
          <Button type="button" size="md" variant="secondary" disabled={pending} onClick={() => run(() => linkMatchResultAction({ participantId, matchParticipantId: c.id, passed }))}>
            {pending ? <Spinner /> : <Link2 className="h-4 w-4" />} {t("adm2.courses.res.take")}
          </Button>
        </div>
      )}
    </li>
  );
}
