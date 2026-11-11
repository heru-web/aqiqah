import { describe, expect, it } from "vitest";
import { CRM_STAGE_COLORS, STAGE_TYPE_LABELS } from "@/lib/crm/crm";

describe("CRM — stage labels (istilah awam)", () => {
  it("menghasilkan label tahap yang dipakai di pipeline & dialog", () => {
    expect(STAGE_TYPE_LABELS.OPEN).toBe("Berjalan");
    expect(STAGE_TYPE_LABELS.WON).toBe("Jadi pesanan");
    expect(STAGE_TYPE_LABELS.LOST).toBe("Batal");
  });

  it("warna stage konsisten dengan palette", () => {
    expect(CRM_STAGE_COLORS).toHaveLength(8);
    expect(CRM_STAGE_COLORS).toContain("emerald");
    expect(CRM_STAGE_COLORS).toContain("rose");
  });
});
