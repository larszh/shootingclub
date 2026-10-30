"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Crosshair, IdCard, LogOut, Pencil, Search, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatCard, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { Dialog, confirmDialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/ui-feedback";
import {
  changeDutyAction, checkInGuestAction, checkInMemberAction, checkOutAction, closeDayAction, deleteVisitAction, issueWeaponAction, returnWeaponAction,
  saveDayNotesAction, updateVisitAction,
} from "@/modules/range/actions";
import { minorStatusFromBirthYear, type HalfDayFlags } from "@/modules/range/logic";
import { CHECK_HINT, DISCIPLINE_SUGGESTIONS, MINOR_GUEST_HINT, newClientId } from "@/modules/range/types";
import { callAction } from "./action-call";

export type BoardVisit = {
  id: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  isGuest: boolean;
  hostName: string | null;
  guestIdChecked: boolean;
  lane: string | null;
  discipline: string | null;
  note: string | null;
  inLabel: string;
  outLabel: string | null;
  weapon: { id: string; name: string; open: boolean } | null;
  rulesOk: boolean;
  minor: "minor" | "maybe" | null;
};

export type BoardMember = { userId: string; name: string; memberNumber: string | null; avatarUrl: string | null };
export type BoardWeapon = { id: string; name: string; caliber: string | null; discipline: string | null };

export type BoardDay = {
  id: string;
  title: string;
  dateLabel: string;
  isToday: boolean;
  dutyUserId: string | null;
  dutyName: string | null;
  notes: string | null;
};

