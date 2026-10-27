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
      <span>Mouche</span>
    </span>
  );
}
