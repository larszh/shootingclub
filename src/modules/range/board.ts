import "server-only";
import { todayZurich } from "@/lib/time";
import { userAvatarUrl } from "@/components/avatar";
import type { BoardVisit } from "./ui/day-board";
import { ageOn, dbDateKey, minorStatusFromBirthYear } from "./logic";
import { fmtTime } from "./format";
import { loanMatchesVisit, type getDayBoard } from "./queries";

type Board = NonNullable<Awaited<ReturnType<typeof getDayBoard>>>;

/** Besuche eines Standbuchs für die Anzeige aufbereiten (Namen, Badges, Waffen). */
export function toBoardVisits(board: Board, activeRulesId: string | null, acceptedUserIds: Set<string>): BoardVisit[] {
  const today = todayZurich();
  const year = Number(today.slice(0, 4));
  const weapons = new Map(board.weapons.map((w) => [w.id, w]));
  const hosts = new Map(board.hosts.map((h) => [h.id, h.name]));
  return board.day.visits.map((v) => {
    const w = v.clubWeaponId ? weapons.get(v.clubWeaponId) : undefined;
    let minor: BoardVisit["minor"] = null;
    if (v.user?.birthDate) minor = ageOn(dbDateKey(v.user.birthDate), today) < 18 ? "minor" : null;
    else if (!v.userId && v.guestBirthYear) {
      const s = minorStatusFromBirthYear(v.guestBirthYear, year);
      minor = s === "adult" ? null : s;
    }
    const rulesOk = !activeRulesId || v.rulesId === activeRulesId || (!!v.userId && acceptedUserIds.has(v.userId));
    return {
      id: v.id,
      userId: v.userId,
      name: v.user?.name ?? v.guestName ?? "Unbekannt",
      avatarUrl: v.user ? userAvatarUrl(v.user) : null,
      isGuest: !v.userId,
      hostName: v.hostUserId ? (hosts.get(v.hostUserId) ?? null) : null,
      guestIdChecked: v.guestIdChecked,
      lane: v.lane,
      discipline: v.discipline,
      note: v.note,
      inLabel: fmtTime(v.checkedInAt),
      outLabel: v.checkedOutAt ? fmtTime(v.checkedOutAt) : null,
      weapon: v.clubWeaponId ? { id: v.clubWeaponId, name: w?.name ?? "Vereinswaffe", open: board.openLoans.some((l) => loanMatchesVisit(l, v)) } : null,
      rulesOk,
      minor,
    };
  });
}
