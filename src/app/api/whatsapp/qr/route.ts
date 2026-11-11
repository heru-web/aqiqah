import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { getWhatsappSettings } from "@/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  try {
    await requirePermission("settings.settings.update");
  } catch {
    return htmlResponse("<h1>403 — Anda tidak memiliki izin menghubungkan WhatsApp.</h1>", 403);
  }

  const settings = await getWhatsappSettings();
  if (settings.provider !== "WAHA") {
    return htmlResponse(
      "<h1>QR hanya untuk provider WAHA.</h1><p>Provider aktif: " +
        String(settings.provider) +
        '. Ubah di Pengaturan &rarr; WhatsApp bila ingin memakai QR pairing.</p>',
      400
    );
  }
  if (!settings.gatewayUrl.trim()) {
    return htmlResponse("<h1>URL gateway WhatsApp belum dikonfigurasi.</h1>", 503);
  }

  try {
    const response = await fetch(`${settings.gatewayUrl.replace(/\/+$/, "")}/qr`, {
      headers: settings.apiToken.trim() ? { Authorization: `Bearer ${settings.apiToken.trim()}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    let html = await response.text();
    if (!html.trim()) html = "<h1>QR belum tersedia.</h1><p>Gateway belum mengeluarkan QR. Coba lagi beberapa detik.</p>";
    html = html.replace("</head>", '<meta http-equiv="refresh" content="5"></head>');
    return htmlResponse(html, response.ok ? 200 : response.status);
  } catch (error) {
    return htmlResponse(
      `<h1>Gateway WhatsApp tidak dapat dihubungi.</h1><p>${error instanceof Error ? error.message : "Kesalahan tidak diketahui."}</p>`,
      502
    );
  }
}
