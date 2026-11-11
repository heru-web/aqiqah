/**
 * CLI data demo — eksekusi via: npx tsx --env-file=.env src/db/seed/demo-modules.ts
 * Hapus semua demo: DEMO_ERP_CLEAR=1 (nilai apa pun) → clear.
 */
import { seedDemoData, clearDemoData } from "@/server/services/demo";

function run(): Promise<{ ok?: boolean; error?: string; message: string }> {
  if (process.env.DEMO_ERP_CLEAR) return clearDemoData();
  return seedDemoData();
}

run()
  .then((r) => {
    console.log(r.message ?? "selesai");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
