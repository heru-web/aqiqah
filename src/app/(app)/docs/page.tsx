import { PageHeader } from "@/components/app/page-header";
import { listDocs } from "@/lib/md-docs";
import { DocsCardsFilter } from "@/components/app/docs-tutorial";
import { requirePageUser } from "@/lib/server/page-auth";

export default async function DocsIndexPage() {
  await requirePageUser();
  const docs = listDocs();

  return (
    <div>
      <PageHeader
        title="Dokumentasi"
        description="Panduan aplikasi: cara pakai sehari-hari, rujukan teknis, dan operasional server. Sumber yang sama dengan folder docs/ di kode."
      />

      <DocsCardsFilter docs={docs} />
    </div>
  );
}
