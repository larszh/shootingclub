"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
import { confirmCamtImportAction, previewCamtImportAction, type ImportPreview } from "@/modules/billing/import-actions";
import { IMPORT_STATUS_LABEL, type ImportPreviewItem, type ImportStatus } from "@/modules/billing/import-types";
import { Alert, Badge, Button, Card, SectionTitle } from "@/components/ui";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { formatQrReference } from "@/lib/qr-reference";
import { cn } from "@/lib/utils";

const SELECTABLE: ImportStatus[] = ["matched", "amount_mismatch"];
const ORDER: ImportStatus[] = ["matched", "amount_mismatch", "ambiguous", "unmatched", "already_paid", "duplicate"];

function swissDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export function CamtImport() {
  const [state, action, pending] = useActionState(previewCamtImportAction, null);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Card className="animate-rise p-4">
        <form onSubmit={submitKeepingValues(action)} className="space-y-3">
          <label className={cn("press flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent", fileName ? "border-ink/40 bg-surface-2" : "border-line hover:border-ink/30")}>
            <FileUp className="h-7 w-7 text-ink-2" />
            <span className="font-medium">{fileName ?? "camt-Datei wählen"}</span>
            <span className="text-xs text-ink-3">XML aus dem E-Banking, max. 5 MB (camt.054 oder camt.053)</span>
            <input type="file" name="file" accept=".xml,application/xml,text/xml" className="sr-only" required onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
          </label>
          {state && !state.ok ? <Alert>{state.error}</Alert> : null}
          <SubmitButton className="w-full" disabled={!fileName} pending={pending} pendingText="Datei wird geprüft…"><Upload className="h-4 w-4" /> Datei prüfen</SubmitButton>
          <p className="text-xs text-ink-3">Es wird noch nichts verbucht. Du siehst zuerst eine Vorschau und bestätigst die Zuordnungen.</p>
        </form>
      </Card>
      {state?.ok && state.data ? <PreviewList key={state.data.token} preview={state.data} /> : null}
    </div>
  );
}

function PreviewList({ preview }: { preview: ImportPreview }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preview.items.filter((i) => i.status === "matched").map((i) => i.key)));
  const [filter, setFilter] = useState<ImportStatus | "all">("all");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set());

  const counts = useMemo(() => {
    const c = Object.fromEntries(ORDER.map((s) => [s, 0])) as Record<ImportStatus, number>;
    for (const i of preview.items) c[i.status]++;
    return c;
  }, [preview.items]);
  const visible = (filter === "all" ? preview.items : preview.items.filter((i) => i.status === filter))
    .slice()
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const chosen = preview.items.filter((i) => selected.has(i.key) && !done.has(i.key) && i.target && SELECTABLE.includes(i.status));
  const chosenTotal = chosen.reduce((a, i) => a + i.amountCents, 0);
  const currency = preview.items[0]?.currency ?? "CHF";

  const toggle = (key: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });

  const confirm = () => start(async () => {
    const r = await confirmCamtImportAction({
      fileName: preview.fileName,
      items: chosen.map((i) => ({ kind: i.target!.kind, id: i.target!.id, bookingDate: i.bookingDate, amountCents: i.amountCents, currency: i.currency, reference: i.reference, debtorName: i.debtorName })),
    });
    setResult(r.ok ? { ok: true, text: r.message ?? "Verbucht." } : { ok: false, text: r.error });
    if (r.ok) {
      const booked = chosen.map((i) => i.key);
      setDone((d) => new Set([...d, ...booked]));
      setSelected(new Set());
      router.refresh();
    }
  });

  return (
    <div className="animate-rise">
      <SectionTitle>Vorschau · {preview.fileName}</SectionTitle>
      <Card className="p-4 mb-3 text-sm space-y-1">
        <div><span className="font-medium">{preview.items.length}</span> Gutschriften gefunden <span className="text-ink-3">({preview.kind}{preview.iban ? ` · Konto ${preview.iban}` : ""})</span></div>
        {preview.skippedDebits || preview.skippedOther ? <div className="text-xs text-ink-3">Ignoriert: {preview.skippedDebits} Belastungen{preview.skippedOther ? `, ${preview.skippedOther} sonstige (Storno, vorgemerkt, ohne Betrag)` : ""}</div> : null}
      </Card>

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Alle ({preview.items.length})</FilterChip>
        {ORDER.filter((s) => counts[s] > 0).map((s) => <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>{IMPORT_STATUS_LABEL[s].label} ({counts[s]})</FilterChip>)}
      </div>

      {visible.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {visible.map((i) => <ItemRow key={i.key} item={i} done={done.has(i.key)} checked={selected.has(i.key)} onToggle={() => toggle(i.key)} />)}
        </Card>
      ) : <p className="text-sm text-ink-3">Keine Einträge in dieser Auswahl.</p>}

      {result ? <div className="mt-3"><Alert tone={result.ok ? "ok" : "error"}>{result.text}</Alert></div> : null}

      <div className="sticky bottom-24 md:bottom-4 mt-4">
        <Button type="button" size="lg" className="w-full shadow-lg" disabled={pending || chosen.length === 0} onClick={confirm}>
          {pending ? <><Spinner /> Wird verbucht…</> : <><CheckCircle2 className="h-5 w-5" /> {chosen.length} {chosen.length === 1 ? "Zahlung" : "Zahlungen"} verbuchen · {formatMoney(chosenTotal, currency)}</>}
        </Button>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("press shrink-0 h-9 rounded-full px-3.5 text-sm font-medium border", active ? "bg-ink text-bg border-ink" : "bg-surface border-line text-ink-2")}>{children}</button>;
}

