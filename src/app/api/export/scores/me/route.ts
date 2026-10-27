import { scoreExportRows } from "@/modules/scores/insights";
import { slugify } from "@/lib/utils";
import { todayZurich } from "@/lib/time";
import { buildScoresCsv, csvResponse, exportContext } from "../csv";

export const dynamic = "force-dynamic";

/** Eigene Resultate im aktiven Verein als CSV (Semikolon, UTF-8 mit BOM für Excel). */
export async function GET() {
  const res = await exportContext();
  if ("error" in res) return res.error;
  const { ctx } = res;
  const rows = await scoreExportRows({ tenantId: ctx.tenant.id, userId: ctx.user.id });
  return csvResponse(buildScoresCsv(rows), `resultate-${slugify(ctx.user.name) || "ich"}-${todayZurich()}.csv`);
}
