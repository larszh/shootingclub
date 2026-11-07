import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Pencil, Printer, Target, Trash2, Undo2 } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { zurichParts } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { deleteRuleAction, grantQualificationAction, revokeQualificationAction } from "@/modules/courses/actions";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { dbDay, evaluateRule, qualificationValidity } from "@/modules/courses/logic";
import { getRule, recentMatchesForProgram } from "@/modules/courses/queries";
import { isProtectedQualKind, monthsLabel } from "@/modules/courses/types";
import { NavActionButton } from "@/modules/courses/ui/nav-action-button";
import { qualificationLabel } from "@/modules/qualifications/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.q.ruleMeta") };
}

export default async function RulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const ctx = await requireQualificationAccess();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const chDate = (d: string | null) => dayKeyLabel(d, locale);
  const { ruleId } = await params;
  const rule = await getRule(ctx.tenant.id, ruleId.slice(0, 40));
  if (!rule) notFound();
  const protectedKind = isProtectedQualKind(rule.kind);
  const isQualAdmin = ctx.can("qualifications.manage");
  // Sicherheits- und Leiterqualifikationen erteilt nur ein Admin (qualifications.manage).
  const isInstructor = ctx.can("courses.manage") && (!protectedKind || isQualAdmin);
  const canEditRule = !protectedKind || isQualAdmin;
  const matches = await recentMatchesForProgram(ctx.tenant.id, rule.programId, 20);
  const limits = { passScore: rule.passScore, maxZeros: rule.maxZeros };

  return (
    <div>
      <PageHeader
        title={rule.name}
        subtitle={`${qualificationLabel(rule.kind, t)} · ${rule.program.name}`}
        back={{ href: "/courses/qualifications", label: t("adm2.courses.q.quals") }}
        action={canEditRule ? <LinkButton href={`/courses/qualifications/${rule.id}/edit`} variant="secondary" size="md"><Pencil className="h-4 w-4" /> {t("adm2.courses.d.edit")}</LinkButton> : undefined}
      />

      <Card className="mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-ink-3">{t("adm2.courses.q.passScore")}</div><div className="font-semibold tabular-nums">{rule.passScore}</div></div>
        <div><div className="text-xs text-ink-3">{t("adm2.courses.q.maxZeros")}</div><div className="font-semibold tabular-nums">{rule.maxZeros ?? "–"}</div></div>
        <div><div className="text-xs text-ink-3">{t("adm2.courses.q.validity")}</div><div className="font-semibold">{monthsLabel(rule.validityMonths, t)}</div></div>
        <div><div className="text-xs text-ink-3">{t("adm2.courses.q.granting")}</div><div className="font-semibold">{rule.requireInstructor || protectedKind ? t("adm2.courses.q.byInstructor") : t("adm2.courses.q.byLeaders")}</div></div>
      </Card>
      {!rule.isActive ? <Alert tone="warn" className="mb-4">{t("adm2.courses.q.inactiveText")}</Alert> : null}
      {!isInstructor ? (
        <Alert tone="info" className="mb-4">
          {protectedKind && ctx.can("courses.manage") ? t("adm2.courses.q.onlyAdmin") : t("adm2.courses.q.onlyLeaders")}
        </Alert>
      ) : null}

      <SectionTitle>{t("adm2.courses.q.matches")}</SectionTitle>
      {matches.length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title={t("adm2.courses.q.noMatches")} text={t("adm2.courses.q.noMatchesText", { program: rule.program.name })} />
      ) : (
        <div className="space-y-4">
          {matches.map((m) => {
            const day = zurichParts(m.finishedAt ?? m.date).dateStr;
            const until = qualificationValidity(day, rule.validityMonths).validUntil;
            return (
              <Card key={m.id} className="overflow-hidden">
                <div className="border-b border-line bg-surface-2 px-4 py-2 text-sm">
                  <span className="font-medium">{formatDate(m.finishedAt ?? m.date, locale, { weekday: "short" })}</span>
                  {m.title ? <span className="text-ink-3"> · {m.title}</span> : null}
                </div>
                <ul className="divide-y divide-line">
                  {m.participants.map((p) => {
                    const ev = evaluateRule(limits, { total: p.total, zeros: p.zeros }, t);
                    const granted = p.qualifications.find((q) => q.kind === rule.kind) ?? null;
                    const self = p.userId === ctx.user.id;
                    const blockedSelf = (rule.requireInstructor || protectedKind) && self;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {ev.ok ? <Badge tone="ok">{t("adm2.courses.q.met")}</Badge> : <Badge tone="outline">{t("adm2.courses.q.notMet")}</Badge>}
                            {!p.userId ? <Badge tone="outline">{t("adm2.courses.q.guest")}</Badge> : null}
                          </div>
                          <div className="text-xs text-ink-3">
                            {t("adm2.courses.q.scoreLine", { total: p.total ?? "–", zeros: p.zeros ?? "–" })}{!ev.ok ? ` · ${ev.reasons.join(" ")}` : ""}
                          </div>
                        </div>
                        {granted ? (
                          <div className="flex items-center gap-1">
                            <Badge tone="ok"><BadgeCheck className="mr-1 h-3 w-3" /> {t("adm2.courses.q.until", { date: chDate(dbDay(granted.validUntil)) })}</Badge>
                            <LinkButton href={`/courses/qualifications/certificate/${granted.id}`} variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label={t("adm2.courses.q.printCert")} prefetch={false}><Printer className="h-4 w-4" /></LinkButton>
                            <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label={t("adm2.courses.q.revoke")} action={revokeQualificationAction.bind(null, granted.id)} confirm={{ title: t("adm2.courses.q.revokeQ"), message: t("adm2.courses.q.revokeText", { name: p.name }), tone: "danger", confirmLabel: t("adm2.courses.q.revokeConfirm") }}>
                              <Undo2 className="h-4 w-4" />
                            </ActionButton>
                          </div>
                        ) : isInstructor && rule.isActive && ev.ok && p.userId ? (
                          blockedSelf ? (
                            <span className="text-xs text-ink-3">{t("adm2.courses.q.selfBlocked")}</span>
                          ) : (
                            <ActionButton
                              size="md"
                              action={grantQualificationAction.bind(null, rule.id, p.id)}
                              confirm={{ title: t("adm2.courses.q.grantQ"), message: t("adm2.courses.q.grantText", { name: p.name, rule: rule.name, date: chDate(until) }), confirmLabel: t("adm2.courses.q.grantConfirm") }}
                            >
                              <BadgeCheck className="h-4 w-4" /> {t("adm2.courses.q.grant")}
                            </ActionButton>
                          )
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-ink-3">{t("adm2.courses.qualResponsibility")}</p>

      {canEditRule ? (
        <div className="mt-6 flex justify-end">
          <NavActionButton
            to="/courses/qualifications"
            variant="ghost"
            action={deleteRuleAction.bind(null, rule.id)}
            confirm={{ title: t("adm2.courses.q.deleteQ"), message: t("adm2.courses.q.deleteText"), tone: "danger", confirmLabel: t("adm2.common.delete") }}
          >
            <Trash2 className="h-4 w-4" /> {t("adm2.courses.q.delete")}
          </NavActionButton>
        </div>
      ) : null}
    </div>
  );
}