function ItemRow({ item, checked, done, onToggle }: { item: ImportPreviewItem; checked: boolean; done: boolean; onToggle: () => void }) {
  const st = done ? { label: "Verbucht", tone: "ok" as const } : IMPORT_STATUS_LABEL[item.status];
  const selectable = !done && !!item.target && SELECTABLE.includes(item.status);
  return (
    <label className={cn("flex items-start gap-3 px-4 py-3", selectable ? "cursor-pointer hover:bg-surface-2" : "opacity-80")}>
      <input type="checkbox" checked={done || (selectable && checked)} disabled={!selectable} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0 accent-[var(--ink)]" aria-label="Zuordnung übernehmen" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{item.debtorName ?? "Unbekannte Zahlerin / unbekannter Zahler"}</div>
            <div className="text-xs text-ink-3">{swissDate(item.bookingDate)}{item.reference ? <> · Ref. <span className="font-mono">{formatQrReference(item.reference)}</span></> : null}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold tabular-nums">{formatMoney(item.amountCents, item.currency)}</div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
        </div>
        {item.message ? <div className="mt-1 text-xs text-ink-3 line-clamp-2">«{item.message}»</div> : null}
        {item.target ? (
          <div className="mt-1.5 text-sm">
            <span className="text-ink-3">→ </span>
            <span className="font-medium">{item.target.number}</span> · {item.target.name} <span className="text-ink-3">· {item.target.label} · {formatMoney(item.target.amountCents, item.target.currency)}</span>
            {item.matchedBy ? <span className="ml-1 text-xs text-ink-3">({item.matchedBy === "reference" ? "über Referenz" : "über Rechnungsnummer"})</span> : null}
          </div>
        ) : item.candidates.length ? (
          <div className="mt-1.5 text-xs text-ink-3">Möglich: {item.candidates.map((c) => `${c.number} (${c.name})`).join(", ")}</div>
        ) : null}
        {item.reason ? <div className="mt-1 text-xs text-warn">{item.reason}</div> : null}
        {item.status === "amount_mismatch" && item.target ? <div className="mt-1 text-xs text-warn">Erwartet {formatMoney(item.target.amountCents, item.target.currency)}. Nur übernehmen, wenn die Rechnung damit erledigt ist.</div> : null}
      </div>
    </label>
  );
}
