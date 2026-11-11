"use client";

import { useCallback, useRef, useState } from "react";
import { savePodAction } from "@/server/actions/erp";

type Props = {
  taskId: string;
  destination: string;
  contactName?: string | null;
};

const CHECKLIST = [
  "Kiriman lengkap & sesuai pesanan",
  "Kartu syar'i / surat terlampir",
  "Kemasan utuh, suhu & kondisi baik",
  "Al-Qur'an/thibbul qulub (bila paket)",
];

export default function PodForm({ taskId, destination, contactName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [geo, setGeo] = useState("");
  const [geoMsg, setGeoMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  const context = () => canvasRef.current?.getContext("2d") ?? null;

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    const p = pos(e);
    if (!ctx) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = context();
    const p = pos(e);
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setDirty(true);
  };
  const end = () => {
    drawing.current = false;
  };
  const clearCanvas = () => {
    const ctx = context();
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDirty(false);
  };

  const pickGps = useCallback(() => {
    setGeoMsg("Mengambil lokasi…");
    if (!("geolocation" in navigator)) {
      setGeoMsg("Perangkat tidak mendukung GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const g = `${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)} ±${Math.round(p.coords.accuracy)}m`;
        setGeo(g);
        setGeoMsg("Lokasi terkunci.");
      },
      (e) => setGeoMsg(`GPS gagal: ${e.message}`),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, []);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    fd.set("taskId", taskId);
    fd.set("podGeo", geo);
    const canvas = canvasRef.current;
    if (canvas) {
      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
      if (blob && blob.size > 0) {
        fd.set("podSignature", new File([blob], "ttd.png", { type: "image/png" }));
      }
    }
    setMsg(null);
    setPending(true);
    const res = await savePodAction(fd);
    setPending(false);
    setMsg(res);
    if (res.ok) clearCanvas();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-dashed border-slate-200 pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Lokasi GPS</label>
          <button
            type="button"
            onClick={pickGps}
            className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700 active:bg-emerald-50"
          >
            {geo || "Ambil GPS"}
            <span className="text-primary">◎</span>
          </button>
          {geoMsg && <p className={`mt-0.5 text-[10px] ${geo ? "text-emerald-600" : "text-slate-400"}`}>{geoMsg}</p>}
        </div>
        <div>
          <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Suhu produk (°C)</label>
          <input name="podTemp" type="number" step="0.1" inputMode="decimal" placeholder="mis. 4.5" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-primary" />
        </div>
      </div>

      <div>
        <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Nama penerima</label>
        <input name="recipientName" defaultValue={contactName ?? ""} placeholder="Nama penerima" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>

      <div>
        <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Foto bukti</label>
        <input
          name="podPhoto"
          type="file"
          accept="image/*"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white"
        />
      </div>

      <fieldset>
        <legend className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Ceklis syariah</legend>
        <div className="mt-1 space-y-1">
          {CHECKLIST.map((c) => (
            <label key={c} className="flex items-start gap-2 rounded-lg px-1 py-0.5 text-[12.5px] text-slate-700">
              <input type="checkbox" name="podChecklist" value={c} className="mt-0.5 h-4 w-4 accent-primary" />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Tanda tangan penerima</label>
        <canvas
          ref={canvasRef}
          width={560}
          height={200}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="mt-1 h-28 w-full touch-none rounded-xl border border-slate-300 bg-white"
        />
        <div className="mt-1 flex items-center justify-between">
          <button type="button" onClick={clearCanvas} className="text-[11px] font-semibold text-slate-500 underline">
            Bersihkan
          </button>
          <span className="text-[10px] text-slate-400">{dirty ? "tanda tangan siap" : `menandatangani: ${destination}`}</span>
        </div>
      </div>

      <div>
        <label className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">Catatan</label>
        <input name="podNotes" placeholder="Opsional" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-primary" />
      </div>

      {msg?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{msg.error}</p>}
      {msg?.ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">POD tersimpan — WA pemberitahuan dikirm bila gateway aktif.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan POD & Selesaikan"}
      </button>
    </form>
  );
}
