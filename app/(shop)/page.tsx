"use client";

import * as React from "react";

import { CatalogView } from "@/components/catalog/CatalogView";
import { useProducts } from "@/hooks/useProducts";

/** Home: el catálogo completo, sin filtro fijo. */
function HomeContent() {
  // La página es el único sitio donde el hook se encuentra con el componente.
  const catalog = useProducts();
  return <CatalogView title="Productos" {...catalog} />;
}

export default function HomePage() {
  // `useProducts` lee searchParams, así que necesita un límite de Suspense.
  return (
    <React.Suspense fallback={null}>
      <HomeContent />
    </React.Suspense>
  );
}
