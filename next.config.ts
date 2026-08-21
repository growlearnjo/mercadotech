import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Fija la raíz del workspace: evita que Turbopack la infiera a partir de
    // un lockfile ajeno en un directorio superior (ej. C:\Users\<usuario>).
    root: path.join(__dirname),
  },
};

export default nextConfig;
