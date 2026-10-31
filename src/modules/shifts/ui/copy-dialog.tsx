"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { copyShiftAction } from "@/modules/shifts/actions";
import { MAX_COPIES, expandTemplateDates, weekdayOf } from "@/modules/shifts/logic";
import { WEEKDAYS } from "@/modules/shifts/types";

/** Einsatz als Vorlage auf mehrere Daten kopieren, z.B. jeden Samstag der Saison. */
export function CopyShiftButton({ shiftId, day, suggestTo }: { shiftId: string; day: string; suggestTo: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Copy className="h-4 w-4" /> Auf mehrere Daten kopieren</Button>
      {open ? <CopyDialog shiftId={shiftId} day={day} suggestTo={suggestTo} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CopyDialog({ shiftId, day, suggestTo, onClose }: { shiftId: string; day: string; suggestTo: string; onClose: () => void }) {
  const router = useRouter();
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(suggestTo);
  const [weekdays, setWeekdays] = useState<number[]>([weekdayOf(day)]);
  const [every, setEvery] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dates = useMemo(() => expandTemplateDates({ from, to, weekdays, everyWeeks: Number(every), exclude: [day], max: MAX_COPIES + 1 }), [from, to, weekdays, every, day]);
  const tooMany = dates.length > MAX_COPIES;
  const fmt = (d: string) => new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${d}T12:00:00Z`));

  function toggle(w: number) {
    setWeekdays((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        const r = await copyShiftAction(shiftId, { from, to, weekdays, everyWeeks: Number(every) });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Kopiert.");
        onClose();
        router.push("/admin/shifts");
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title="Auf mehrere Daten kopieren" description="Gleiche Zeit, Besetzung und Anforderung. Einteilungen und Anlass werden nicht übernommen." size="lg"
      footer={<Button onClick={submit} disabled={pending || !dates.length || tooMany}>{pending ? <Spinner /> : <Copy className="h-4 w-4" />} {dates.length && !tooMany ? `${dates.length} Einsätze anlegen` : "Anlegen"}</Button>}>
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Bis"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2" id="copy-weekdays">Wochentage</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="copy-weekdays">
            {WEEKDAYS.map((w) => {
              const on = weekdays.includes(w.value);
              return (
                <button key={w.value} type="button" aria-pressed={on} aria-label={w.label} onClick={() => toggle(w.value)}
                  className={cn("press h-11 min-w-11 rounded-full border px-3 text-sm font-medium", on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
                  {w.short}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Wiederholung">
          <Select value={every} onChange={(e) => setEvery(e.target.value)}>
            <option value="1">jede Woche</option>
            <option value="2">alle 2 Wochen</option>
            <option value="3">alle 3 Wochen</option>
            <option value="4">alle 4 Wochen</option>
          </Select>
        </Field>
        <div className="rounded-control bg-surface-2 p-3 text-sm">
          {dates.length === 0 ? <span className="text-ink-3">Keine passenden Tage im Zeitraum.</span> : (
            <>
              <p className="mb-1 font-medium">{tooMany ? `Mehr als ${MAX_COPIES} Daten. Bitte Zeitraum verkleinern.` : `${dates.length} ${dates.length === 1 ? "Datum" : "Daten"}:`}</p>
              <p className="text-ink-3">{dates.slice(0, MAX_COPIES).map(fmt).join(", ")}</p>
            </>
          )}
        </div>
        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Dialog>
  );
}
