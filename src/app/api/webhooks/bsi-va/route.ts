import { NextResponse } from "next/server";
import { handleBsiVaCallback } from "@/server/services/bsi-webhook";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSignature(headers: Headers): string {
  return headers.get("x-bsi-signature") ?? headers.get("x-signature") ?? "";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = getSignature(req.headers);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const result = await handleBsiVaCallback(payload as never, signature, rawBody);
    return NextResponse.json(result, { status: result.ok ? 200 : 202 });
  } catch (err) {
    if (AppError.is(err)) {
      const status = err.code === "WEBHOOK_INVALID_SIGNATURE" ? 401 : 400;
      return NextResponse.json({ ok: false, reason: err.message }, { status });
    }
    return NextResponse.json({ ok: false, reason: "INTERNAL" }, { status: 500 });
  }
}