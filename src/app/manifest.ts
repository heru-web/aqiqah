import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Madani Aqiqah ERP",
    short_name: "Madani",
    description: "Super apps ERP Aqiqah — CRM, Order, Produksi, Inventaris, Pengiriman, Keuangan & Akuntansi Syariah.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fcfbf8",
    theme_color: "#0d7c66",
    icons: [
      {
        src: "/img/logo-madani.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
