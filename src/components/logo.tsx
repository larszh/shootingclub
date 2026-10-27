export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="3.2" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <Logo />
      <span>Standchef</span>
    </span>
  );
}

/**
 * Vereinslogo mit Fallback auf das Standchef-Zeichen. `src` ist z.B. ctx.tenant.logoUrl.
 */
export function TenantLogo({ src, size = 28, className = "" }: { src?: string | null; size?: number; className?: string }) {
  if (!src) return <Logo size={size} className={className} />;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${className}`} style={{ width: size, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-contain" decoding="async" />
    </span>
  );
}
