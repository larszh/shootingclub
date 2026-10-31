/** A4-Blatt für Druckansichten (Munitionskontrolle, Vereinswaffen); immer hell, unabhängig vom Farbschema. */
export function PrintSheet({ tenantName, title, subtitle, children, footer }: { tenantName: string; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col bg-white text-neutral-900 shadow-lg print:shadow-none break-after-page" style={{ width: "210mm", minHeight: "297mm" }}>
      <div className="flex-1" style={{ padding: "16mm 16mm 10mm" }}>
        <div className="border-b border-neutral-300 pb-3">
          <div className="text-xs uppercase tracking-wider text-neutral-500">{tenantName}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <div className="mt-0.5 text-sm text-neutral-600">{subtitle}</div> : null}
        </div>
        <div className="mt-4 text-[10pt] leading-snug">{children}</div>
      </div>
      {footer ? <div className="border-t border-neutral-200 text-[8pt] text-neutral-500" style={{ padding: "4mm 16mm 8mm" }}>{footer}</div> : null}
    </div>
  );
}

export function PrintTable({ head, rows, foot, align }: { head: React.ReactNode[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; align?: ("left" | "right")[] }) {
  const cls = (j: number) => (align?.[j] === "right" ? "text-right tabular-nums" : "");
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-neutral-400">
          {head.map((h, i) => <th key={i} className={`px-1.5 py-1 text-[8pt] font-semibold uppercase tracking-wide text-neutral-600 ${cls(i)}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-neutral-200 align-top [break-inside:avoid]">
            {r.map((c, j) => <td key={j} className={`px-1.5 py-1 ${cls(j)}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
      {foot ? (
        <tfoot>
          <tr className="border-t-2 border-neutral-400 font-semibold">
            {foot.map((c, j) => <td key={j} className={`px-1.5 py-1 ${cls(j)}`}>{c}</td>)}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

export function SignatureLines({ labels }: { labels: string[] }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 text-[9pt] text-neutral-600">
      {labels.map((l) => (
        <div key={l}><div className="h-10 border-b border-neutral-400" /><div className="mt-1">{l}</div></div>
      ))}
    </div>
  );
}

export function printedAt() {
  return new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
