import Link from "next/link";
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrganizationDialog } from "@/components/crm/v2/organization-dialog";
import { PersonDialog } from "@/components/crm/v2/person-dialog";
import { PeopleTable, OrganizationsTable } from "@/components/crm/v2/contacts-tables";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/lib/server/page-auth";
import { listCrmOrganizations, listCrmPeople, listCrmUsers } from "@/server/services/crm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("crm.pipeline.view");
  const params = await searchParams;
  const tab = pick(params.tab) === "organizations" ? "organizations" : "people";
  const q = pick(params.q).slice(0, 100);
  const branchId = user.branchId ?? undefined;

  const [people, organizations, users] = await Promise.all([
    listCrmPeople({ branchId, search: q || undefined }),
    listCrmOrganizations({ branchId, search: q || undefined }),
    listCrmUsers(branchId),
  ]);

  const userOptions = users.map((item) => ({ id: item.id, name: item.name }));
  const organizationOptions = organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));

  const peopleRows = people.map((person) => ({
    id: person.id,
    name: person.name,
    phone: person.phone,
    whatsapp: person.whatsapp,
    email: person.email,
    city: person.city,
    organizationName: person.organizationName,
    ownerName: person.ownerName,
    dealCount: Number(person.dealCount),
    openValue: person.openValue.toString(),
  }));

  const organizationRows = organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    industry: organization.industry,
    phone: organization.phone,
    email: organization.email,
    city: organization.city,
    ownerName: organization.ownerName,
    peopleCount: Number(organization.peopleCount),
    dealCount: Number(organization.dealCount),
    openValue: organization.openValue.toString(),
  }));

  return (
    <div>
      <PageHeader
        title="Kontak"
        description={`${people.length} orang dan ${organizations.length} perusahaan terhubung dengan pipeline.`}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/crm">Pipeline</Link>
            </Button>
            {tab === "people" ? (
              <PersonDialog
                organizations={organizationOptions}
                users={userOptions}
                defaultOwnerId={user.id}
                trigger={
                  <Button>
                    <PlusIcon className="h-4 w-4" /> Kontak Baru
                  </Button>
                }
              />
            ) : (
              <OrganizationDialog
                users={userOptions}
                defaultOwnerId={user.id}
                trigger={
                  <Button>
                    <PlusIcon className="h-4 w-4" /> Perusahaan Baru
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-line/10 bg-subtle p-1 text-[12px] font-semibold">
          <Link
            href={`/crm/contacts?tab=people${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "rounded-lg px-3 py-1.5 transition",
              tab === "people" ? "bg-surface text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Orang ({people.length})
          </Link>
          <Link
            href={`/crm/contacts?tab=organizations${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "rounded-lg px-3 py-1.5 transition",
              tab === "organizations"
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Perusahaan ({organizations.length})
          </Link>
        </div>

        <form action="/crm/contacts" method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Cari nama, telepon, email…"
              className="h-9 w-full pl-8 sm:w-64"
            />
          </div>
          <Button type="submit" variant="outline" size="compact">
            Cari
          </Button>
        </form>
      </div>

      {tab === "people" ? (
        <PeopleTable rows={peopleRows} />
      ) : (
        <OrganizationsTable rows={organizationRows} />
      )}

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <UsersIcon className="h-3.5 w-3.5" />
        Klik nama untuk melihat riwayat deal, aktivitas, dan catatan.
      </div>
    </div>
  );
}
