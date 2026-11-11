/**
 * Uji unit ringan services inti (tanpa DB).
 * Jalankan: npx tsx src/lib/tests/wa-test.ts
 */
import { normalizeWhatsappPhone, renderWhatsappTemplate } from "@/lib/whatsapp";
import { can } from "@/lib/permissions";

let passed = 0; let failed = 0;
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) { passed += 1; console.log("PASS", name); }
  else { failed += 1; console.error("FAIL", name, detail ?? ""); }
}

// normalizeWhatsappPhone
assert("08xx → 62", normalizeWhatsappPhone("0812-3456-7890") === "6281234567890");
assert("62x → 62", normalizeWhatsappPhone("6281234567890") === "6281234567890");
assert("nomor luar banget ok", normalizeWhatsappPhone("+62 812 3456 7890") === "6281234567890");
assert("nomor invalid → ''", normalizeWhatsappPhone("123") === "");
assert("nomor tak lengkap invalid", normalizeWhatsappPhone("0123") === "");

// renderWhatsappTemplate
assert("template replace single var", renderWhatsappTemplate("Halo {nama}.", { nama: "Rani" }) === "Halo Rani.");
assert("template multi var & sisa dihapus", renderWhatsappTemplate("{a} {b} {c}", { a: "A" }) === "A");

// can permissions
assert("admin wildcard", can(["*"], "customers.create"));
assert("module wildcard", can(["crm.*"], "crm.contacts.view"));
assert("denied without", !can(["customers.*"], "orders.create"));

console.log("");
console.log(`TOT: ${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);
