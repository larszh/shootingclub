import "server-only";
import { db } from "@/lib/db";
import { notify, tenantUserIdsWithRole } from "@/lib/notify";
import { formatDateTime } from "@/lib/i18n/core";

// ---------------------------------------------------------------------------
// Benachrichtigungen (nie blockierend: Fehler werden in notify() abgefangen)
// ---------------------------------------------------------------------------

export type BookingNotice = "pending" | "confirmed" | "rejected" | "cancelled" | "created";

/**
 * Benachrichtigt Verwaltung (Anfrage) bzw. das buchende Mitglied (Entscheid, Stornierung).
 * Bei Buchungen von Partnervereinen (viaTenantId) gehört das Mitglied nicht zum Eigentümer-Verein:
 * die Mitteilung läuft dann über den Partnerverein, sonst würde notify() sie verwerfen.
 */
export async function notifyBooking(bookingId: string, notice: BookingNotice, actor: { id: string; name: string }) {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, tenantId: true, viaTenantId: true, userId: true, startsAt: true, resource: { select: { name: true } }, user: { select: { name: true } }, tenant: { select: { name: true } } },
  });
  if (!b) return;
  const date = formatDateTime(b.startsAt, "de");
  if (notice === "pending") {
    // Anfrage an die Verwaltung des Eigentümers: bei Partnerbuchungen den anfragenden Partnerverein
    // nennen (der eigene Vereinsname in Klammern wäre für die Verwaltung nutzlos).
    const via = b.viaTenantId ? await db.tenant.findUnique({ where: { id: b.viaTenantId }, select: { name: true } }) : null;
    const resource = b.viaTenantId ? `${b.resource.name} (Partnerverein ${via?.name ?? "gelöscht"})` : b.resource.name;
    const admins = (await tenantUserIdsWithRole(b.tenantId, ["OWNER", "ADMIN"])).filter((id) => id !== actor.id);
    const name = b.user?.name ?? actor.name;
    await notify({
      tenantId: b.tenantId,
      userIds: admins,
      topic: "bookings",
      title: "Neue Reservationsanfrage",
      body: `${name} möchte ${resource} am ${date} reservieren.`,
      url: "/admin/bookings",
      tag: `booking:${b.id}`,
      i18n: { title: "notify.booking.pending.title", body: "notify.booking.pending.body", vars: { name, resource, date }, localeVars: (locale) => ({ date: formatDateTime(b.startsAt, locale) }) },
      dedupeKey: `booking-pending:${b.id}`,
    });
    return;
  }
  if (!b.userId || b.userId === actor.id) return;
  // Mitteilung an das buchende Mitglied: bei Partnerbuchungen den Eigentümer der Anlage nennen.
  const resource = b.viaTenantId ? `${b.resource.name} (${b.tenant.name})` : b.resource.name;
  const de: Record<Exclude<BookingNotice, "pending">, [string, string]> = {
    confirmed: ["Reservation bestätigt", `Deine Reservation «${resource}» am ${date} ist bestätigt.`],
    rejected: ["Reservation abgelehnt", `Deine Reservation «${resource}» am ${date} wurde leider abgelehnt.`],
    cancelled: ["Reservation storniert", `${actor.name} hat die Reservation «${resource}» am ${date} storniert.`],
    created: ["Neue Reservation für dich", `Für dich wurde «${resource}» am ${date} reserviert.`],
  };
  await notify({
    tenantId: b.viaTenantId ?? b.tenantId,
    userIds: [b.userId],
    topic: "bookings",
    title: de[notice][0],
    body: de[notice][1],
    url: `/bookings/${b.id}`,
    tag: `booking:${b.id}`,
    i18n: { title: `notify.booking.${notice}.title`, body: `notify.booking.${notice}.body`, vars: { name: actor.name, resource, date }, localeVars: (locale) => ({ date: formatDateTime(b.startsAt, locale) }) },
    dedupeKey: `booking-${notice}:${b.id}`,
  });
}
