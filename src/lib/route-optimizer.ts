/**
 * Optimizer rute pengiriman — nearest-neighbor untuk titik-titik ber-GPS.
 * Titik tanpa koordinat ditaruh di akhir (urutan asli), jarak pakai haversine.
 */

export interface RoutePoint {
  id: string;
  lat: number | null;
  lng: number | null;
}

export interface RoutePlan {
  /** id titik dalam urutan kunjungi */
  order: string[];
  /** jumlah titik yang punya koordinat (dapat dioptimalkan) */
  mapped: number;
  /** estimasi total jarak (km) untuk bagian berkoordinat */
  totalKm: number;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

interface Indexed extends RoutePoint {
  _geo: boolean;
  _x: number;
  _y: number;
}

/** Titik berkoordinat pakai NN greedy; lalu sisanya menempel di belakang (urutan asli). */
export function optimizeStops(points: RoutePoint[], depot?: { lat: number; lng: number }): RoutePlan {
  const geo = points
    .filter((p) => p.lat !== null && p.lng !== null)
    .map((p, _i) => ({ ...p, _geo: true, _x: p.lat as number, _y: p.lng as number }));
  const others = points.filter((p) => p.lat === null || p.lng === null).map((p) => p.id);

  let order: string[] = [];
  let totalKm = 0;

  if (geo.length > 0) {
    let cursor: { x: number; y: number } | null = depot ? { x: depot.lat, y: depot.lng } : null;
    const remaining = [...geo];
    if (!cursor && remaining.length > 0) {
      const first = remaining.shift() as { _x: number; _y: number } & RoutePoint;
      order.push(first.id);
      cursor = { x: first._x, y: first._y };
    }

    while (cursor && remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const d = haversineKm(cursor.y, cursor.x, remaining[i].lat as number, remaining[i].lng as number);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      order.push(next.id);
      cursor = { x: next.lat as number, y: next.lng as number };
      totalKm += bestDist;
    }
    order = order.concat(others);
  } else {
    order = points.map((p) => p.id);
  }

  return { order, mapped: geo.length, totalKm };
}
