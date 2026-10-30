"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldAlert } from "lucide-react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { Segmented } from "@/components/ui/controls";
import { SubmitButton, submitKeepingValues } from "@/components/ui/form";
import { saveParticipantAction } from "@/modules/courses/actions";
import { ageOn } from "@/modules/courses/logic";
import { PARTICIPANT_STATUS, PARTICIPANT_STATUSES } from "@/modules/courses/types";

export type ParticipantValues = {
  id?: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  clubWeaponId: string | null;
  status: string;
  note: string | null;
};

type MemberOpt = {
  userId: string; name: string; email: string; phone: string | null; birthDate: string | null; street: string | null; zip: string | null; city: string | null;
  guardianName: string | null; guardianEmail: string | null; guardianPhone: string | null;
};
type WeaponOpt = { id: string; name: string; caliber: string | null; discipline: string | null };

const EMPTY: ParticipantValues = {
  userId: null, firstName: "", lastName: "", birthDate: null, email: null, phone: null, street: null, zip: null, city: null,
  guardianName: null, guardianEmail: null, guardianPhone: null, clubWeaponId: null, status: "REGISTERED", note: null,
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]! };
}

/**
 * Teilnehmer:in hinzufügen (aus Mitgliedern oder extern) bzw. bearbeiten.
 * `refDay` = Stichtag für die Altersprüfung (Kursbeginn oder heute), vom Server berechnet.
 */
