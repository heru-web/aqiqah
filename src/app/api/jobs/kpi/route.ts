import { NextResponse } from "next/server";
import { runKpiActuals } from "@/server/services/kpi-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Job otomasi KPI — dipanggil crontab:
 *   59 23 * * *  curl -fsS -X POST -H "X-Job-Secret: $KPI_JOB_SECRET" http://127.0.0.1:3100/api/jobs/kpi
 *
 * Menghitung ulang aktual AUTO untuk semua indikator berformula yang punya
 * target pada periode berjalan. Idempoten — aman dipanggil berkali-kali.
 * Aktual MANUAL/IMPORT tidak pernah ditimpa.
 */
async function handle(req: Request) {
  const secret = process.env.KPI_JOB_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "KPI_JOB_SECRET belum di-set" }, { status: 503 });
  }
  const given = req.headers.get("x-job-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (given !== secret) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const asOf = new URL(req.url).searchParams.get("asOf") ?? undefined;
    const result = await runKpiActuals(asOf ? { asOf } : undefined);
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: err instanceof Error ? err.message : "INTERNAL" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
