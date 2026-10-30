/** A4-Blatt für Druckansichten des Standbetriebs (immer hell, unabhängig vom Farbschema). */
export function PrintSheet({ tenantName, title, subtitle, children, footer }: { tenantName: string; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col bg-white text-neutral-900 shadow-lg print:shadow-none break-after-page" style={{ width: "210mm", minHeight: "297mm" }}>
      <div className="flex-1" style={{ padding: "16mm 16mm 10mm" }}>
        <div className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-500">{tenantName}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <div className="mt-0.5 text-sm text-neutral-600">{subtitle}</div> : null}
          </div>
        </div>
        <div className="mt-4 text-[10pt] leading-snug">{children}</div>
      </div>
      {footer ? <div className="border-t border-neutral-200 text-[8pt] text-neutral-500" style={{ padding: "4mm 16mm 8mm" }}>{footer}</div> : null}
    </div>
  );
}

export function PrintTable({ head, rows, className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; className?: string }) {
  return (
    <table className={`w-full border-collapse text-left ${className ?? ""}`}>
      <thead>
        <tr className="border-b border-neutral-400">
          {head.map((h, i) => <th key={i} className="px-1.5 py-1 text-[8.5pt] font-semibold uppercase tracking-wide text-neutral-600">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-neutral-200 align-top [break-inside:avoid]">
            {r.map((c, j) => <td key={j} className="px-1.5 py-1">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SignatureLine({ label }: { label: string }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-10 text-[9pt] text-neutral-600">
      <div><div className="h-10 border-b border-neutral-400" /><div className="mt-1">Ort, Datum</div></div>
      <div><div className="h-10 border-b border-neutral-400" /><div className="mt-1">{label}</div></div>
    </div>
  );
}