export function ParticipantForm({
  courseId, initial, members, weapons, currentWeapon, refDay, weaponsEnabled, takenUserIds,
}: {
  courseId: string; initial?: ParticipantValues; members: MemberOpt[]; weapons: WeaponOpt[]; currentWeapon: { id: string; name: string } | null; refDay: string; weaponsEnabled: boolean; takenUserIds: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveParticipantAction, null);
  const err = state && !state.ok ? state.fieldErrors : undefined;
  const [v, setV] = useState<ParticipantValues>(initial ?? EMPTY);
  const [mode, setMode] = useState<"member" | "external">(initial ? (initial.userId ? "member" : "external") : members.length ? "member" : "external");
  const set = (k: keyof ParticipantValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value || null }));
  const val = (k: keyof ParticipantValues) => (v[k] as string | null) ?? "";

  useEffect(() => {
    if (state?.ok && state.data?.id) router.push(`/courses/${courseId}`);
  }, [state, router, courseId]);

  function pickMember(userId: string) {
    const m = members.find((x) => x.userId === userId);
    if (!m) {
      setV((s) => ({ ...s, userId: null }));
      return;
    }
    const n = splitName(m.name);
    setV((s) => ({
      ...s, userId: m.userId, firstName: n.firstName, lastName: n.lastName || n.firstName, birthDate: m.birthDate, email: m.email, phone: m.phone,
      street: m.street, zip: m.zip, city: m.city, guardianName: m.guardianName, guardianEmail: m.guardianEmail, guardianPhone: m.guardianPhone,
    }));
  }

  function changeMode(m: "member" | "external") {
    setMode(m);
    if (m === "external") setV((s) => ({ ...s, userId: null }));
  }

  const age = ageOn(v.birthDate, refDay);
  const minor = age !== null && age < 18;
  const available = members.filter((m) => m.userId === initial?.userId || !takenUserIds.includes(m.userId));

  return (
    <form onSubmit={submitKeepingValues(action)} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="userId" value={mode === "member" ? (v.userId ?? "") : ""} />

      <Card className="animate-rise space-y-3 p-4">
        <Segmented<"member" | "external">
          label="Herkunft"
          value={mode}
          onChange={changeMode}
          options={[{ value: "member", label: "Mitglied", disabled: !members.length }, { value: "external", label: "Extern (ohne Konto)" }]}
        />
        {mode === "member" ? (
          <Field label="Mitglied" hint="Name, Geburtsdatum und Kontakt werden übernommen und können angepasst werden.">
            <Select value={v.userId ?? ""} onChange={(e) => pickMember(e.target.value)} required>
              <option value="">– Mitglied wählen –</option>
              {available.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </Select>
          </Field>
        ) : (
          <p className="text-sm text-ink-3">Für Jugendliche oder Gäste ohne App-Konto. Bei unter 18-Jährigen sind die Angaben der erziehungsberechtigten Person nötig.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vorname" error={err?.firstName}><Input name="firstName" value={val("firstName")} onChange={set("firstName")} required maxLength={191} autoComplete="off" /></Field>
          <Field label="Nachname" error={err?.lastName}><Input name="lastName" value={val("lastName")} onChange={set("lastName")} required maxLength={191} autoComplete="off" /></Field>
          <Field label="Geburtsdatum" hint={age !== null ? `${age} Jahre am ${refDay.split("-").reverse().join(".")}` : "Für Altersprüfung und Kursausweis"} error={err?.birthDate}>
            <Input type="date" name="birthDate" value={val("birthDate")} onChange={set("birthDate")} />
          </Field>
          <Field label="E-Mail" error={err?.email}><Input type="email" name="email" value={val("email")} onChange={set("email")} maxLength={191} /></Field>
          <Field label="Telefon" error={err?.phone}><Input type="tel" name="phone" value={val("phone")} onChange={set("phone")} maxLength={191} /></Field>
          <Field label="Strasse" error={err?.street}><Input name="street" value={val("street")} onChange={set("street")} maxLength={191} /></Field>
          <div className="grid grid-cols-[6rem_1fr] gap-3 sm:col-span-2">
            <Field label="PLZ" error={err?.zip}><Input name="zip" value={val("zip")} onChange={set("zip")} maxLength={191} inputMode="numeric" /></Field>
            <Field label="Ort" error={err?.city}><Input name="city" value={val("city")} onChange={set("city")} maxLength={191} /></Field>
          </div>
        </div>
      </Card>

      <Card className={`animate-rise space-y-3 p-4 ${minor ? "border-warn" : ""}`}>
        <div className="flex items-start gap-2">
          {minor ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden /> : null}
          <div>
            <h2 className="font-semibold">Erziehungsberechtigte</h2>
            <p className="text-sm text-ink-3">{minor ? "Pflicht: unter 18 Jahre. Name und E-Mail oder Telefon angeben." : "Nur bei Minderjährigen nötig."}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" error={err?.guardianName}><Input name="guardianName" value={val("guardianName")} onChange={set("guardianName")} required={minor} maxLength={191} /></Field>
          <Field label="E-Mail" error={err?.guardianEmail}><Input type="email" name="guardianEmail" value={val("guardianEmail")} onChange={set("guardianEmail")} maxLength={191} /></Field>
          <Field label="Telefon" error={err?.guardianPhone}><Input type="tel" name="guardianPhone" value={val("guardianPhone")} onChange={set("guardianPhone")} maxLength={191} /></Field>
        </div>
      </Card>

      <Card className="animate-rise space-y-3 p-4">
        {weaponsEnabled ? (
          <Field label="Vereinswaffe" hint="Nur Zuteilung. Ausleihe und Rückgabe laufen im Modul Vereinswaffen." error={err?.clubWeaponId}>
            <Select name="clubWeaponId" value={val("clubWeaponId")} onChange={set("clubWeaponId")}>
              <option value="">– keine –</option>
              {currentWeapon && !weapons.some((w) => w.id === currentWeapon.id) ? <option value={currentWeapon.id}>{currentWeapon.name} (zugeteilt)</option> : null}
              {weapons.map((w) => <option key={w.id} value={w.id}>{[w.name, w.discipline, w.caliber].filter(Boolean).join(" · ")}</option>)}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="clubWeaponId" value={v.clubWeaponId ?? ""} />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Select name="status" value={v.status} onChange={set("status")}>
              {PARTICIPANT_STATUSES.filter((s) => s !== "COMPLETED" || v.status === "COMPLETED").map((s) => <option key={s} value={s}>{PARTICIPANT_STATUS[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Bemerkung" error={err?.note}><Input name="note" value={val("note")} onChange={set("note")} maxLength={191} /></Field>
        </div>
      </Card>

      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} className="w-full sm:w-auto"><Save className="h-4 w-4" /> {initial?.id ? "Speichern" : "Hinzufügen"}</SubmitButton>
    </form>
  );
}
