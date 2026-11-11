import { can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getAuth } from "@/lib/server/auth";
import { getInboxMedia } from "@/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const user = await getAuth();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.branchId && !user.permissions.includes("*")) return NextResponse.json({ ok: false, reason: "BRANCH_REQUIRED" }, { status: 403 });
  if (!can(user.permissions, "crm.followups.view")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });

  const { file } = await params;
  try {
    const media = await getInboxMedia(file);
    return new NextResponse(media.body, {
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = AppError.is(error) && error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: "MEDIA_TIDAK_DITEMUKAN" }, { status });
  }
}
