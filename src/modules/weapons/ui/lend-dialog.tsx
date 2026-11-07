"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HandHelping, Printer, Search, UserRound } from "lucide-react";
import { Alert, Button, Field, Input, LinkButton, Select } from "@/components/ui";
import { Switch, Segmented } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/form";
import { todayZurich } from "@/lib/time";
import { toast } from "@/lib/ui-feedback";
import { lendWeaponAction } from "@/modules/weapons/actions";
import { useT } from "@/components/locale";

export type LendMember = { userId: string; name: string; memberNumber: string | null; minor: boolean | null };

/**
 * Knopf «Ausleihen» mit Dialog: Mitglied (ohne Ausgetretene) oder freier Name, minderjährig, nur am Stand, Rückgabe bis.
 * `hideTrigger`: Knopf ausblenden (z.B. Waffe nicht mehr verfügbar), ein offener Dialog bleibt aber stehen. So überlebt
 * der Erfolgsschritt («Quittung drucken») das Neuladen der Seite, wenn die Seite danach die offene Ausleihe zeigt.
 */
export function LendButton({ weapons, members, defaultReportDays, size = "md", className, label, hideTrigger = false }: {
  /** Eine Waffe (Detailseite) oder Auswahl verfügbarer Waffen (Übersicht) */
  weapons: { id: string; name: string }[];
  members: LendMember[];
  defaultReportDays: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  hideTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  if (hideTrigger && !open) return null;
  return (
    <>
      {hideTrigger ? null : <Button size={size} className={className} onClick={() => setOpen(true)}><HandHelping className="h-4 w-4" /> {label ?? t("adm2.weapons.lend.lend")}</Button>}
      {open ? <LendDialog weapons={weapons} members={members} defaultReportDays={defaultReportDays} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LendDialog({ weapons, members, defaultReportDays, onClose }: { weapons: { id: string; name: string }[]; members: LendMember[]; defaultReportDays: number; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
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
  const [today] = useState(todayZurich);
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
    if (!weapon) return setError(t("adm2.weapons.lend.chooseWeapon"));
    if (mode === "member" && !picked) return setError(t("adm2.weapons.lend.chooseMember"));
    if (mode === "name" && !name.trim()) return setError(t("adm2.weapons.lend.enterName"));
    if (dueDate && dueDate < today) return setError(t("adm2.weapons.msg.duePast"));
    start(async () => {
      try {
        const r = await lendWeaponAction({
          weaponId: weapon.id, userId: mode === "member" ? picked!.userId : null, borrowerName: mode === "name" ? name : "",
          isMinor, onSiteOnly, dueDate, reportDays: isMinor ? reportDays : "", note,
        });
        if (!r.ok) return setError(r.error);
        toast.success(r.message ?? t("adm2.weapons.msg.lent"));
        if (r.data?.id) setDone({ id: r.data.id, name: weapon.name });
        else onClose();
        router.refresh();
      } catch {
        setError(t("adm2.common.network"));
      }
    });
  }

  if (done) {
    return (
      <Dialog open onClose={onClose} title={t("adm2.weapons.lend.doneTitle")} description={done.name} icon={<Check className="h-5 w-5" />}
        footer={<>
          <LinkButton variant="secondary" href={`/weapons/loans/${done.id}/receipt`} target="_blank"><Printer className="h-4 w-4" /> {t("adm2.weapons.lend.printReceipt")}</LinkButton>
          <Button onClick={onClose}>{t("adm2.weapons.lend.finish")}</Button>
        </>}>
        <p className="pb-2 text-sm text-ink-2">{t("adm2.weapons.lend.doneText")}</p>
        {isMinor ? <Alert tone="warn" className="mb-2">{t("adm2.weapons.minorHint")}</Alert> : null}
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title={t("adm2.weapons.lend.title")} description={weapons.length === 1 ? weapon?.name : undefined} size="lg"
      footer={<Button onClick={submit} disabled={pending || !weapon}>{pending ? <Spinner /> : <HandHelping className="h-4 w-4" />} {t("adm2.weapons.lend.lend")}</Button>}>
      <div className="space-y-4 pb-2">
        {weapons.length === 0 ? <Alert tone="info">{t("adm2.weapons.lend.noneAvailable")}</Alert> : null}
        {weapons.length > 1 ? (
          <Field label={t("adm2.common.weapon")}>
            <Select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
              {weapons.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <Segmented<"member" | "name">
          value={mode}
          onChange={(v) => { setMode(v); setError(null); }}
          label={t("adm2.weapons.lend.to")}
          options={[{ value: "member", label: t("adm2.weapons.lend.member") }, { value: "name", label: t("adm2.weapons.lend.other") }]}
        />
        {mode === "member" ? (
          picked ? (
            <div className="flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface-2 px-3">
              <UserRound className="h-5 w-5 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{picked.name}</div>
                <div className="text-xs text-ink-3">{picked.memberNumber ? t("adm2.weapons.lend.nr", { n: picked.memberNumber }) : ""}{picked.minor === true ? t("adm2.weapons.lend.minor") : picked.minor === false ? t("adm2.weapons.lend.adult") : t("adm2.weapons.lend.birthUnknown")}</div>
              </div>
              <Button variant="ghost" size="sm" className="h-11" onClick={() => setPicked(null)}>{t("adm2.weapons.lend.change")}</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("adm2.weapons.lend.searchPh")} aria-label={t("adm2.weapons.lend.search")} className="pl-9" data-autofocus />
              </div>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-control border border-line">
                {matches.length === 0 ? <li className="px-3 py-3 text-sm text-ink-3">{t("adm2.weapons.lend.noMember")}</li> : null}
                {matches.map((m) => (
                  <li key={m.userId}>
                    <button type="button" onClick={() => setPicked(m)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left hover:bg-surface-2">
                      <span className="truncate">{m.name}</span>
                      <span className="shrink-0 text-xs text-ink-3">{m.minor ? t("adm2.weapons.lend.minor") : m.memberNumber ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <Field label={t("adm2.common.name")}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={191} autoComplete="off" placeholder={t("adm2.weapons.lend.namePh")} /></Field>
        )}

        <Switch
          label={t("adm2.weapons.lend.minorLabel")}
          description={autoMinor !== null ? t("adm2.weapons.lend.minorAuto") : t("adm2.weapons.lend.minorManual")}
          checked={isMinor}
          disabled={autoMinor !== null}
          onChange={setMinorManual}
        />
        {isMinor ? (
          <div className="space-y-2">
            <Alert tone="warn">{t("adm2.weapons.minorHint")}</Alert>
            <Field label={t("adm2.weapons.lend.reportDays")} hint={t("adm2.weapons.lend.reportDaysHint")}>
              <Input value={reportDays} onChange={(e) => setReportDays(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className="w-28" />
            </Field>
          </div>
        ) : null}
        <Switch label={t("adm2.weapons.lend.onSite")} description={t("adm2.weapons.lend.onSiteHint")} checked={onSiteOnly} onChange={setOnSiteOnly} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("adm2.weapons.lend.due")}><Input type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label={t("adm2.weapons.lend.note")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={191} placeholder={t("adm2.weapons.lend.notePh")} /></Field>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <p className="text-xs text-ink-3">{t("adm2.weapons.responsibility")}</p>
      </div>
    </Dialog>
  );
}
