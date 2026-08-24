import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Fija la raíz del workspace: evita que Turbopack la infiera a partir de
    // un lockfile ajeno en un directorio superior (ej. C:\Users\<usuario>).
    root: path.join(__dirname),
  },
  images: {
    // Las imágenes de producto se sirven desde Storage de Supabase, siempre
    // bajo /storage/v1/object/public/**. Se declaran los dos orígenes posibles
    // para no tener que tocar este archivo al desplegar.
    remotePatterns: [
      {
        // Stack local (`supabase start`): NEXT_PUBLIC_SUPABASE_URL apunta aquí.
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Mismo stack local cuando el navegador resuelve por nombre.
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Proyecto hosted (<ref>.supabase.co), para cuando se despliegue.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
