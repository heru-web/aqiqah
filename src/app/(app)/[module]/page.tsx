import Link from "next/link";
import { requirePageUser } from "@/lib/server/page-auth";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ConstructionIcon } from "lucide-react";
import { PLACEHOLDER_MODULES } from "@/components/app/nav";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  await requirePageUser();
  const { module } = await params;
  const meta = PLACEHOLDER_MODULES[module];
  if (!meta) notFound();

  return (
    <div>
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Kembali ke Dasbor
            </Button>
          </Link>
        }
      />

      <Card className="border-gold/30 bg-gold-soft/20">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="flex items-center gap-2">
            <Badge variant="gold">BELUM TERSEDIA</Badge>
            <Badge variant="neutral">Fase berikutnya</Badge>
          </div>
          <p className="text-sm text-foreground/80">
            Modul <span className="font-semibold">{meta.title}</span> belum dibangun pada fase ini —
            hanya fondasi &amp; inti penjualan (Fase 1–2) yang aktif.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2 text-muted-foreground">
            <ConstructionIcon className="h-5 w-5" />
            <p className="font-headline-sm text-foreground">Rencana implementasi</p>
          </div>
          <ul className="space-y-3">
            {meta.steps.map((step) => (
              <li key={step} className="flex gap-3 text-sm text-foreground/85">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary-fixed-dim/40 text-center text-[11px] font-bold leading-5 text-primary-strong">
                  ✓
                </span>
                {step}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}