export function DayBoard({
  day, visits, members, weapons, suggested, dutyWarning, rulesActive, year,
}: {
  day: BoardDay;
  visits: BoardVisit[];
  members: BoardMember[];
  /** null = Vereinswaffen nicht aktiv oder keine Berechtigung */
  weapons: BoardWeapon[] | null;
  suggested: HalfDayFlags;
  dutyWarning: string | null;
  rulesActive: boolean;
  year: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | { kind: "member" } | { kind: "guest" } | { kind: "close" } | { kind: "duty" } | { kind: "edit" | "weapon" | "checkout"; visit: BoardVisit }>(null);
  const present = visits.filter((v) => !v.outLabel);
  const gone = visits.filter((v) => v.outLabel);
  const guests = visits.filter((v) => v.isGuest).length;
  const listId = useId();

  // Selbst-Check-ins anderer Geräte regelmässig nachladen.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [router]);

  const close = () => setDialog(null);

  return (
    <div className="space-y-4">
      <datalist id={listId}>{DISCIPLINE_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist>

      <Card className="animate-rise p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-ink-3">{day.dateLabel}</div>
            <div className="truncate text-lg font-semibold">{day.title}</div>
            <div className="mt-0.5 text-sm text-ink-2">Standdienst: <span className="font-medium text-ink">{day.dutyName ?? "–"}</span></div>
          </div>
          <Button variant="secondary" size="sm" className="h-11 shrink-0" onClick={() => setDialog({ kind: "duty" })}>Übergeben</Button>
        </div>
        {!day.isToday ? <Alert tone="warn" className="mt-3">Dieses Standbuch ist nicht von heute. Es nimmt keine neuen Einträge mehr an. Bitte abschliessen und für heute ein neues Standbuch öffnen.</Alert> : null}
        {dutyWarning ? <Alert tone="warn" className="mt-3" icon={<ShieldAlert className="h-4 w-4" />}>{dutyWarning}</Alert> : null}
      </Card>

      <div className="stagger grid grid-cols-3 gap-2.5">
        <StatCard label="Anwesend" value={present.length} tone={present.length ? "accent" : "neutral"} />
        <StatCard label={day.isToday ? "Heute total" : "Total"} value={visits.length} />
        <StatCard label="Gäste" value={guests} />
      </div>

      {day.isToday ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Button size="lg" className="h-14" onClick={() => setDialog({ kind: "member" })}><Users className="h-5 w-5" /> Mitglied</Button>
          <Button size="lg" variant="secondary" className="h-14" onClick={() => setDialog({ kind: "guest" })}><UserPlus className="h-5 w-5" /> Gast</Button>
        </div>
      ) : (
        <Button size="lg" className="h-14 w-full" onClick={() => setDialog({ kind: "close" })}>Tag abschliessen</Button>
      )}

      <SectionTitle>Am Stand ({present.length})</SectionTitle>
      {present.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {present.map((v) => <VisitRow key={v.id} v={v} weaponsEnabled={weapons !== null && day.isToday} onEdit={() => setDialog({ kind: "edit", visit: v })} onWeapon={() => setDialog({ kind: "weapon", visit: v })} onCheckout={() => setDialog({ kind: "checkout", visit: v })} />)}
        </Card>
      ) : (
        <EmptyState icon={<Crosshair className="h-5 w-5" />} title="Noch niemand eingecheckt" text="Mitglieder checken sich per QR-Code selbst ein oder du erfasst sie hier." />
      )}

      {gone.length ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold uppercase tracking-wider text-ink-3">Ausgecheckt ({gone.length}) <span className="ml-1 transition-transform group-open:rotate-90" aria-hidden>›</span></summary>
          <Card className="mt-1 divide-y divide-line overflow-hidden">
            {gone.map((v) => <VisitRow key={v.id} v={v} weaponsEnabled={false} />)}
          </Card>
        </details>
      ) : null}

      <NotesCard dayId={day.id} notes={day.notes} />

      {day.isToday ? <Button variant="secondary" size="lg" className="h-14 w-full" onClick={() => setDialog({ kind: "close" })}>Tag abschliessen</Button> : null}

      {dialog?.kind === "member" ? <MemberDialog onClose={close} dayId={day.id} members={members} presentIds={new Set(present.map((v) => v.userId).filter((x): x is string => !!x))} listId={listId} rulesActive={rulesActive} /> : null}
      {dialog?.kind === "guest" ? <GuestDialog onClose={close} dayId={day.id} members={members} listId={listId} rulesActive={rulesActive} year={year} /> : null}
      {dialog?.kind === "close" ? <CloseDialog onClose={close} dayId={day.id} suggested={suggested} openCount={present.length} openWeapons={present.filter((v) => v.weapon?.open).length} notes={day.notes} /> : null}
      {dialog?.kind === "duty" ? <DutyDialog onClose={close} dayId={day.id} members={members} current={day.dutyUserId} /> : null}
      {dialog?.kind === "edit" ? <EditVisitDialog visit={dialog.visit} onClose={close} listId={listId} /> : null}
      {dialog?.kind === "weapon" ? <WeaponDialog visit={dialog.visit} weapons={weapons ?? []} onClose={close} /> : null}
      {dialog?.kind === "checkout" ? <CheckoutDialog visit={dialog.visit} onClose={close} /> : null}
    </div>
  );
}

