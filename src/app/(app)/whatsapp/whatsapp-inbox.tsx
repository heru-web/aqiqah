"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  CheckCheckIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  ImagePlusIcon,
  InboxIcon,
  Loader2Icon,
  MessageCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WhatsappTemplate } from "@/lib/whatsapp";
import { sendInboxReplyAction } from "@/server/actions/whatsapp";
import type {
  InboxChat,
  InboxMessage,
  InboxSummary,
} from "@/server/services/whatsapp";

interface Props {
  initialChats: InboxChat[];
  initialSummary: InboxSummary | null;
  initialJid: string;
  templates: WhatsappTemplate[];
  canSend: boolean;
}

interface ChatsResponse {
  ok?: boolean;
  chats?: InboxChat[];
  summary?: InboxSummary | null;
  error?: string;
}

interface MessagesResponse {
  ok?: boolean;
  messages?: InboxMessage[];
  hasMore?: boolean;
  name?: string;
  error?: string;
}

function listTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
}

function mediaHref(url?: string | null): string | null {
  if (!url) return null;
  const match = /\/media\/([^/?#]+)/.exec(url);
  return match ? `/api/whatsapp/media/${encodeURIComponent(match[1])}` : null;
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === "read" || status === "played") return <CheckCheckIcon className="h-3.5 w-3.5 text-sky-500" />;
  if (status === "delivered") return <CheckCheckIcon className="h-3.5 w-3.5" />;
  if (status === "pending") return <ClockIcon className="h-3.5 w-3.5" />;
  if (status === "error") return <ClockIcon className="h-3.5 w-3.5 text-destructive" />;
  return <CheckIcon className="h-3.5 w-3.5" />;
}

function MediaBlock({ message }: { message: InboxMessage }) {
  const src = mediaHref(message.media?.url);
  if (!src) {
    return (
      <div className="rounded-lg border border-dashed border-current/20 px-3 py-2 text-xs opacity-70">
        Media tidak tersedia{message.media?.fileName ? `: ${message.media.fileName}` : ""}
      </div>
    );
  }
  if (message.type === "image" || message.type === "sticker") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={message.media?.fileName ?? "Gambar WhatsApp"} className="max-h-72 w-auto max-w-full rounded-lg object-contain" loading="lazy" />
    );
  }
  if (message.type === "video") {
    return <video src={src} controls className="max-h-72 w-full max-w-sm rounded-lg" />;
  }
  if (message.type === "audio") {
    return <audio src={src} controls className="w-64 max-w-full" />;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs underline-offset-2 hover:underline">
      <FileTextIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{message.media?.fileName ?? "Dokumen"}</span>
    </a>
  );
}

