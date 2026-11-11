import { describe, expect, it } from "vitest";
import { haversineKm, optimizeStops, type RoutePoint } from "@/lib/route-optimizer";

// Depok (Depok) → Monas (Jakarta) sekitar 20 km
const pPoint = (id: string, lat: number | null, lng: number | null): RoutePoint => ({ id, lat, lng });

describe("route optimizer", () => {
  it("haversine menghasilkan jarak nyata", () => {
    expect(haversineKm(-6.4, 106.8, -6.2, 106.8)).toBeGreaterThan(15);
    expect(haversineKm(-6.175, 106.827, -6.175, 106.827)).toBeCloseTo(0);
  });

  it("titik tanpa koordinat memakai urutan asli lagi", () => {
    const plan = optimizeStops([pPoint("a", null, null), pPoint("b", null, null)]);
    expect(plan.order).toEqual(["a", "b"]);
    expect(plan.mapped).toBe(0);
    expect(plan.totalKm).toBe(0);
  });

  it("nearest-neighbor memilih titik terdekat berikutnya", () => {
    const plan = optimizeStops(
      [
        pPoint("far", -6.6, 106.9),
        pPoint("near", -6.21, 106.82),
        pPoint("mid", -6.4, 106.85),
      ],
      { lat: -6.2, lng: 106.8 }
    );
    expect(plan.order[0]).toBe("near");
    expect(plan.order[1]).not.toBe("far");
    expect(plan.mapped).toBe(3);
    expect(plan.totalKm).toBeGreaterThan(0);
  });

  it("titik tanpa koordinat ditaruh di akhir setelah berkoordinat", () => {
    const plan = optimizeStops([pPoint("nogps", null, null), pPoint("withgps", -6.3, 106.8)]);
    expect(plan.order.indexOf("withgps")).toBeLessThan(plan.order.indexOf("nogps"));
    expect(plan.mapped).toBe(1);
  });

  it("tanpa depot: mulai dari titik koordinat pertama", () => {
    const plan = optimizeStops([pPoint("a", -6.4, 106.8), pPoint("b", -6.42, 106.81), pPoint("c", -7.1, 106.9)]);
    expect(plan.order[0]).toBe("a");
    expect(plan.order).toHaveLength(3);
    expect(plan.totalKm).toBeGreaterThan(0);
  });
});
