import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MercadoTech — Marketplace de tecnología",
    // Cada pantalla define su propio title y aquí se le añade la marca.
    template: "%s · MercadoTech",
  },
  description:
    "Compra y vende tecnología: componentes, laptops, monitores y periféricos, con reseñas verificadas y preguntas al vendedor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* Notificaciones globales: los formularios de 3.3 en adelante las usan. */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
