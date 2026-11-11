import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTasks, users } from "@/db/schema";
import { can } from "@/lib/permissions";
import { assertBranchAccess } from "@/lib/branch-access";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { getAuth } from "@/lib/server/auth";
import { getStorage } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(_req: Request, ctx: { params: Promise<{ key?: string[] }> }) {
  const user = await getAuth();
  if (!user) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });

  const parts = (await ctx.params).key ?? [];
  if (parts.length === 0) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const key = parts.join("/");

  try {
    if (key.startsWith("pod/")) {
      if (!can(user.permissions, "delivery.deliveries.view")) throw new Error("FORBIDDEN");
      const [task] = await db.select({ branchId: deliveryTasks.branchId }).from(deliveryTasks)
        .where(or(eq(deliveryTasks.podPhotoUrl, key), eq(deliveryTasks.podSignatureUrl, key))).limit(1);
      if (!task) throw new Error("NOT_FOUND");
      assertBranchAccess(user, task.branchId);
    } else if (key.startsWith("avatar/")) {
      const [owner] = await db.select({ id: users.id, branchId: users.branchId }).from(users).where(eq(users.avatarUrl, key)).limit(1);
      if (!owner || (owner.id !== user.id && !can(user.permissions, "users.users.view"))) throw new Error("FORBIDDEN");
      if (owner.id !== user.id) assertBranchAccess(user, owner.branchId);
    } else {
      throw new Error("FORBIDDEN");
    }
  } catch {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const driverKind = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driverKind !== "local") {
    const driver = getStorage();
    const url = await driver.getSignedUrl(key);
    return NextResponse.redirect(url);
  }

  const base = resolve(process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), ".data", "storage"));
  const target = resolve(join(base, key));
  if (!target.startsWith(base + "/")) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  try {
    const buf = await readFile(target);
    const mime = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }
}
