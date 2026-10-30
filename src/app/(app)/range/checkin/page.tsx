import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/form";
import { requireTenant } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { requireRange } from "@/modules/range/guard";
import { getActiveRules, getMyOpenVisit, hasAcceptedRules, listOpenDays, loanMatchesVisit } from "@/modules/range/queries";
import { switchTenantForCheckInAction } from "@/modules/range/actions";
import { dbDateKey } from "@/modules/range/logic";
import { dayTitle, fmtTime } from "@/modules/range/format";
import { RulesBody } from "@/modules/range/ui/rules-body";
import { SelfCheckIn } from "@/modules/range/ui/self-checkin";
import { EmergencyBox } from "@/modules/range/ui/emergency-box";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Check-in" };

/** Selbst-Check-in per QR-Code (/range/checkin?t=<Verein>). */
export default async function RangeCheckInPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams;
  const base = await requireTenant();
  if (sp.t && sp.t !== base.tenant.id) {
    const other = base.user.memberships.find((m) => m.tenantId === sp.t);
    if (other) {
      return (
        <div>
          <PageHeader title="Check-in" />
          <Card className="space-y-3 p-5">
            <p>Dieser QR-Code gehört zu <strong>{other.tenant.name}</strong>. Gerade ist «{base.tenant.name}» geöffnet.</p>
            <form action={switchTenantForCheckInAction.bind(null, other.tenantId)}>
              <SubmitButton size="lg" className="h-14 w-full">Zu {other.tenant.name} wechseln</SubmitButton>
            </form>
          </Card>
        </div>
      );
    }
  }

  const ctx = await requireRange();
  const tenantId = ctx.tenant.id;
  const today = todayZurich();
  const [openDays, rules, mine] = await Promise.all([listOpenDays(tenantId), getActiveRules(tenantId), getMyOpenVisit(tenantId, ctx.user.id)]);
  const days = openDays.filter((d) => dbDateKey(d.date) === today).map((d) => ({ id: d.id, title: dayTitle(d), dutyName: d.dutyName }));
  const accepted = rules ? await hasAcceptedRules(rules.id, ctx.user.id) : true;
  let hasWeapon = false;
  if (mine?.clubWeaponId) {
    const loans = await db.weaponLoan.findMany({ where: { tenantId, weaponId: mine.clubWeaponId, returnedAt: null }, select: { weaponId: true, userId: true, borrowerName: true } });
    hasWeapon = loans.some((l) => loanMatchesVisit(l, mine));
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Check-in" subtitle={ctx.tenant.name} back={{ href: "/range", label: "Standbetrieb" }} />
      <SelfCheckIn
        days={days}
        myVisit={mine ? { id: mine.id, since: fmtTime(mine.checkedInAt), title: mine.rangeDay ? dayTitle(mine.rangeDay) : "Stand", hasWeapon } : null}
        rules={rules ? { id: rules.id, version: rules.version, title: rules.title } : null}
        rulesAccepted={accepted}
      >
        {rules && !accepted ? <RulesBody body={rules.body} /> : null}
      </SelfCheckIn>
      <EmergencyBox hasRules={!!rules} />
    </div>
  );
}
