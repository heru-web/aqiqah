import Link from "next/link";
import Image from "next/image";
import { requirePageUser } from "@/lib/server/page-auth";
import { TabBar } from "@/components/mobile/tab-nav";

export const dynamic = "force-dynamic";

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser();
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-slate-200 bg-white px-4 py-2.5">
        <Image
          src="/img/logo-madani.jpg"
          alt="Madani Aqiqah"
          width={40}
          height={40}
          className="rounded-xl ring-1 ring-primary/15"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold leading-tight text-primary">Madani Aqiqah Ops</p>
          <p className="text-[10.5px] text-slate-500">Mobile Ops Terminal v1</p>
        </div>
        <Link href="/dashboard" className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100">
          Panel
        </Link>
      </header>
      <main className="flex-1 px-4 pb-24 pt-3">{children}</main>
      <TabBar />
    </div>
  );
}
