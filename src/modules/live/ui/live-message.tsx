/** Freundliche Vollbild-Meldung für ungültige oder abgelaufene Live-Links (dunkel, ohne App-Shell). */
export function LiveMessage({ title, text, clubName, logoUrl }: { title: string; text: string; clubName?: string | null; logoUrl?: string | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#050607] px-6 text-white" style={{ colorScheme: "dark" }}>
      <div className="max-w-2xl text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mx-auto mb-8 h-24 w-auto object-contain" />
        ) : null}
        {clubName ? <div className="text-sm uppercase tracking-[0.2em] text-white/50 sm:text-base">{clubName}</div> : null}
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 text-base text-white/60 sm:text-xl">{text}</p>
      </div>
    </div>
  );
}
