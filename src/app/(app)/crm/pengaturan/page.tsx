import Link from "next/link";
import { ArrowLeftIcon, GripVerticalIcon, PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteStageButton } from "@/components/crm/v2/delete-stage-button";
import { StageDialog } from "@/components/crm/v2/stage-dialog";
import { STAGE_TYPE_LABELS, stageColorClasses } from "@/lib/crm/crm";
import { requirePagePermission } from "@/lib/server/page-auth";
import { ensureDefaultPipeline, listCrmDeals } from "@/server/services/crm";

export default async function CrmSettingsPage() {
  const user = await requirePagePermission("crm.pipeline.view");
  const branchId = user.branchId ?? undefined;
  const { pipelineId, stages } = await ensureDefaultPipeline(branchId);
  const deals = await listCrmDeals({ branchId, status: "ALL" });

  const counts = new Map<string, number>();
  for (const deal of deals) {
    counts.set(deal.stageId, (counts.get(deal.stageId) ?? 0) + 1);
  }

  const stageData = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
    color: stage.color,
    type: stage.type,
    position: stage.position,
  }));

  return (
    <div>
      <PageHeader
        title="Pengaturan Pipeline"
        description="Atur tahap penjualan. Perubahan langsung memengaruhi papan CRM."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/crm">
                <ArrowLeftIcon className="h-4 w-4" /> Pipeline
              </Link>
            </Button>
            <StageDialog
              pipelineId={pipelineId}
              trigger={
                <Button>
                  <PlusIcon className="h-4 w-4" /> Tahap Baru
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage, index) => {
          const colors = stageColorClasses(stage.color);
          const count = counts.get(stage.id) ?? 0;
          return (
            <Card key={stage.id} className={colors.border}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      <GripVerticalIcon className="h-3.5 w-3.5" />
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-[13.5px] font-semibold ${colors.text}`}>{stage.name}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {stage.description ?? "Tanpa deskripsi."}
                      </p>
                    </div>
                  </div>
                  <span className={`mt-1 size-2.5 shrink-0 rounded-full ${colors.dot}`} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={stage.type === "WON" ? "success" : stage.type === "LOST" ? "danger" : "neutral"}>
                    {STAGE_TYPE_LABELS[stage.type]}
                  </Badge>
                  <Badge variant="outline">{count} deal</Badge>
                  <div className="ml-auto flex items-center gap-1">
                    <StageDialog
                      pipelineId={pipelineId}
                      stage={stageData[index]}
                      trigger={
                        <Button variant="ghost" size="compact" className="h-8 px-2 text-[11px]">
                          Ubah
                        </Button>
                      }
                    />
                    <DeleteStageButton id={stage.id} name={stage.name} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Deal yang masih memakai sebuah tahap tidak dapat dihapus. Pindahkan deal ke tahap lain terlebih dahulu.
        Tahap bertipe <strong>Jadi pesanan</strong> atau <strong>Batal</strong> menutup deal dan mengisi tanggal selesai.
      </p>
    </div>
  );
}
