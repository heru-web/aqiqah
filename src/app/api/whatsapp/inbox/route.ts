import { can } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getAuth } from "@/lib/server/auth";
import {
  getInboxSummary,
  listInboxChats,
  listInboxMessages,
  markInboxRead,
} from "@/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const message = AppError.is(error) ? error.message : "Gagal memuat inbox WhatsApp.";
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function GET(req: Request) {
  const user = await getAuth();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.branchId && !user.permissions.includes("*")) return NextResponse.json({ ok: false, reason: "BRANCH_REQUIRED" }, { status: 403 });
  if (!can(user.permissions, "crm.followups.view")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const jid = url.searchParams.get("jid");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const before = Number(url.searchParams.get("before") ?? 0);

  try {
    if (jid) {
      const data = await listInboxMessages(jid, { limit, before: before || undefined });
      return NextResponse.json({ ok: true, ...data });
    }

    const search = url.searchParams.get("search") ?? "";
    const filter = url.searchParams.get("filter") === "unread" ? "unread" : "all";
    const [chats, summary] = await Promise.all([
      listInboxChats({ limit, search, filter }),
      getInboxSummary().catch(() => null),
    ]);
    return NextResponse.json({ ok: true, chats, summary });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: Request) {
  const user = await getAuth();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!can(user.permissions, "crm.followups.update")) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });

  let payload: { action?: string; jid?: string };
  try {
    payload = (await req.json()) as { action?: string; jid?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (payload.action !== "read" || !payload.jid) {
    return NextResponse.json({ ok: false, error: "ACTION_NOT_SUPPORTED" }, { status: 400 });
  }

  try {
    await markInboxRead(payload.jid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