function VisitRow({ v, weaponsEnabled, onEdit, onWeapon, onCheckout }: { v: BoardVisit; weaponsEnabled: boolean; onEdit?: () => void; onWeapon?: () => void; onCheckout?: () => void }) {
  const [pending, start] = useTransition();
  const quickCheckout = () =>
    start(async () => {
      await callAction(() => checkOutAction(v.id, null));
    });
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={v.name} src={v.avatarUrl} size={40} tone={v.isGuest ? "guest" : "soft"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{v.name}</span>
          </div>
          <div className="truncate text-xs text-ink-3">
            {v.inLabel}{v.outLabel ? `–${v.outLabel}` : ""}{v.discipline ? ` · ${v.discipline}` : ""}{v.hostName ? ` · Gast von ${v.hostName}` : ""}
          </div>
        </div>
        {onEdit ? (
          <button type="button" onClick={onEdit} className="press flex h-11 min-w-11 shrink-0 items-center justify-center rounded-control border border-line px-2 text-sm font-semibold tabular-nums" aria-label={`Bahn und Disziplin von ${v.name} bearbeiten`}>
            {v.lane ? `Bahn ${v.lane}` : <Pencil className="h-4 w-4 text-ink-3" />}
          </button>
        ) : v.lane ? <span className="shrink-0 text-sm text-ink-3">Bahn {v.lane}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[52px]">
        {v.isGuest ? <Badge tone="accent">Gast</Badge> : null}
        {v.isGuest && !v.guestIdChecked ? <Badge tone="warn">Ausweis nicht geprüft</Badge> : null}
        {v.minor === "minor" ? <Badge tone="danger">minderjährig</Badge> : v.minor === "maybe" ? <Badge tone="warn">evtl. minderjährig</Badge> : null}
        {v.weapon ? <Badge tone={v.weapon.open ? "warn" : "outline"}>Vereinswaffe: {v.weapon.name}{v.weapon.open ? "" : " (zurück)"}</Badge> : null}
        {!v.rulesOk ? <Badge tone="warn">Standordnung offen</Badge> : null}
        {v.note ? <span className="text-xs text-ink-3">«{v.note}»</span> : null}
      </div>
      {onCheckout ? (
        <div className="mt-2 flex flex-wrap gap-2 pl-[52px]">
          {weaponsEnabled && !v.weapon?.open ? (
            <Button variant="secondary" size="sm" className="h-11" onClick={onWeapon}><Crosshair className="h-4 w-4" /> Waffe</Button>
          ) : null}
          <Button variant="secondary" size="sm" className="h-11" disabled={pending} onClick={v.weapon?.open ? onCheckout : quickCheckout}>
            {pending ? <Spinner /> : <LogOut className="h-4 w-4" />} Auschecken
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MemberDialog({ onClose, dayId, members, presentIds, listId, rulesActive }: { onClose: () => void; dayId: string; members: BoardMember[]; presentIds: Set<string>; listId: string; rulesActive: boolean }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<BoardMember | null>(null);
  const [lane, setLane] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [pending, start] = useTransition();
  const cid = useRef<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter((m) => !presentIds.has(m.userId) && (!s || m.name.toLowerCase().includes(s) || (m.memberNumber ?? "").toLowerCase().includes(s))).slice(0, 40);
  }, [members, presentIds, q]);

  function submit() {
    if (!picked) return;
    cid.current ??= newClientId();
    const clientId = cid.current;
    start(async () => {
      const res = await callAction(() => checkInMemberAction({ dayId, userId: picked.userId, lane, discipline, clientId }), { silent: true });
      if (res.ok) {
        const d = res.data;
        if (d?.rulesMissing && rulesActive) toastWarn(`${picked.name} eingecheckt. Standordnung noch nicht bestätigt – bitte darauf hinweisen.`);
        else toastOk(`${picked.name} eingecheckt.`);
        onClose();
      } else if (!res.network) cid.current = null;
    });
  }

  return (
    <Dialog open onClose={onClose} title={picked ? picked.name : "Mitglied einchecken"} size="md"
      footer={picked ? (
        <>
          <Button variant="secondary" onClick={() => setPicked(null)}>Zurück</Button>
          <Button onClick={submit} disabled={pending}>{pending ? <Spinner /> : null} Einchecken</Button>
        </>
      ) : undefined}>
      {picked ? (
        <div className="space-y-3 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bahn (optional)"><Input value={lane} onChange={(e) => setLane(e.target.value)} maxLength={40} inputMode="numeric" placeholder="z.B. 3" /></Field>
            <Field label="Disziplin (optional)"><Input value={discipline} onChange={(e) => setDiscipline(e.target.value)} maxLength={80} list={listId} /></Field>
          </div>
        </div>
      ) : (
        <div className="pb-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input data-autofocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name oder Mitgliedernummer" aria-label="Mitglied suchen" className="pl-10" />
          </div>
          {list.length ? (
            <ul className="divide-y divide-line">
              {list.map((m) => (
                <li key={m.userId}>
                  <button type="button" onClick={() => setPicked(m)} className="press flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left hover:bg-surface-2">
                    <Avatar name={m.name} src={m.avatarUrl} size={36} tone="soft" />
                    <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                    {m.memberNumber ? <span className="shrink-0 text-xs text-ink-3">{m.memberNumber}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-ink-3">Keine Treffer.</p>}
        </div>
      )}
    </Dialog>
  );
}

function GuestDialog({ onClose, dayId, members, listId, rulesActive, year }: { onClose: () => void; dayId: string; members: BoardMember[]; listId: string; rulesActive: boolean; year: number }) {
  const [birthYear, setBirthYear] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const [rulesExplained, setRulesExplained] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cid = useRef<string | null>(null);
  const by = Number(birthYear);
  const minor = birthYear.length === 4 && Number.isInteger(by) ? minorStatusFromBirthYear(by, year) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    cid.current ??= newClientId();
    const clientId = cid.current;
    setError(null);
    start(async () => {
      const res = await callAction(() => checkInGuestAction({
        dayId, clientId, guestName: String(fd.get("guestName") ?? ""), guestBirthYear: birthYear || null, guestPhone: String(fd.get("guestPhone") ?? ""),
        guestEmail: String(fd.get("guestEmail") ?? ""), hostUserId: String(fd.get("hostUserId") ?? "") || null, guestIdChecked: idChecked, rulesExplained,
        lane: String(fd.get("lane") ?? ""), discipline: String(fd.get("discipline") ?? ""), note: String(fd.get("note") ?? ""),
      }));
      if (res.ok) {
        onClose();
      } else {
        setError(res.error);
        if (!res.network) cid.current = null;
      }
    });
  }

  return (
    <Dialog open onClose={onClose} title="Gast einchecken" size="lg">
      <form onSubmit={onSubmit} className="space-y-3 pb-3">
        <Field label="Name"><Input name="guestName" required maxLength={191} autoComplete="off" data-autofocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jahrgang"><Input value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="z.B. 1990" /></Field>
          <Field label="Betreut durch">
            <Select name="hostUserId" defaultValue="">
              <option value="">– Mitglied wählen –</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </Select>
          </Field>
        </div>
        {minor === "minor" || minor === "maybe" ? (
          <Alert tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>{minor === "maybe" ? "Wird dieses Jahr 18 – Geburtsdatum prüfen. " : ""}{MINOR_GUEST_HINT}</Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon (optional)"><Input name="guestPhone" type="tel" maxLength={40} /></Field>
          <Field label="E-Mail (optional)"><Input name="guestEmail" type="email" maxLength={191} /></Field>
          <Field label="Bahn (optional)"><Input name="lane" maxLength={40} inputMode="numeric" /></Field>
          <Field label="Disziplin (optional)"><Input name="discipline" maxLength={80} list={listId} /></Field>
        </div>
        <Field label="Bemerkung (optional)"><Input name="note" maxLength={191} /></Field>
        <Card className="space-y-3 p-3">
          <Switch checked={idChecked} onChange={setIdChecked} label={<span className="inline-flex items-center gap-1.5"><IdCard className="h-4 w-4" /> Ausweis geprüft</span>} description="Amtlichen Ausweis angeschaut. Es wird keine Ausweisnummer gespeichert." />
          {rulesActive ? <Switch checked={rulesExplained} onChange={setRulesExplained} label="Standordnung erklärt" description="Der Gast kennt die Standordnung und hält sich daran." /> : null}
        </Card>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="h-12 w-full" disabled={pending}>{pending ? <Spinner /> : null} Gast einchecken</Button>
        <p className="text-xs text-ink-3">Gastschützen nur gemäss den geltenden Vorgaben. {CHECK_HINT}</p>
      </form>
    </Dialog>
  );
}

function EditVisitDialog({ visit, onClose, listId }: { visit: BoardVisit; onClose: () => void; listId: string }) {
  const [lane, setLane] = useState(visit.lane ?? "");
  const [discipline, setDiscipline] = useState(visit.discipline ?? "");
  const [note, setNote] = useState(visit.note ?? "");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const res = await callAction(() => updateVisitAction(visit.id, { lane, discipline, note }));
    if (res.ok) onClose();
  });
  const remove = async () => {
    if (!(await confirmDialog({ title: `${visit.name} aus dem Standbuch entfernen?`, message: "Nur für Fehlerfassungen. Wer geschossen hat, wird ausgecheckt, nicht entfernt.", tone: "danger", confirmLabel: "Entfernen" }))) return;
    start(async () => {
      const res = await callAction(() => deleteVisitAction(visit.id));
      if (res.ok) onClose();
    });
  };
  return (
    <Dialog open onClose={onClose} title={visit.name}
      footer={<>
        <Button variant="ghost" onClick={remove} disabled={pending} className="text-danger sm:mr-auto"><Trash2 className="h-4 w-4" /> Entfernen</Button>
        <Button onClick={save} disabled={pending}>{pending ? <Spinner /> : null} Speichern</Button>
      </>}>
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bahn"><Input value={lane} onChange={(e) => setLane(e.target.value)} maxLength={40} inputMode="numeric" data-autofocus /></Field>
          <Field label="Disziplin"><Input value={discipline} onChange={(e) => setDiscipline(e.target.value)} maxLength={80} list={listId} /></Field>
        </div>
        <Field label="Bemerkung"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} /></Field>
      </div>
    </Dialog>
  );
}

function WeaponDialog({ visit, weapons, onClose }: { visit: BoardVisit; weapons: BoardWeapon[]; onClose: () => void }) {
  const [weaponId, setWeaponId] = useState(weapons[0]?.id ?? "");
  const [pending, start] = useTransition();
  const issue = () => start(async () => {
    const res = await callAction(() => issueWeaponAction(visit.id, weaponId));
    if (res.ok) onClose();
  });
  return (
    <Dialog open onClose={onClose} title="Vereinswaffe ausgeben" description={visit.name}
      footer={weapons.length ? <Button onClick={issue} disabled={pending || !weaponId}>{pending ? <Spinner /> : null} Ausgeben</Button> : undefined}>
      <div className="space-y-3 pb-2">
        {weapons.length ? (
          <Field label="Waffe">
            <Select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
              {weapons.map((w) => <option key={w.id} value={w.id}>{w.name}{w.caliber ? ` (${w.caliber})` : ""}{w.discipline ? ` · ${w.discipline}` : ""}</option>)}
            </Select>
          </Field>
        ) : <p className="text-sm text-ink-3">Zurzeit ist keine Vereinswaffe verfügbar.</p>}
        {visit.minor ? <Alert tone="warn">{MINOR_GUEST_HINT} Für die Leihe an Minderjährige gelten besondere Melde- und Aufsichtspflichten. {CHECK_HINT}</Alert> : null}
        <p className="text-xs text-ink-3">Nur zum Gebrauch am Stand unter Aufsicht. Rückgabe beim Auschecken mit Schusszahl.</p>
      </div>
    </Dialog>
  );
}

function CheckoutDialog({ visit, onClose }: { visit: BoardVisit; onClose: () => void }) {
  const [shots, setShots] = useState("");
  const [pending, start] = useTransition();
  const n = shots.trim() === "" ? null : Number(shots);
  const valid = n === null || (Number.isInteger(n) && n >= 0 && n <= 100000);
  const run = (withCheckout: boolean) => start(async () => {
    const res = await callAction(() => (withCheckout ? checkOutAction(visit.id, n) : returnWeaponAction(visit.id, n)));
    if (res.ok) onClose();
  });
  return (
    <Dialog open onClose={onClose} title="Vereinswaffe zurücknehmen" description={`${visit.name} · ${visit.weapon?.name ?? ""}`}
      footer={<>
        <Button variant="secondary" onClick={() => run(false)} disabled={pending || !valid}>Nur Waffe zurück</Button>
        <Button onClick={() => run(true)} disabled={pending || !valid}>{pending ? <Spinner /> : null} Zurück und auschecken</Button>
      </>}>
      <div className="space-y-3 pb-2">
        <Field label="Geschossene Schuss" hint="Für den Schusszähler und die Wartung. Leer lassen, wenn unbekannt." error={valid ? undefined : "Ungültige Zahl."}>
          <Input value={shots} onChange={(e) => setShots(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="z.B. 60" data-autofocus />
        </Field>
        <p className="text-xs text-ink-3">Waffe auf Entladung und Zustand prüfen, bevor sie versorgt wird.</p>
      </div>
    </Dialog>
  );
}

function CloseDialog({ onClose, dayId, suggested, openCount, openWeapons, notes }: { onClose: () => void; dayId: string; suggested: HalfDayFlags; openCount: number; openWeapons: number; notes: string | null }) {
  const [flags, setFlags] = useState<HalfDayFlags>(suggested);
  const [text, setText] = useState(notes ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () => start(async () => {
    const res = await callAction(() => closeDayAction(dayId, { ...flags, notes: text }));
    if (res.ok) {
      onClose();
      router.push("/range");
    }
  });
  return (
    <Dialog open onClose={onClose} title="Tag abschliessen" size="md"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={submit} disabled={pending || openWeapons > 0}>{pending ? <Spinner /> : null} Abschliessen</Button>
      </>}>
      <div className="space-y-3 pb-2">
        {openWeapons > 0 ? <Alert>Es sind noch {openWeapons} Vereinswaffen ausgegeben. Bitte zuerst zurücknehmen.</Alert> : null}
        {openCount > 0 ? <Alert tone="warn">{openCount} {openCount === 1 ? "Person ist" : "Personen sind"} noch eingecheckt und {openCount === 1 ? "wird" : "werden"} jetzt ausgecheckt.</Alert> : null}
        <Card className="space-y-3 p-3">
          <p className="text-sm text-ink-2">Benutzte Schiesshalbtage (aus den Besuchszeiten vorgeschlagen):</p>
          <Switch checked={flags.usedAm} onChange={(v) => setFlags((f) => ({ ...f, usedAm: v }))} label="Vormittag" description="vor 12:00" />
          <Switch checked={flags.usedPm} onChange={(v) => setFlags((f) => ({ ...f, usedPm: v }))} label="Nachmittag" description="12:00–18:00" />
          <Switch checked={flags.usedEvening} onChange={(v) => setFlags((f) => ({ ...f, usedEvening: v }))} label="Abend" description="ab 18:00" />
        </Card>
        <Field label="Notizen zum Tag (optional)" hint="z.B. besondere Vorkommnisse, Wetter, Störungen.">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} rows={3} />
        </Field>
      </div>
    </Dialog>
  );
}

function DutyDialog({ onClose, dayId, members, current }: { onClose: () => void; dayId: string; members: BoardMember[]; current: string | null }) {
  const [userId, setUserId] = useState(current ?? "");
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    const res = await callAction(() => changeDutyAction(dayId, userId));
    if (res.ok) {
      if (res.data?.warning) setWarning(res.data.warning);
      else onClose();
    }
  });
  return (
    <Dialog open onClose={onClose} title="Standdienst übergeben"
      footer={warning ? <Button onClick={onClose}>Verstanden</Button> : <Button onClick={submit} disabled={pending || !userId || userId === current}>{pending ? <Spinner /> : null} Übergeben</Button>}>
      <div className="space-y-3 pb-2">
        <Field label="Neu im Standdienst">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">– wählen –</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </Select>
        </Field>
        {warning ? <Alert tone="warn">{warning}</Alert> : null}
      </div>
    </Dialog>
  );
}

function NotesCard({ dayId, notes }: { dayId: string; notes: string | null }) {
  const [text, setText] = useState(notes ?? "");
  const [pending, start] = useTransition();
  const dirty = text !== (notes ?? "");
  return (
    <Card className="p-4">
      <Field label="Notizen zum Tag">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} rows={2} placeholder="z.B. Scheibe 4 defekt, Gruppe Jungschützen ab 14 Uhr" />
      </Field>
      <div className={cn("mt-2 flex justify-end", !dirty && "hidden")}>
        <Button size="sm" className="h-11" disabled={pending} onClick={() => start(async () => { await callAction(() => saveDayNotesAction(dayId, text)); })}>{pending ? <Spinner /> : null} Notizen speichern</Button>
      </div>
    </Card>
  );
}

function toastOk(msg: string) {
  toast.success(msg);
}
function toastWarn(msg: string) {
  toast.info(msg, { duration: 7000 });
}
