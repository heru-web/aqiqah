import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { sendInboxMedia } from "@/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requirePermission("crm.pipeline.action");
  } catch {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_FORM" }, { status: 400 });
  }

  const to = String(form.get("to") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const file = form.get("file");
  if (!to) return NextResponse.json({ ok: false, error: "NOMOR_TUJUAN_KOSONG" }, { status: 400 });
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ ok: false, error: "FILE_KOSONG" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "MAKSIMAL_10MB" }, { status: 400 });
  }

  try {
    const result = await sendInboxMedia({
      to,
      buffer: Buffer.from(await file.arrayBuffer()),
      mimetype: file.type || "application/octet-stream",
      fileName: file.name || "lampiran",
      caption,
    });
    revalidatePath("/whatsapp");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = AppError.is(error) ? error.message : "Gagal mengirim lampiran.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
