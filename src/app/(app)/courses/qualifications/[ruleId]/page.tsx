import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Pencil, Printer, Target, Trash2, Undo2 } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateZurich, zurichParts } from "@/lib/time";
import { deleteRuleAction, grantQualificationAction, revokeQualificationAction } from "@/modules/courses/actions";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { chDate, dbDay, evaluateRule, qualificationValidity } from "@/modules/courses/logic";
import { getRule, recentMatchesForProgram } from "@/modules/courses/queries";
import { QUAL_RESPONSIBILITY_HINT } from "@/modules/courses/types";
import { NavActionButton } from "@/modules/courses/ui/nav-action-button";
import { qualificationLabel } from "@/modules/qualifications/types";

export const metadata: Metadata = { title: "Qualifikationsregel" };

export default async function RulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const ctx = await requireQualificationAccess();
  const { ruleId } = await params;
  const rule = await getRule(ctx.tenant.id, ruleId.slice(0, 40));
  if (!rule) notFound();
  const isInstructor = ctx.can("courses.manage");
  const matches = await recentMatchesForProgram(ctx.tenant.id, rule.programId, 20);
  const limits = { passScore: rule.passScore, maxZeros: rule.maxZeros };

  return (
    <div>
      <PageHeader
        title={rule.name}
        subtitle={`${qualificationLabel(rule.kind)} · ${rule.program.name}`}
        back={{ href: "/courses/qualifications", label: "Qualifikationen" }}
        action={<LinkButton href={`/courses/qualifications/${rule.id}/edit`} variant="secondary" size="md"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton>}
      />

      <Card className="mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-ink-3">Mindestpunktzahl</div><div className="font-semibold tabular-nums">{rule.passScore}</div></div>
        <div><div className="text-xs text-ink-3">Max. Nuller</div><div className="font-semibold tabular-nums">{rule.maxZeros ?? "–"}</div></div>
        <div><div className="text-xs text-ink-3">Gültigkeit</div><div className="font-semibold">{rule.validityMonths} Monate</div></div>
        <div><div className="text-xs text-ink-3">Erteilung</div><div className="font-semibold">{rule.requireInstructor ? "durch Ausbildner:in" : "Kursleitung"}</div></div>
      </Card>
      {!rule.isActive ? <Alert tone="warn" className="mb-4">Diese Regel ist inaktiv. Es können keine Qualifikationen erteilt werden.</Alert> : null}
      {!isInstructor ? <Alert tone="info" className="mb-4">Qualifikationen erteilen kann nur die Kursleitung (Ausbildner:innen).</Alert> : null}

      <SectionTitle>Abgeschlossene Durchgänge</SectionTitle>
      {matches.length === 0 ? (
        <EmptyState icon={<Target className="h-5 w-5" />} title="Noch keine Durchgänge" text={`Sobald ein Durchgang mit «${rule.program.name}» abgeschlossen ist, erscheint er hier mit allen Teilnehmenden.`} />
      ) : (
        <div className="space-y-4">
          {matches.map((m) => {
            const day = zurichParts(m.finishedAt ?? m.date).dateStr;
            const until = qualificationValidity(day, rule.validityMonths).validUntil;
            return (
              <Card key={m.id} className="overflow-hidden">
                <div className="border-b border-line bg-surface-2 px-4 py-2 text-sm">
                  <span className="font-medium">{formatDateZurich(m.finishedAt ?? m.date)}</span>
                  {m.title ? <span className="text-ink-3"> · {m.title}</span> : null}
                </div>
                <ul className="divide-y divide-line">
                  {m.participants.map((p) => {
                    const ev = evaluateRule(limits, { total: p.total, zeros: p.zeros });
                    const granted = p.qualifications.find((q) => q.kind === rule.kind) ?? null;
                    const self = p.userId === ctx.user.id;
                    const blockedSelf = rule.requireInstructor && self;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {ev.ok ? <Badge tone="ok">erfüllt</Badge> : <Badge tone="outline">nicht erfüllt</Badge>}
                            {!p.userId ? <Badge tone="outline">Gast</Badge> : null}
                          </div>
                          <div className="text-xs text-ink-3">
                            {p.total ?? "–"} Punkte · {p.zeros ?? "–"} Nuller{!ev.ok ? ` · ${ev.reasons.join(" ")}` : ""}
                          </div>
                        </div>
                        {granted ? (
                          <div className="flex items-center gap-1">
                            <Badge tone="ok"><BadgeCheck className="mr-1 h-3 w-3" /> bis {chDate(dbDay(granted.validUntil))}</Badge>
                            <LinkButton href={`/courses/qualifications/certificate/${granted.id}`} variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Nachweis drucken" prefetch={false}><Printer className="h-4 w-4" /></LinkButton>
                            <ActionButton variant="ghost" size="sm" className="h-11 w-11 px-0" aria-label="Qualifikation zurückziehen" action={revokeQualificationAction.bind(null, granted.id)} confirm={{ title: "Qualifikation zurückziehen?", message: `${p.name} verliert diese Qualifikation.`, tone: "danger", confirmLabel: "Zurückziehen" }}>
                              <Undo2 className="h-4 w-4" />
                            </ActionButton>
                          </div>
                        ) : isInstructor && rule.isActive && ev.ok && p.userId ? (
                          blockedSelf ? (
                            <span className="text-xs text-ink-3">Eigene Qualifikation: andere Ausbildner:in nötig</span>
                          ) : (
                            <ActionButton
                              size="md"
                              action={grantQualificationAction.bind(null, rule.id, p.id)}
                              confirm={{ title: "Qualifikation erteilen?", message: `${p.name}: «${rule.name}», gültig bis ${chDate(until)}. Du bestätigst als Ausbildner:in das Resultat.`, confirmLabel: "Erteilen" }}
                            >
                              <BadgeCheck className="h-4 w-4" /> Qualifikation erteilen
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

      <p className="mt-4 text-xs text-ink-3">{QUAL_RESPONSIBILITY_HINT}</p>

      <div className="mt-6 flex justify-end">
        <NavActionButton
          to="/courses/qualifications"
          variant="ghost"
          action={deleteRuleAction.bind(null, rule.id)}
          confirm={{ title: "Regel löschen?", message: "Bereits erteilte Qualifikationen bleiben bestehen.", tone: "danger", confirmLabel: "Löschen" }}
        >
          <Trash2 className="h-4 w-4" /> Regel löschen
        </NavActionButton>
      </div>
    </div>
  );
}
