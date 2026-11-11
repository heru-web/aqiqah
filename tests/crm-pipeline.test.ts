import { describe, expect, it } from "vitest";
import {
  LEAD_STAGES,
  allowedLeadTransitions,
  canTransitionLead,
  isLeadClosed,
  leadDueState,
  leadProgressPercent,
  leadStageIndex,
  nextLeadStage,
} from "@/lib/crm/pipeline";

describe("Pipeline CRM — state machine", () => {
  it("tahap linear berurutan dan berakhir di CLOSED", () => {
    expect(LEAD_STAGES).toEqual(["LEAD", "CONTACTED", "INTERESTED", "QUOTATION", "DP", "CLOSED"]);
    expect(nextLeadStage("LEAD")).toBe("CONTACTED");
    expect(nextLeadStage("DP")).toBe("CLOSED");
    expect(nextLeadStage("CLOSED")).toBeNull();
  });

  it("hanya mengizinkan transisi yang terdaftar", () => {
    expect(canTransitionLead("LEAD", "CONTACTED")).toBe(true);
    expect(canTransitionLead("LEAD", "CLOSED")).toBe(true);
    expect(canTransitionLead("DP", "QUOTATION")).toBe(true);
    expect(canTransitionLead("CLOSED", "LEAD")).toBe(false);
    expect(canTransitionLead("INTERESTED", "LEAD")).toBe(false);
    expect(canTransitionLead("LEAD", "LEAD")).toBe(false);
  });

  it("tidak ada transisi keluar dari CLOSED", () => {
    expect(allowedLeadTransitions("CLOSED")).toEqual([]);
    expect(isLeadClosed("CLOSED")).toBe(true);
    expect(isLeadClosed("DP")).toBe(false);
  });

  it("indeks dan progres tahap konsisten", () => {
    expect(leadStageIndex("LEAD")).toBe(0);
    expect(leadStageIndex("DP")).toBe(4);
    expect(leadProgressPercent("LEAD")).toBe(0);
    expect(leadProgressPercent("CLOSED")).toBe(100);
    expect(leadProgressPercent("INTERESTED")).toBe(40);
  });
});

describe("Pipeline CRM — status jatuh tempo follow-up", () => {
  const now = new Date(2026, 9, 22, 12, 0, 0);

  it("membedakan terlambat, hari ini, minggu ini, dan nanti", () => {
    expect(leadDueState(new Date(2026, 9, 22, 9, 0, 0), now)).toBe("OVERDUE");
    expect(leadDueState(new Date(2026, 9, 22, 18, 0, 0), now)).toBe("TODAY");
    expect(leadDueState(new Date(2026, 9, 25, 10, 0, 0), now)).toBe("SOON");
    expect(leadDueState(new Date(2026, 10, 2, 10, 0, 0), now)).toBe("LATER");
  });

  it("null / tanggal tidak valid dianggap tanpa jadwal", () => {
    expect(leadDueState(null, now)).toBe("NONE");
    expect(leadDueState("bukan-tanggal", now)).toBe("NONE");
  });
});
