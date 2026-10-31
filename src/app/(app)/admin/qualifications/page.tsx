import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, LinkTabs, PageHeader, Select, StatCard } from "@/components/ui";
import { requireTenant } from "@/lib/tenant";
import { listQualifications, qualificationCounts, type QualificationRow } from "@/modules/qualifications/queries";
import { isQualificationKind, QUALIFICATION_KINDS, qualificationLabel } from "@/modules/qualifications/types";
import { shiftMemberOptions } from "@/modules/shifts/queries";
import { ShiftAdminTabs } from "@/modules/shifts/ui/nav";
import { DeleteQualificationButton, QualificationButton } from "@/modules/qualifications/ui/qualification-dialog";

export const metadata: Metadata = { title: "Qualifikationen" };

const dayFmt = (d: Date) => new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function QualificationsPage({ searchParams }: { searchParams: Promise<{ kind?: string; filter?: string; q?: string }> }) {
  const ctx = await requireTenant();
  const canManage = ctx.can("qualifications.manage");
  if (!canManage && !ctx.can("members.view")) redirect("/?denied=1");
  const sp = await searchParams;
  const kind = sp.kind && isQualificationKind(sp.kind) ? sp.kind : undefined;
  const expiring = sp.filter === "expiring";
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const tenantId = ctx.tenant.id;
  const [rows, counts, members] = await Promise.all([
    listQualifications(tenantId, { kind, expiring, q }),
    qualificationCounts(tenantId),
    canManage ? shiftMemberOptions(tenantId) : Promise.resolve([]),
  ]);
  const memberChoices = members.map((m) => ({ userId: m.userId, name: m.name }));
  const qs = (f: string | null) => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (q) p.set("q", q);
    if (f) p.set("filter", f);
    return `/admin/qualifications${p.size ? `?${p}` : ""}`;
  };
  const byUser = new Map<string, { name: string; items: QualificationRow[] }>();
  for (const r of rows) {
    const g = byUser.get(r.userId) ?? { name: r.user.name, items: [] };
    g.items.push(r);
    byUser.set(r.userId, g);
  }
  const showShiftTabs = ctx.hasModule("shifts") && ctx.can("shifts.manage");

  return (
    <div>
      {showShiftTabs ? <ShiftAdminTabs /> : null}
      <PageHeader title="Qualifikationen" subtitle="Schützenmeister, J+S, Erste Hilfe, Standaufsicht …" back={showShiftTabs ? undefined : { href: "/admin", label: "Einstellungen" }}
        action={canManage ? <QualificationButton members={memberChoices} /> : undefined} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Erfasst" value={counts.total} />
        <StatCard label="Läuft ab (60 Tage)" value={counts.expiring} tone={counts.expiring ? "warn" : "neutral"} href={qs("expiring")} />
        <StatCard label="Abgelaufen" value={counts.expired} tone={counts.expired ? "warn" : "neutral"} href={qs("expiring")} />
      </div>

      <LinkTabs active={expiring ? "expiring" : "all"} label="Filter" className="mb-3" items={[{ value: "all", label: "Alle", href: qs(null) }, { value: "expiring", label: "Läuft ab / abgelaufen", href: qs("expiring") }]} />
      <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {expiring ? <input type="hidden" name="filter" value="expiring" /> : null}
        <Select name="kind" defaultValue={kind ?? ""} aria-label="Art" className="sm:w-56">
          <option value="">Alle Arten</option>
          {QUALIFICATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </Select>
        <Input name="q" defaultValue={q ?? ""} placeholder="Name suchen" aria-label="Name suchen" className="sm:flex-1" />
        <Button type="submit" variant="secondary"><Search className="h-4 w-4" /> Filtern</Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title={counts.total ? "Nichts gefunden" : "Noch keine Qualifikationen"}
          text={counts.total ? "Filter anpassen." : "Erfasse Ausweise und Kurse der Mitglieder. Helfereinsätze und Standbetrieb zeigen dann, wer z.B. als Schützenmeister eingesetzt werden kann."} />
      ) : (
        <div className="space-y-3">
          {[...byUser].map(([userId, g]) => (
            <Card key={userId} className="animate-rise overflow-hidden">
              <div className="border-b border-line px-4 py-2.5 font-semibold">{g.name}</div>
              <div className="divide-y divide-line">
                {g.items.map((r) => (
                  <div key={r.id} className="flex min-h-14 items-center gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{qualificationLabel(r.kind)}</span>
                        {r.label ? <span className="text-ink-2">· {r.label}</span> : null}
                        {r.state === "expired" ? <Badge tone="danger">abgelaufen</Badge> : r.state === "expiring" ? <Badge tone="warn">läuft ab{r.daysLeft !== null ? ` in ${r.daysLeft} T.` : ""}</Badge> : r.state === "future" ? <Badge tone="outline">noch nicht gültig</Badge> : null}
                      </div>
                      <div className="text-xs text-ink-3">
                        {[r.number ? `Nr. ${r.number}` : null, r.validFrom ? `ab ${dayFmt(r.validFrom)}` : null, r.validUntil ? `bis ${dayFmt(r.validUntil)}` : "unbefristet", r.verifiedByName ? `geprüft: ${r.verifiedByName}` : null, r.sourceParticipantId ? "aus Qualifikationsschiessen" : null, r.note].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0">
                        <QualificationButton members={memberChoices.some((m) => m.userId === r.userId) ? memberChoices : [...memberChoices, { userId: r.userId, name: r.user.name }]}
                          initial={{ id: r.id, userId: r.userId, kind: r.kind, label: r.label, number: r.number, validFrom: dayKey(r.validFrom), validUntil: dayKey(r.validUntil), note: r.note }} />
                        <DeleteQualificationButton id={r.id} label={`${qualificationLabel(r.kind)} von ${r.user.name}`} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-ink-3">Die App unterstützt die Verantwortlichen, ersetzt aber nicht die Prüfung der Ausweise und die Verantwortung von Schützenmeister bzw. Standchef. Gültigkeiten bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.</p>
    </div>
  );
}
