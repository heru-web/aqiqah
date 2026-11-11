import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.madaniaqiqah.com"),
  title: {
    default: "Madani Aqiqah",
    template: "%s · Madani Aqiqah",
  },
  description:
    "Super apps ERP Aqiqah — CRM, Order, Produksi, Inventaris, Pengiriman, Keuangan & Akuntansi Syariah.",
  icons: {
    icon: "/img/logo-madani.jpg",
    shortcut: "/img/logo-madani.jpg",
    apple: "/img/logo-madani.jpg",
  },
  openGraph: {
    title: "Madani Aqiqah",
    description:
      "Super apps ERP Aqiqah — CRM, Order, Produksi, Inventaris, Pengiriman, Keuangan & Akuntansi Syariah.",
    images: [{ url: "/img/logo-madani.jpg", width: 960, height: 960, alt: "Madani Aqiqah" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/img/logo-madani.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d7c66",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${dmSans.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-foreground">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}