import { PageHeader } from "@/components/app/page-header";
import { OrderWizard, type CatalogCustomer, type CatalogPackage, type CatalogProduct } from "@/components/orders/order-wizard";
import { listCustomers } from "@/server/services/customers";
import { listProducts, listPackages } from "@/server/services/products";
import { requirePagePermission } from "@/lib/server/page-auth";

export default async function NewOrderPage() {
  const user = await requirePagePermission("orders.orders.create");
  const [{ rows: customers }, products, packages] = await Promise.all([
    listCustomers({ branchId: user.branchId ?? undefined, pageSize: 500 }),
    listProducts({ activeOnly: true }),
    listPackages(),
  ]);

  const catalogCustomers: CatalogCustomer[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
  }));
  const catalogProducts: CatalogProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    salePrice: p.salePrice.toString(),
  }));
  const catalogPackages: CatalogPackage[] = packages.map((p) => ({
    id: p.id,
    name: p.name,
    discountBps: p.discountBps,
  }));

  return (
    <div>
      <PageHeader
        title="Pesanan Baru"
        description="Alur 5 langkah: pelanggan, detail aqiqah, hewan & paket, pengiriman, ringkasan."
        actions={null}
      />
      <OrderWizard
        customers={catalogCustomers}
        products={catalogProducts}
        packages={catalogPackages}
        currentUserId={user.id}
      />
    </div>
  );
}