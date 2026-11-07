"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, ShieldCheck, UserX } from "lucide-react";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Switch } from "@/components/ui/controls";
import { ActionButton } from "@/components/ui/action-button";
import { SubmitButton, Spinner, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { TENANT_ROLES } from "@/lib/permissions";
import { getT, type Locale } from "@/lib/i18n/core";
import type { AccessState } from "@/modules/members/queries";
import { MEMBER_STATUSES, isMinor } from "@/modules/members/types";
import { bulkSetStatusAction, sendAccessMailAction, updateMemberAction } from "@/modules/members/actions";
import { removeMemberAction, updateMemberRoleAction } from "@/modules/core/tenant-actions";

type Values = {
  name: string; email: string; phone: string; birthDate: string; street: string; zip: string; city: string;
  memberNumber: string; licenseNumber: string; status: string; joinedAt: string; leftAt: string;
  feeCategoryId: string; feeOverride: string; householdId: string;
  guardianName: string; guardianEmail: string; guardianPhone: string; adminNote: string; workHoursExempt: boolean;
};

export function MemberForm({ locale, membershipId, values, today, profileEditable, emailEditable, categories, households }: {
  locale: Locale;
  membershipId: string;
  values: Values;
  today: string;
  /** false: Konto mit eigenem Passwort oder auch in einem anderen Verein – Personendaten pflegt die Person selbst */
  profileEditable: boolean;
  emailEditable: boolean;
  categories: Array<{ id: string; label: string }>;
  households: Array<{ id: string; name: string }>;
}) {
  const t = getT(locale);
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
          <legend className="mb-2 text-sm font-semibold">{t("adm1.member.person")}</legend>
          {ro ? <p className="text-xs text-ink-3">{t("adm1.member.selfManaged")}</p> : null}
          <Field label={t("adm1.common.name")} error={fe.name}><Input name="name" defaultValue={values.name} required maxLength={191} readOnly={ro} className={roClass} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("adm1.common.email")} error={fe.email} hint={emailEditable ? t("adm1.member.emailEmptyHint") : ro ? undefined : t("adm1.member.emailSelfHint")}>
              <Input name="email" type="email" defaultValue={values.email} readOnly={!emailEditable} className={emailEditable ? undefined : "bg-surface-2"} autoComplete="off" />
            </Field>
            <Field label={t("adm1.member.phone")} error={fe.phone}><Input name="phone" type="tel" defaultValue={values.phone} inputMode="tel" maxLength={40} readOnly={ro} className={roClass} /></Field>
          </div>
          <Field label={t("adm1.member.birthDate")} error={fe.birthDate}><Input name="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={today} min="1900-01-01" readOnly={ro} className={roClass} /></Field>
          <Field label={t("adm1.member.street")} error={fe.street}><Input name="street" defaultValue={values.street} maxLength={80} readOnly={ro} className={roClass} /></Field>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Field label={t("adm1.member.zip")} error={fe.zip}><Input name="zip" defaultValue={values.zip} inputMode="numeric" maxLength={12} readOnly={ro} className={roClass} /></Field>
            <Field label={t("adm1.tenant.city")} error={fe.city}><Input name="city" defaultValue={values.city} maxLength={80} readOnly={ro} className={roClass} /></Field>
          </div>
        </fieldset>

        {minor ? (
          <fieldset className="space-y-3 rounded-control border border-warn/40 bg-warn/5 p-3">
            <legend className="px-1 text-sm font-semibold">{t("adm1.member.guardian")}</legend>
            <Field label={t("adm1.common.name")} error={fe.guardianName}><Input name="guardianName" defaultValue={values.guardianName} maxLength={191} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("adm1.common.email")} error={fe.guardianEmail}><Input name="guardianEmail" type="email" defaultValue={values.guardianEmail} /></Field>
              <Field label={t("adm1.member.phone")} error={fe.guardianPhone}><Input name="guardianPhone" type="tel" defaultValue={values.guardianPhone} maxLength={40} /></Field>
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
          <legend className="mb-2 text-sm font-semibold">{t("adm1.member.membership")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("adm1.common.status")} error={fe.status}>
              <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{t(`members.status.${s}`)}</option>)}
              </Select>
            </Field>
            <Field label={t("adm1.members.sort.number")} error={fe.memberNumber}><Input name="memberNumber" defaultValue={values.memberNumber} maxLength={40} /></Field>
            <Field label={t("adm1.member.joined")} error={fe.joinedAt}><Input name="joinedAt" type="date" defaultValue={values.joinedAt} /></Field>
            <Field label={t("adm1.member.left")} error={fe.leftAt} hint={status === "LEFT" ? t("adm1.member.leftEmptyToday") : t("adm1.member.leftOptional")}><Input name="leftAt" type="date" defaultValue={values.leftAt} /></Field>
            <Field label={t("adm1.member.licenseNumber")} hint="Swiss Shooting" error={fe.licenseNumber}><Input name="licenseNumber" defaultValue={values.licenseNumber} maxLength={40} /></Field>
            <Field label={t("adm1.members.household")} error={fe.householdId}>
              <Select name="householdId" defaultValue={values.householdId}>
                <option value="">{t("adm1.members.noHousehold")}</option>
                {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            </Field>
            <Field label={t("adm1.members.feeCategory")} error={fe.feeCategoryId}>
              <Select name="feeCategoryId" defaultValue={values.feeCategoryId}>
                <option value="">{t("adm1.member.none")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label={t("adm1.member.feeOverride")} hint={t("adm1.member.feeOverrideHint")} error={fe.feeOverride}><Input name="feeOverride" defaultValue={values.feeOverride} inputMode="decimal" placeholder={t("adm1.member.feeOverridePlaceholder")} /></Field>
          </div>
          {status === "LEFT" && values.status !== "LEFT" ? (
            <Alert tone="warn">{t("adm1.member.leftWarning")}</Alert>
          ) : null}
          <Switch label={t("adm1.member.workHoursExempt")} checked={exempt} onChange={setExempt} />
          <input type="hidden" name="workHoursExempt" value={exempt ? "on" : ""} />
          <Field label={t("adm1.member.adminNote")} error={fe.adminNote}><Textarea name="adminNote" defaultValue={values.adminNote} className="min-h-20" maxLength={5000} /></Field>
        </fieldset>

        {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton pending={pending} pendingText={t("adm1.common.saving")} className="w-full sm:w-auto">{t("adm1.common.save")}</SubmitButton>
      </form>
    </Card>
  );
}

export function RoleCard({ locale, membershipId, name, role, locked, canSetOwner }: { locale: Locale; membershipId: string; name: string; role: string; locked: boolean; canSetOwner: boolean }) {
  const t = getT(locale);
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(role);
  const ownerLocked = role === "OWNER" && !canSetOwner;
  return (
    <Card className="animate-rise flex items-center gap-3 p-4">
      <ShieldCheck className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{t("adm1.members.role")}</div>
        <div className="text-xs text-ink-3">{t(locked ? "adm1.member.roleSelf" : ownerLocked ? "adm1.member.roleOwnerOnly" : "adm1.member.roleHint")}</div>
      </div>
      {pending ? <Spinner /> : null}
      <Select
        value={current}
        disabled={pending || locked || ownerLocked}
        aria-label={t("adm1.member.roleOf", { name })}
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
        {TENANT_ROLES.map((r) => <option key={r} value={r} disabled={r === "OWNER" && !canSetOwner}>{t(`role.${r}`)}</option>)}
      </Select>
    </Card>
  );
}

/** Schlüssel unter adm1.member.access.<Zustand>.title / .text */
const ACCESS_TEXT: Record<AccessState, string> = {
  password: "adm1.member.access.password",
  invited: "adm1.member.access.invited",
  none: "adm1.member.access.none",
  noemail: "adm1.member.access.noemail",
};

export function AccessCard({ locale, membershipId, access, hasTwoFactor, canSendMail }: { locale: Locale; membershipId: string; access: AccessState; hasTwoFactor: boolean; canSendMail: boolean }) {
  // Konto gehört auch zu einem anderen Verein: Zugang holt sich die Person selbst
  const t = getT(locale);
  const info = {
    title: t(`${ACCESS_TEXT[access]}.title`),
    text: !canSendMail && (access === "none" || access === "invited") ? t("adm1.member.access.otherClub") : t(`${ACCESS_TEXT[access]}.text`),
  };
  return (
    <Card className="animate-rise flex flex-wrap items-center gap-3 p-4">
      <KeyRound className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{info.title}{access === "password" && hasTwoFactor ? ` · ${t("adm1.member.twoFactor")}` : ""}</div>
        <div className="text-xs text-ink-3">{info.text}</div>
      </div>
      {canSendMail && (access === "none" || access === "invited") ? (
        <ActionButton variant="secondary" size="sm" className="h-11" action={() => sendAccessMailAction(membershipId)} pendingText={t("adm1.common.sending")}>
          <Mail className="h-4 w-4" /> {t(access === "invited" ? "adm1.member.resend" : "adm1.member.sendAccessMail")}
        </ActionButton>
      ) : null}
    </Card>
  );
}

export function DangerZone({ locale, membershipId, name, status }: { locale: Locale; membershipId: string; name: string; status: string }) {
  const t = getT(locale);
  const router = useRouter();
  return (
    <>
      <h2 className="mb-2.5 mt-8 text-xs font-semibold uppercase tracking-wider text-danger">{t("adm1.member.danger")}</h2>
      <Card className="animate-rise space-y-3 border-danger/30 p-4">
        {status !== "LEFT" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-ink-2">{t("adm1.member.leaveText")}</p>
            <ActionButton
              variant="secondary"
              className="h-11"
              action={() => bulkSetStatusAction([membershipId], "LEFT")}
              confirm={{ title: t("adm1.member.leaveTitle", { name }), message: t("adm1.member.leaveMessage"), tone: "danger", confirmLabel: t("adm1.member.leaveConfirm") }}
            >
              <UserX className="h-4 w-4" /> {t("adm1.member.left")}
            </ActionButton>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-ink-2">{t("adm1.member.removeText")}</p>
          <ActionButton
            variant="danger"
            className="h-11"
            action={() => removeMemberAction(membershipId)}
            confirm={{ title: t("adm1.member.removeTitle", { name }), message: t("adm1.member.removeMessage"), tone: "danger", confirmLabel: t("adm1.member.remove") }}
            onSuccess={() => router.push("/admin/members")}
          >
            {t("adm1.member.remove")}
          </ActionButton>
        </div>
      </Card>
    </>
  );
}
