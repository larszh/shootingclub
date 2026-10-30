"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HandHelping, Printer, Search, UserRound } from "lucide-react";
import { Alert, Button, Field, Input, LinkButton, Select } from "@/components/ui";
import { Switch, Segmented } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { lendWeaponAction } from "@/modules/weapons/actions";
import { MINOR_HINT, RESPONSIBILITY_HINT } from "@/modules/weapons/types";

export type LendMember = { userId: string; name: string; memberNumber: string | null; minor: boolean | null };

/** Knopf «Ausleihen» mit Dialog: Mitglied (ohne Ausgetretene) oder freier Name, minderjährig, nur am Stand, Rückgabe bis. */
export function LendButton({ weapons, members, defaultReportDays, size = "md", className, label = "Ausleihen" }: {
  /** Eine Waffe (Detailseite) oder Auswahl verfügbarer Waffen (Übersicht) */
  weapons: { id: string; name: string }[];
  members: LendMember[];
  defaultReportDays: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)}><HandHelping className="h-4 w-4" /> {label}</Button>
      {open ? <LendDialog weapons={weapons} members={members} defaultReportDays={defaultReportDays} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LendDialog({ weapons, members, defaultReportDays, onClose }: { weapons: { id: string; name: string }[]; members: LendMember[]; defaultReportDays: number; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"member" | "name">(members.length ? "member" : "name");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<LendMember | null>(null);
  const [name, setName] = useState("");
  const [minorManual, setMinorManual] = useState(false);
  const [onSiteOnly, setOnSiteOnly] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [reportDays, setReportDays] = useState(String(defaultReportDays));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const [weaponId, setWeaponId] = useState(weapons[0]?.id ?? "");
  const weapon = weapons.find((w) => w.id === weaponId) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? members.filter((m) => m.name.toLowerCase().includes(q) || (m.memberNumber ?? "").toLowerCase().includes(q)) : members;
    return list.slice(0, 30);
  }, [members, query]);

  // Bei Mitgliedern mit Geburtsdatum ergibt sich «minderjährig» automatisch; sonst von Hand.
  const autoMinor = mode === "member" && picked ? picked.minor : null;
  const isMinor = autoMinor ?? minorManual;

  function submit() {
    setError(null);
    if (!weapon) return setError("Bitte eine Waffe wählen.");
    if (mode === "member" && !picked) return setError("Bitte ein Mitglied wählen.");
    if (mode === "name" && !name.trim()) return setError("Bitte einen Namen eingeben.");
    start(async () => {
      try {
        const r = await lendWeaponAction({
          weaponId: weapon.id, userId: mode === "member" ? picked!.userId : null, borrowerName: mode === "name" ? name : "",
          isMinor, onSiteOnly, dueDate, reportDays: isMinor ? reportDays : "", note,
        });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? "Ausgeliehen.");
        if (r.data?.id) setDone({ id: r.data.id, name: weapon.name });
        else onClose();
        router.refresh();
      } catch {
        setError("Keine Verbindung. Bitte nochmals versuchen.");
      }
    });
  }

  if (done) {
    return (
      <Dialog open onClose={onClose} title="Ausgeliehen" description={done.name} icon={<Check className="h-5 w-5" />}
        footer={<>
          <LinkButton variant="secondary" href={`/weapons/loans/${done.id}/receipt`} target="_blank"><Printer className="h-4 w-4" /> Quittung drucken</LinkButton>
          <Button onClick={onClose}>Fertig</Button>
        </>}>
        <p className="pb-2 text-sm text-ink-2">Die Ausleihe ist erfasst. Die Quittung kann vor Ort unterschrieben werden.</p>
        {isMinor ? <Alert tone="warn" className="mb-2">{MINOR_HINT}</Alert> : null}
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title="Vereinswaffe ausleihen" description={weapons.length === 1 ? weapon?.name : undefined} size="lg"
      footer={<Button onClick={submit} disabled={pending || !weapon}>{pending ? <Spinner /> : <HandHelping className="h-4 w-4" />} Ausleihen</Button>}>
      <div className="space-y-4 pb-2">
        {weapons.length === 0 ? <Alert tone="info">Zurzeit ist keine Vereinswaffe verfügbar.</Alert> : null}
        {weapons.length > 1 ? (
          <Field label="Waffe">
            <Select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
              {weapons.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <Segmented<"member" | "name">
          value={mode}
          onChange={(v) => { setMode(v); setError(null); }}
          label="Ausleihe an"
          options={[{ value: "member", label: "Mitglied" }, { value: "name", label: "Andere Person" }]}
        />
        {mode === "member" ? (
          picked ? (
            <div className="flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface-2 px-3">
              <UserRound className="h-5 w-5 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{picked.name}</div>
                <div className="text-xs text-ink-3">{picked.memberNumber ? `Nr. ${picked.memberNumber} · ` : ""}{picked.minor === true ? "minderjährig" : picked.minor === false ? "volljährig" : "Geburtsdatum unbekannt"}</div>
              </div>
              <Button variant="ghost" size="sm" className="h-11" onClick={() => setPicked(null)}>Ändern</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name oder Mitgliedernummer" aria-label="Mitglied suchen" className="pl-9" data-autofocus />
              </div>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-control border border-line">
                {matches.length === 0 ? <li className="px-3 py-3 text-sm text-ink-3">Kein Mitglied gefunden.</li> : null}
                {matches.map((m) => (
                  <li key={m.userId}>
                    <button type="button" onClick={() => setPicked(m)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left hover:bg-surface-2">
                      <span className="truncate">{m.name}</span>
                      <span className="shrink-0 text-xs text-ink-3">{m.minor ? "minderjährig" : m.memberNumber ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={191} autoComplete="off" placeholder="Vorname Nachname" /></Field>
        )}

        <Switch
          label="Minderjährig"
          description={autoMinor !== null ? "Aus dem Geburtsdatum des Mitglieds." : "Unter 18 Jahre alt?"}
          checked={isMinor}
          disabled={autoMinor !== null}
          onChange={setMinorManual}
        />
        {isMinor ? (
          <div className="space-y-2">
            <Alert tone="warn">{MINOR_HINT}</Alert>
            <Field label="Meldefrist in Tagen" hint="Vorschlag des Vereins (zuletzt verwendet). Frist beim Kanton erfragen.">
              <Input value={reportDays} onChange={(e) => setReportDays(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className="w-28" />
            </Field>
          </div>
        ) : null}
        <Switch label="Nur am Stand unter Aufsicht" description="Kein Mitnehmen nach Hause." checked={onSiteOnly} onChange={setOnSiteOnly} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rückgabe bis (optional)"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Bemerkung (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} placeholder="z.B. Jungschützenkurs" /></Field>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <p className="text-xs text-ink-3">{RESPONSIBILITY_HINT}</p>
      </div>
    </Dialog>
  );
}
