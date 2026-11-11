import { describe, expect, it } from "vitest";
import { customerCreateSchema, customerUpdateSchema } from "@/server/schemas";

describe("Validasi data customer (createCustomer)", () => {
  it("menerima input minimal yang valid", () => {
    const parsed = customerCreateSchema.parse({ name: "Keluarga Ahmad", type: "PERORANGAN" });
    expect(parsed.name).toBe("Keluarga Ahmad");
    expect(parsed.type).toBe("PERORANGAN");
  });

  it("menerima nama usaha / organisasi dengan default type", () => {
    const parsed = customerCreateSchema.parse({ name: "Masjid Al Madani", type: "PERUSAHAAN" });
    expect(parsed.type).toBe("PERUSAHAAN");
  });

  it("menolak nama yang tidak lengkap (min 2 karakter)", () => {
    const result = customerCreateSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("membatasi panjang field teks", () => {
    expect(customerCreateSchema.safeParse({ name: "x".repeat(201) }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: "Keluarga Ahmad", address: "x".repeat(1001) }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: "Keluarga Ahmad", consent: "x".repeat(601) }).success).toBe(false);
  });

  it("membatasi nomor telepon / WA ke 32 karakter", () => {
    expect(customerCreateSchema.safeParse({ name: "Keluarga Ahmad", phone: "x".repeat(33) }).success).toBe(false);
  });

  it("email tidak valid ditolak, string kosong dianggap null", () => {
    expect(customerCreateSchema.safeParse({ name: "Keluarga Ahmad", email: "bukan-email" }).success).toBe(false);
    const parsed = customerCreateSchema.parse({ name: "Keluarga Ahmad", email: "" });
    expect(parsed.email).toBe("");
  });
});

describe("Validasi data customer (updateCustomer)", () => {
  it("partial update membenarkan field opsional", () => {
    const parsed = customerUpdateSchema.safeParse({ notes: "Catatan baru" });
    expect(parsed.success).toBe(true);
  });
});
