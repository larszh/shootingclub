"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { MATCH_PERIODS } from "@/modules/scores/analytics";

export type MatchFilterValues = { q?: string; programId?: string; status?: string; period?: string };

/** Filter für die Durchgangsliste. GET-Formular: funktioniert auch ohne JavaScript, Links bleiben teilbar. */
export function MatchFilters({ values, programs }: { values: MatchFilterValues; programs: Array<{ id: string; name: string }> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const active = Boolean(values.q || values.programId || values.status || values.period);
  return (
    <Form ref={formRef} action="/scores/matches" scroll={false} className="animate-fade mb-4 space-y-2" role="search" aria-label="Durchgänge filtern">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input type="search" name="q" defaultValue={values.q ?? ""} placeholder="Teilnehmer suchen…" aria-label="Teilnehmer suchen" className="pl-10" maxLength={60} enterKeyHint="search" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select name="programId" defaultValue={values.programId ?? ""} onChange={submit} aria-label="Programm" className="col-span-2 sm:col-span-1">
          <option value="">Alle Programme</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select name="status" defaultValue={values.status ?? ""} onChange={submit} aria-label="Status">
          <option value="">Alle Status</option>
          <option value="OPEN">Offen</option>
          <option value="FINISHED">Abgeschlossen</option>
        </Select>
        <Select name="period" defaultValue={values.period ?? ""} onChange={submit} aria-label="Zeitraum">
          {MATCH_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="submit" className="sr-only">Filtern</button>
        {active ? (
          <Link href="/scores/matches" scroll={false} className="press inline-flex h-9 items-center gap-1 rounded-control px-2 text-sm text-ink-3 hover:text-ink">
            <X className="h-4 w-4" /> Filter zurücksetzen
          </Link>
        ) : <span />}
      </div>
    </Form>
  );
}
