"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileUp, Upload } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { importParticipantsAction } from "@/modules/courses/actions";
import { chDate } from "@/modules/courses/logic";
import { IMPORT_COLUMNS } from "@/modules/courses/types";

/** CSV-Import von Teilnehmenden: Datei wählen → Vorschau → übernehmen. */
export function ImportForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(importParticipantsAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"preview" | "import">("preview");
  const rows = state?.ok ? state.data?.rows ?? [] : [];
  const imported = state?.ok ? state.data?.imported : undefined;
  const good = rows.filter((r) => !r.errors.length && !r.duplicate).length;
  const template = `﻿${IMPORT_COLUMNS.join(";")}\r\nLea;Muster;04.03.2010;lea@example.ch;079 000 00 00;Eva Muster;eva@example.ch;079 111 11 11\r\n`;
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`;

  return (
    <div className="space-y-4">
      <Card className="animate-rise space-y-3 p-4">
        <p className="text-sm text-ink-2">
          CSV-Datei mit Semikolon, erste Zeile mit den Spaltennamen: <span className="font-medium">{IMPORT_COLUMNS.join("; ")}</span>. Datum als TT.MM.JJJJ.
        </p>
        <a href={templateHref} download="kurs-teilnehmende-vorlage.csv" className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline-offset-2 hover:underline">Vorlage herunterladen</a>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("mode", "preview");
            setMode("preview");
            startTransition(() => action(fd));
          }}
          className="space-y-3"
        >
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Datei" hint="CSV, höchstens 2 MB">
            <Input type="file" name="file" accept=".csv,text/csv" required className="h-auto py-2.5" />
          </Field>
          <SubmitButton pending={pending && mode === "preview"} variant="secondary"><FileUp className="h-4 w-4" /> Vorschau</SubmitButton>
        </form>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      {imported ? (
        <Alert tone="ok" title={`${imported} Teilnehmende übernommen`}>
          <Link href={`/courses/${courseId}`} className="font-medium underline">Zurück zum Kurs</Link>
        </Alert>
      ) : null}

      {rows.length && !imported ? (
        <Card className="animate-rise overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <div className="text-sm">
              <span className="font-medium">{rows.length} Zeilen</span> · {good} können übernommen werden
            </div>
            <Button
              type="button"
              disabled={!good || pending}
              onClick={() => {
                setMode("import");
                const fd = new FormData(formRef.current!);
                fd.set("mode", "import");
                startTransition(() => action(fd));
              }}
            >
              <Upload className="h-4 w-4" /> {good} übernehmen
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.line} className="flex gap-3 px-4 py-3 text-sm">
                <span className="w-8 shrink-0 text-ink-3 tabular-nums">{r.line}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "–"}</span>
                    {r.birthDate ? <span className="text-ink-3">{chDate(r.birthDate)}</span> : null}
                    {r.errors.length ? <Badge tone="danger">Fehler</Badge> : r.duplicate ? <Badge tone="outline">bereits im Kurs</Badge> : <Badge tone="ok"><Check className="mr-1 h-3 w-3" /> ok</Badge>}
                  </div>
                  {r.guardianName ? <div className="text-xs text-ink-3">Erziehungsberechtigte: {r.guardianName}</div> : null}
                  {r.errors.map((e) => <div key={e} className="text-xs text-danger">{e}</div>)}
                  {r.warnings.map((w) => <div key={w} className="text-xs text-warn">{w}</div>)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
