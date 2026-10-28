import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { readStoredFile } from "@/lib/storage";
import { mimeFromPath } from "@/lib/image-upload";

/**
 * Liefert ein gespeichertes Bild mit privatem Caching und ETag aus.
 * URLs tragen ?v=<updatedAt>, deshalb darf der Browser einen Tag lang cachen.
 */
export async function serveStoredImage(req: Request, rel: string | null | undefined) {
  if (!rel) return new NextResponse("Not found", { status: 404 });
  const etag = `"${createHash("sha1").update(rel).digest("hex").slice(0, 20)}"`;
  const headers = {
    "Cache-Control": "private, max-age=86400",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  const inm = req.headers.get("if-none-match");
  if (inm && inm.split(",").some((t) => t.trim() === etag || t.trim() === `W/${etag}`)) {
    return new NextResponse(null, { status: 304, headers });
  }
  try {
    const data = await readStoredFile(rel);
    return new NextResponse(new Uint8Array(data), {
      headers: { ...headers, "Content-Type": mimeFromPath(rel), "Content-Length": String(data.length), "Content-Disposition": "inline" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
