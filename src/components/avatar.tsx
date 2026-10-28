import { cn, initials } from "@/lib/utils";

/**
 * Rundes Profilbild mit Initialen-Fallback. `src` ist eine öffentliche URL
 * (z.B. /api/avatars/user/<id>?v=<updatedAt>) oder null.
 */
export function Avatar({ name, src, size = 36, className, tone = "ink" }: { name: string; src?: string | null; size?: number; className?: string; tone?: "ink" | "soft" | "guest" }) {
  const toneClass = tone === "ink" ? "bg-ink text-bg" : tone === "guest" ? "bg-warn/20 text-warn" : "bg-surface-2 text-ink-2";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none", toneClass, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** URL-Helfer, damit alle Workstreams dieselben Pfade nutzen. */
export function userAvatarUrl(user: { id: string; avatarPath?: string | null; updatedAt?: Date | string | null }) {
  if (!user.avatarPath) return null;
  const v = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
  return `/api/avatars/user/${user.id}?v=${v}`;
}

export function tenantLogoUrl(tenant: { id: string; logoPath?: string | null; updatedAt?: Date | string | null }) {
  if (!tenant.logoPath) return null;
  const v = tenant.updatedAt ? new Date(tenant.updatedAt).getTime() : 0;
  return `/api/avatars/tenant/${tenant.id}?v=${v}`;
}
