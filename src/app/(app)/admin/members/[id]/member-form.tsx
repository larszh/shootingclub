"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, ShieldCheck, UserX } from "lucide-react";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { ActionButton } from "@/components/ui/action-button";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { ROLE_LABELS, TENANT_ROLES } from "@/lib/permissions";
import type { AccessState } from "@/modules/members/queries";
import { MEMBER_STATUSES, STATUS_LABELS, isMinor } from "@/modules/members/types";
import { bulkSetStatusAction, sendAccessMailAction, updateMemberAction } from "@/modules/members/actions";
import { removeMemberAction, updateMemberRoleAction } from "@/modules/core/tenant-actions";

type Values = {
  name: string; email: string; phone: string; birthDate: string; street: string; zip: string; city: string;
  memberNumber: string; licenseNumber: string; status: string; joinedAt: string; leftAt: string;
  feeCategoryId: string; feeOverride: string; householdId: string;
  guardianName: string; guardianEmail: string; guardianPhone: string; adminNote: string; workHoursExempt: boolean;
};

export function MemberForm({ membershipId, values, today, profileEditable, emailEditable, categories, households }: {
  membershipId: string;
  values: Values;
  today: string;
  /** false: Konto mit eigenem Passwort oder auch in einem anderen Verein – Personendaten pflegt die Person selbst */
  profileEditable: boolean;
  emailEditable: boolean;
  categories: Array<{ id: string; label: string }>;
  households: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(updateMemberAction.bind(null, membershipId), null);
  const [birthDate, setBirthDate] = useState(values.birthDate);
  const [status, setStatus] = useState(values.status);
  const [exempt, setExempt] = useState(values.workHoursExempt);
  const minor = isMinor(birthDate || null, today);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  const ro = !profileEditable;
  const roClass = ro ? "bg-surface-2" : undefined;

  return (
    <Card className="animate-rise p-4">
      <form onSubmit={submitKeepingValues(action)} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Person</legend>
          {ro ? <p className="text-xs text-ink-3">Diese Angaben pflegt die Person selbst in ihrem Profil (eigenes Konto oder auch in einem anderen Verein).</p> : null}
          <Field label="Name" error={fe.name}><Input name="name" defaultValue={values.name} required maxLength={191} readOnly={ro} className={roClass} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-Mail" error={fe.email} hint={emailEditable ? "Leer lassen, wenn keine E-Mail bekannt ist" : ro ? undefined : "Ändert die Person selbst in ihrem Profil"}>
              <Input name="email" type="email" defaultValue={values.email} readOnly={!emailEditable} className={emailEditable ? undefined : "bg-surface-2"} autoComplete="off" />
            </Field>
            <Field label="Telefon" error={fe.phone}><Input name="phone" type="tel" defaultValue={values.phone} inputMode="tel" maxLength={40} readOnly={ro} className={roClass} /></Field>
          </div>
          <Field label="Geburtsdatum" error={fe.birthDate}><Input name="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={today} min="1900-01-01" readOnly={ro} className={roClass} /></Field>
          <Field label="Strasse und Nr." error={fe.street}><Input name="street" defaultValue={values.street} maxLength={80} readOnly={ro} className={roClass} /></Field>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Field label="PLZ" error={fe.zip}><Input name="zip" defaultValue={values.zip} inputMode="numeric" maxLength={12} readOnly={ro} className={roClass} /></Field>
            <Field label="Ort" error={fe.city}><Input name="city" defaultValue={values.city} maxLength={80} readOnly={ro} className={roClass} /></Field>
          </div>
        </fieldset>

        {minor ? (
          <fieldset className="space-y-3 rounded-control border border-warn/40 bg-warn/5 p-3">
            <legend className="px-1 text-sm font-semibold">Gesetzliche Vertretung (unter 18)</legend>
            <Field label="Name" error={fe.guardianName}><Input name="guardianName" defaultValue={values.guardianName} maxLength={191} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-Mail" error={fe.guardianEmail}><Input name="guardianEmail" type="email" defaultValue={values.guardianEmail} /></Field>
              <Field label="Telefon" error={fe.guardianPhone}><Input name="guardianPhone" type="tel" defaultValue={values.guardianPhone} maxLength={40} /></Field>
            </div>
          </fieldset>
        ) : (
          <>
            {/* Werte behalten, auch wenn die Felder ausgeblendet sind */}
            <input type="hidden" name="guardianName" value={values.guardianName} />
            <input type="hidden" name="guardianEmail" value={values.guardianEmail} />
            <input type="hidden" name="guardianPhone" value={values.guardianPhone} />
          </>
        )}

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Mitgliedschaft</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status" error={fe.status}>
              <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Field label="Mitgliedernummer" error={fe.memberNumber}><Input name="memberNumber" defaultValue={values.memberNumber} maxLength={40} /></Field>
            <Field label="Eintritt" error={fe.joinedAt}><Input name="joinedAt" type="date" defaultValue={values.joinedAt} /></Field>
            <Field label="Austritt" error={fe.leftAt} hint={status === "LEFT" ? "Leer = heute" : "Optional, z.B. geplanter Austritt"}><Input name="leftAt" type="date" defaultValue={values.leftAt} /></Field>
            <Field label="Lizenznummer" hint="Swiss Shooting" error={fe.licenseNumber}><Input name="licenseNumber" defaultValue={values.licenseNumber} maxLength={40} /></Field>
            <Field label="Haushalt" error={fe.householdId}>
              <Select name="householdId" defaultValue={values.householdId}>
                <option value="">Kein Haushalt</option>
                {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            </Field>
            <Field label="Beitragskategorie" error={fe.feeCategoryId}>
              <Select name="feeCategoryId" defaultValue={values.feeCategoryId}>
                <option value="">Keine</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Individueller Beitrag (CHF)" hint="Überschreibt die Kategorie" error={fe.feeOverride}><Input name="feeOverride" defaultValue={values.feeOverride} inputMode="decimal" placeholder="z.B. 80.00" /></Field>
          </div>
          {status === "LEFT" && values.status !== "LEFT" ? (
            <Alert tone="warn">Ausgetretene verlieren den Zugang zum Verein. Daten, Resultate und Rechnungen bleiben erhalten.</Alert>
          ) : null}
          <Switch label="Von Arbeitsstunden befreit" checked={exempt} onChange={setExempt} />
          <input type="hidden" name="workHoursExempt" value={exempt ? "on" : ""} />
          <Field label="Notiz (nur Vorstand)" error={fe.adminNote}><Textarea name="adminNote" defaultValue={values.adminNote} className="min-h-20" maxLength={5000} /></Field>
        </fieldset>

        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} pendingText="Wird gespeichert…" className="w-full sm:w-auto">Speichern</SubmitButton>
      </form>
    </Card>
  );
}

export function RoleCard({ membershipId, name, role, locked, canSetOwner }: { membershipId: string; name: string; role: string; locked: boolean; canSetOwner: boolean }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(role);
  const ownerLocked = role === "OWNER" && !canSetOwner;
  return (
    <Card className="animate-rise flex items-center gap-3 p-4">
      <ShieldCheck className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Rolle</div>
        <div className="text-xs text-ink-3">{locked ? "Die eigene Rolle ändert jemand anderes." : ownerLocked ? "Nur Inhaber können Inhaber ändern." : "Legt fest, was die Person verwalten darf."}</div>
      </div>
      {pending ? <Spinner /> : null}
      <Select
        value={current}
        disabled={pending || locked || ownerLocked}
        aria-label={`Rolle von ${name}`}
        className="w-36"
        onChange={(e) => {
          const next = e.target.value;
          const prev = current;
          setCurrent(next);
          start(async () => {
            const res = await updateMemberRoleAction(membershipId, next);
            if (!res.ok) {
              setCurrent(prev);
              toast.error(res.error);
            } else if (res.message) toast.success(res.message);
          });
        }}
      >
        {TENANT_ROLES.map((r) => <option key={r} value={r} disabled={r === "OWNER" && !canSetOwner}>{ROLE_LABELS[r]}</option>)}
      </Select>
    </Card>
  );
}

const ACCESS_TEXT: Record<AccessState, { title: string; text: string }> = {
  password: { title: "Hat Zugang", text: "Meldet sich mit eigener E-Mail und Passwort an." },
  invited: { title: "Eingeladen", text: "Der Link zum Passwort-Setzen ist verschickt und noch gültig." },
  none: { title: "Noch kein Zugang", text: "Erfasst, aber noch nie eingeladen. Mit der Zugangsmail legt die Person ein Passwort fest." },
  noemail: { title: "Ohne E-Mail", text: "Kann sich nicht anmelden, wird aber in Listen und Rechnungen geführt. Für Zugang eine E-Mail eintragen." },
};

export function AccessCard({ membershipId, access, hasTwoFactor, canSendMail }: { membershipId: string; access: AccessState; hasTwoFactor: boolean; canSendMail: boolean }) {
  // Konto gehört auch zu einem anderen Verein: Zugang holt sich die Person selbst
  const t = !canSendMail && (access === "none" || access === "invited")
    ? { title: ACCESS_TEXT[access].title, text: "Das Konto gehört auch zu einem anderen Verein. Die Person setzt ihr Passwort selbst über «Passwort vergessen» auf der Anmeldeseite." }
    : ACCESS_TEXT[access];
  return (
    <Card className="animate-rise flex flex-wrap items-center gap-3 p-4">
      <KeyRound className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{t.title}{access === "password" && hasTwoFactor ? " · Zwei-Faktor aktiv" : ""}</div>
        <div className="text-xs text-ink-3">{t.text}</div>
      </div>
      {canSendMail && (access === "none" || access === "invited") ? (
        <ActionButton variant="secondary" size="sm" className="h-11" action={() => sendAccessMailAction(membershipId)} pendingText="Wird gesendet…">
          <Mail className="h-4 w-4" /> {access === "invited" ? "Erneut senden" : "Zugangsmail senden"}
        </ActionButton>
      ) : null}
    </Card>
  );
}

export function DangerZone({ membershipId, name, status }: { membershipId: string; name: string; status: string }) {
  const router = useRouter();
  return (
    <>
      <h2 className="mb-2.5 mt-8 text-xs font-semibold uppercase tracking-wider text-danger">Austritt & Entfernen</h2>
      <Card className="animate-rise space-y-3 border-danger/30 p-4">
        {status !== "LEFT" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-ink-2">Austritt erfassen: Zugang endet, Daten und Rechnungen bleiben für die Buchhaltung erhalten.</p>
            <ActionButton
              variant="secondary"
              className="h-11"
              action={() => bulkSetStatusAction([membershipId], "LEFT")}
              confirm={{ title: `${name} als ausgetreten markieren?`, message: "Der Zugang zum Verein endet sofort. Rückgängig über den Status.", tone: "danger", confirmLabel: "Austritt erfassen" }}
            >
              <UserX className="h-4 w-4" /> Austritt
            </ActionButton>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-ink-2">Endgültig entfernen, z.B. bei falscher Erfassung. Rechnungen bleiben erhalten, die Verknüpfung zum Mitglied nicht.</p>
          <ActionButton
            variant="danger"
            className="h-11"
            action={() => removeMemberAction(membershipId)}
            confirm={{ title: `${name} endgültig entfernen?`, message: "Für einen normalen Austritt besser «Austritt» verwenden.", tone: "danger", confirmLabel: "Entfernen" }}
            onSuccess={() => router.push("/admin/members")}
          >
            Entfernen
          </ActionButton>
        </div>
      </Card>
    </>
  );
}
