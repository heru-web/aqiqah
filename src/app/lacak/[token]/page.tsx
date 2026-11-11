import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckIcon, CircleIcon, MapPinIcon, TruckIcon } from "lucide-react";
import { getDeliveryTracking } from "@/server/services/erp";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lacak Pesanan",
  robots: { index: false, follow: false },
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  WAITING: { label: "Dijadwalkan", tone: "text-muted-foreground" },
  IN_TRANSIT: { label: "Dalam perjalanan", tone: "text-primary" },
  ARRIVED: { label: "Tiba di tujuan", tone: "text-success" },
  GAGAL: { label: "Pengantaran gagal", tone: "text-danger-soft-foreground" },
};

const STEPS = [
  { key: "WAITING", title: "Pesanan dijadwalkan", description: "Pesanan sudah masuk jadwal pengiriman." },
  { key: "IN_TRANSIT", title: "Dalam perjalanan", description: "Kurir sedang menuju lokasi tujuan." },
  { key: "ARRIVED", title: "Tiba di tujuan", description: "Pesanan sudah diterima di lokasi." },
];

function stepIndex(status: string): number {
  if (status === "IN_TRANSIT") return 1;
  if (status === "ARRIVED") return 2;
  return 0;
}

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getDeliveryTracking(token);
  if (!data) notFound();

  const meta = STATUS_META[data.status] ?? STATUS_META.WAITING;
  const current = stepIndex(data.status);
  const failed = data.status === "GAGAL";
  const checklist = data.podChecklist
    ? data.podChecklist.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <main className="mx-auto min-h-svh w-full max-w-xl px-4 py-8">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Madani Aqiqah</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">Lacak Pesanan</h1>
        {data.orderNumber && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{data.orderNumber}</p>
        )}
      </header>

      <section className={`rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/10 ${failed ? "border border-danger/25" : ""}`}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <TruckIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className={`font-display text-lg font-bold ${meta.tone}`}>{meta.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {failed
                ? "Pengantaran belum berhasil. Tim kami akan menghubungi Anda untuk penjadwalan ulang."
                : current === 2
                  ? "Terima kasih. Pesanan telah sampai di tujuan."
                  : data.scheduledAt
                    ? `Dijadwalkan ${formatDateTime(data.scheduledAt)}${data.deliveryTimeSlot ? ` · ${data.deliveryTimeSlot}` : ""}`
                    : "Jadwal pengiriman belum ditentukan."}
            </p>
          </div>
        </div>

        {!failed && (
          <ol className="mt-5 space-y-4">
            {STEPS.map((step, index) => {
              const done = index <= current;
              return (
                <li key={step.key} className="flex gap-3">
                  <span className={`mt-0.5 ${done ? "text-primary" : "text-muted-foreground/50"}`}>
                    {done ? <CheckIcon className="size-4" /> : <CircleIcon className="size-4" />}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail Pengiriman</h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Penerima</dt>
            <dd className="text-right font-medium text-foreground">{data.contactName ?? data.podRecipientName ?? "—"}</dd>
          </div>
          {data.childName && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nama anak</dt>
              <dd className="text-right font-medium text-foreground">{data.childName}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Kurir</dt>
            <dd className="text-right font-medium text-foreground">
              {data.driverName ?? "—"}
              {data.vehiclePlate ? <span className="ml-1 font-mono text-xs text-muted-foreground">{data.vehiclePlate}</span> : null}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Tiba</dt>
            <dd className="text-right font-medium text-foreground">
              {data.deliveredAt ? formatDateTime(data.deliveredAt) : "—"}
            </dd>
          </div>
          {typeof data.podTempC === "number" && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Suhu saat terima</dt>
              <dd className="text-right font-medium text-foreground">{data.podTempC}°C</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-sm">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 break-words text-muted-foreground">{data.destination}</span>
        </div>

        {checklist.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {checklist.map((item) => (
              <li key={item} className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success-soft-foreground">
                {item}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Halaman ini hanya dapat dibuka lewat tautan yang dibagikan tim Madani Aqiqah.
      </p>
    </main>
  );
}