export function WhatsappInbox({
  initialChats,
  initialSummary,
  initialJid,
  templates,
  canSend,
}: Props) {
  const [chats, setChats] = useState<InboxChat[]>(initialChats);
  const [summary, setSummary] = useState<InboxSummary | null>(initialSummary);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedJid, setSelectedJid] = useState(initialJid);
  const [chatName, setChatName] = useState(
    initialChats.find((chat) => chat.jid === initialJid)?.name ?? ""
  );
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const [sendingMedia, setSendingMedia] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeJidRef = useRef(selectedJid);

  useEffect(() => {
    activeJidRef.current = selectedJid;
  }, [selectedJid]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.jid === selectedJid) ?? null,
    [chats, selectedJid]
  );

  const loadChats = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingChats(true);
      const params = new URLSearchParams({ limit: "100", filter });
      if (search.trim()) params.set("search", search.trim());
      try {
        const response = await fetch(`/api/whatsapp/inbox?${params.toString()}`, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as ChatsResponse | null;
        if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Gagal memuat daftar chat.");
        setChats(data.chats ?? []);
        setSummary(data.summary ?? null);
        setLiveError(null);
      } catch (error) {
        setLiveError(error instanceof Error ? error.message : "Gagal memuat daftar chat.");
      } finally {
        if (!silent) setLoadingChats(false);
      }
    },
    [filter, search]
  );

  const loadMessages = useCallback(async (jid: string, silent = false) => {
    if (!jid) return;
    if (!silent) setLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/whatsapp/inbox?jid=${encodeURIComponent(jid)}&limit=100`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as MessagesResponse | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Gagal memuat pesan.");
      if (activeJidRef.current !== jid) return;
      setMessages(data.messages ?? []);
      if (data.name) setChatName(data.name);
      setLiveError(null);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Gagal memuat pesan.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const markRead = useCallback(async (jid: string) => {
    try {
      await fetch("/api/whatsapp/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", jid }),
      });
      setChats((current) =>
        current.map((chat) => (chat.jid === jid ? { ...chat, unread: 0 } : chat))
      );
    } catch {
      // abaikan; status baca akan dicoba lagi saat chat dibuka berikutnya
    }
  }, []);

  const openChat = useCallback(
    (chat: InboxChat) => {
      activeJidRef.current = chat.jid;
      setSelectedJid(chat.jid);
      setChatName(chat.name);
      setMessages([]);
      void loadMessages(chat.jid);
      if (chat.unread > 0) void markRead(chat.jid);
    },
    [loadMessages, markRead]
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadChats(), search.trim() ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadChats, search]);

  useEffect(() => {
    if (!initialJid) return;
    const timer = setTimeout(() => {
      void loadMessages(initialJid);
      const chat = initialChats.find((item) => item.jid === initialJid);
      if (chat && chat.unread > 0) void markRead(initialJid);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadChats(true);
      if (activeJidRef.current) void loadMessages(activeJidRef.current, true);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadChats, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selectedJid]);

  const send = () => {
    const chat = selectedChat;
    const message = draft.trim();
    if (!chat || !message || sending) return;
    if (chat.isGroup) {
      toast.error("Balasan ke grup belum didukung.");
      return;
    }
    const formData = new FormData();
    formData.set("to", chat.number);
    formData.set("message", message);
    startSending(async () => {
      const result = await sendInboxReplyAction(undefined, formData);
      if (result?.success) {
        setDraft("");
        toast.success("Pesan terkirim.");
        await loadMessages(chat.jid, true);
        await loadChats(true);
      } else {
        toast.error(result?.error ?? "Gagal mengirim pesan.");
      }
    });
  };

  const sendMedia = async (file: File) => {
    const chat = selectedChat;
    if (!chat || !file) return;
    if (chat.isGroup) {
      toast.error("Lampiran ke grup belum didukung.");
      return;
    }
    setSendingMedia(true);
    try {
      const formData = new FormData();
      formData.set("to", chat.number);
      formData.set("caption", draft.trim());
      formData.set("file", file);
      const response = await fetch("/api/whatsapp/send-media", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Gagal mengirim lampiran.");
      setDraft("");
      toast.success("Lampiran terkirim.");
      await loadMessages(chat.jid, true);
      await loadChats(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim lampiran.");
    } finally {
      setSendingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line/15 bg-surface/70 backdrop-blur-xl">
      <div className="grid h-[calc(100dvh-17rem)] min-h-[420px] grid-cols-1 md:h-[calc(100dvh-11rem)] md:min-h-[540px] md:grid-cols-[minmax(260px,340px)_1fr]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-line/15 md:border-r",
            selectedJid && "hidden md:flex"
          )}
        >
          <div className="space-y-2 border-b border-line/15 p-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
                  <MessageCircleIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Inbox</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {summary?.ready ? `Terhubung${summary.me?.name ? ` · ${summary.me.name}` : ""}` : "Gateway belum siap"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Muat ulang inbox"
                disabled={loadingChats}
                onClick={() => {
                  void loadChats();
                  if (selectedJid) void loadMessages(selectedJid);
                }}
              >
                <RefreshCwIcon className={cn("h-4 w-4", loadingChats && "animate-spin")} />
              </Button>
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau nomor"
                className="pl-8"
                aria-label="Cari percakapan"
              />
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition",
                  filter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition",
                  filter === "unread" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                Belum dibaca
              </button>
              <span className="ml-auto text-[11px] text-muted-foreground">{chats.length} chat</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingChats && chats.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin" /> Memuat chat...
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                <InboxIcon className="h-7 w-7 opacity-60" />
                <p>Belum ada percakapan.</p>
                <p className="text-xs">Pesan yang masuk lewat gateway WhatsApp akan tampil di sini.</p>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.jid}
                  type="button"
                  onClick={() => openChat(chat)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b border-line/10 px-3 py-2.5 text-left transition hover:bg-muted/60",
                    chat.jid === selectedJid && "bg-primary/5"
                  )}
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    {chat.isGroup ? <UsersIcon className="h-4 w-4" /> : <MessageCircleIcon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{chat.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        {chat.lastMessageAt ? listTime(chat.lastMessageAt) : ""}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className={cn("truncate text-xs", chat.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {chat.lastDirection === "out" ? "Anda: " : ""}
                        {chat.lastMessage || "[media]"}
                      </span>
                      {chat.unread > 0 && (
                        <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          {chat.unread > 99 ? "99+" : chat.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={cn("flex min-h-0 flex-col", !selectedJid && "hidden md:flex")}>
          {!selectedChat ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <MessageCircleIcon className="h-10 w-10 opacity-40" />
              <p className="font-medium text-foreground">Pilih percakapan</p>
              <p className="max-w-sm text-xs">Klik salah satu chat di kiri untuk membaca pesan dan membalas.</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b border-line/15 px-3 py-2.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="md:hidden"
                  aria-label="Kembali ke daftar chat"
                  onClick={() => setSelectedJid("")}
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </Button>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  {selectedChat.isGroup ? <UsersIcon className="h-4 w-4" /> : <MessageCircleIcon className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{chatName || selectedChat.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedChat.isGroup ? "Grup" : `+${selectedChat.number}`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="ml-auto"
                  aria-label="Muat ulang pesan"
                  disabled={loadingMessages}
                  onClick={() => void loadMessages(selectedChat.jid)}
                >
                  <RefreshCwIcon className={cn("h-4 w-4", loadingMessages && "animate-spin")} />
                </Button>
              </header>

              {liveError && (
                <div className="border-b border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
                  {liveError}
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/20 px-3 py-3">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2Icon className="h-4 w-4 animate-spin" /> Memuat pesan...
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">
                    Belum ada pesan tersimpan untuk percakapan ini.
                  </p>
                ) : (
                  messages.map((message) => {
                    const out = message.direction === "out";
                    return (
                      <div key={message.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                            out
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-line/15 bg-surface text-foreground"
                          )}
                        >
                          {!out && message.pushName && (
                            <p className="mb-0.5 text-[11px] font-medium opacity-70">{message.pushName}</p>
                          )}
                          {message.type !== "text" && <MediaBlock message={message} />}
                          {message.text && (
                            <p className="whitespace-pre-wrap break-words">{message.text}</p>
                          )}
                          <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", out ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            <span>{new Date(message.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                            {out && <StatusIcon status={message.status} />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <footer className="border-t border-line/15 p-2.5">
                {selectedChat.isGroup ? (
                  <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                    Balasan ke grup belum didukung dari dashboard.
                  </p>
                ) : !canSend ? (
                  <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                    Anda tidak memiliki izin mengirim pesan.
                  </p>
                ) : (
                  <>
                    {templates.length > 0 && (
                      <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto">
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">Template</span>
                        {templates.map((template) => (
                          <button
                            key={template.key}
                            type="button"
                            onClick={() => setDraft(template.body)}
                            className="shrink-0 rounded-full border border-line/15 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-1.5">
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void sendMedia(file);
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Kirim lampiran"
                        disabled={sendingMedia || sending}
                        onClick={() => fileRef.current?.click()}
                      >
                        {sendingMedia ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <ImagePlusIcon className="h-4 w-4" />}
                      </Button>
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            send();
                          }
                        }}
                        rows={1}
                        placeholder="Tulis balasan... (Enter kirim, Shift+Enter baris baru)"
                        aria-label="Tulis balasan WhatsApp"
                        className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-line/20 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        type="button"
                        size="icon"
                        aria-label="Kirim pesan"
                        disabled={!draft.trim() || sending}
                        onClick={send}
                      >
                        {sending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                      Lampiran maksimal 10 MB. Pesan dikirim tanpa tanda tangan.
                    </p>
                  </>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
