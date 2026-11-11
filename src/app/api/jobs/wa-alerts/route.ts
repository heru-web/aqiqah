import { NextResponse } from "next/server";
import { runDueRules } from "@/server/services/wa-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Job alarm WA — dipanggil crontab per menit:
 *   * * * * *  curl -fsS -H "Authorization: Bearer $WA_ALARM_SECRET" http://127.0.0.1:3100/api/jobs/wa-alerts
 * Atau dipanggil manual untuk uji: GET dengan header Authorization.
 */
async function handle(req: Request) {
  const secret = process.env.WA_ALARM_SECRET ?? process.env.KPI_JOB_SECRET;
  if (!secret || !secret.trim()) {
    return NextResponse.json({ ok: false, reason: "WA_ALARM_SECRET belum di-set" }, { status: 503 });
  }
  const given = ((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || new URL(req.url).searchParams.get("secret")) ?? "";
  if (given !== secret) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }
  const results = await runDueRules(new Date());
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}

export const GET = handle;
export const POST = handle;
