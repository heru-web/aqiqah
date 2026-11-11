import Link from "next/link";
import { MessageCircleIcon, Settings2Icon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/server/page-auth";
import { can } from "@/lib/permissions";
import { buildWhatsappTemplates, getInboxSummary, listInboxChats } from "@/server/services/whatsapp";
import { WhatsappInbox } from "./whatsapp-inbox";
import type { InboxChat, InboxSummary } from "@/server/services/whatsapp";
import type { WhatsappTemplate } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function WhatsappPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("crm.followups.view");
  const params = await searchParams;
  const initialJid = pick(params.jid).slice(0, 120);

  let chats: InboxChat[] = [];
  let summary: InboxSummary | null = null;
  let templates: WhatsappTemplate[] = [];
  let error: string | null = null;

  try {
    [chats, summary, templates] = await Promise.all([
      listInboxChats({ limit: 100 }),
      getInboxSummary(),
      buildWhatsappTemplates({}),
    ]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Gateway WhatsApp belum siap.";
  }

  const canSend = can(user.permissions, "crm.pipeline.action");

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Center"
        description="Inbox percakapan, kirim pesan teks, dan lampiran langsung dari dashboard."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/whatsapp">
                <Settings2Icon className="h-4 w-4" /> Pengaturan
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/broadcast">
                <MessageCircleIcon className="h-4 w-4" /> Broadcast
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <p className="font-medium">Inbox tidak dapat dimuat</p>
          <p className="mt-1 text-destructive/80">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Pastikan gateway WhatsApp berjalan dan provider di Pengaturan WhatsApp diatur ke WAHA/gateway lokal.
          </p>
        </div>
      ) : (
        <WhatsappInbox
          initialChats={chats}
          initialSummary={summary}
          initialJid={initialJid}
          templates={templates}
          canSend={canSend}
        />
      )}
    </div>
  );
}
