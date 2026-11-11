import Link from "next/link";
import { getAuth } from "@/lib/server/auth";
import { logoutAction } from "@/server/actions/auth";
import { NAV_GROUPS, getAllowedMenuHrefs } from "@/components/app/nav";

export default async function ForbiddenPage() {
  const user = await getAuth();
  const allowed = user ? new Set(getAllowedMenuHrefs(user.permissions)) : new Set<string>();
  const links = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.href !== "/dashboard" && allowed.has(i.href));
  return <main className="mx-auto max-w-lg px-6 py-20">
    <h1 className="text-2xl font-bold">Akses tidak tersedia</h1>
    <p className="mt-3 text-sm text-muted-foreground">Akun Anda belum memiliki izin untuk halaman ini. Hubungi pengurus untuk mengatur hak akses dan cabang.</p>
    <nav aria-label="Halaman yang tersedia" className="mt-6 flex flex-wrap gap-3">{links.map((item) => <Link className="rounded-lg border px-3 py-2 text-sm" key={item.href} href={item.href}>{item.label}</Link>)}</nav>
    {user ? <form className="mt-6" action={logoutAction}><button className="rounded-lg bg-primary px-4 py-2 text-white">Keluar</button></form> : <Link href="/login">Masuk</Link>}
  </main>;
}
