import { handleEmbed } from "@/modules/embed/handler";

export const dynamic = "force-dynamic";

/** Öffentliches Widget «ranking» für die Vereinswebsite (ohne Anmeldung, geheimer Embed-Token). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handleEmbed(req, (await params).token, "ranking");
}
