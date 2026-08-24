"use client";

import * as React from "react";

import { CatalogView } from "@/components/catalog/CatalogView";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";

function CategoryContent({ slug }: { slug: string }) {
  const catalog = useProducts({ categorySlug: slug });
  const { categories } = useCategories();

  // El nombre bonito sale del listado ya cacheado; si aún no cargó se usa el
  // slug para no dejar el encabezado vacío.
  const category = categories.find((c) => c.slug === slug);

  return <CatalogView title={category?.name ?? slug} {...catalog} />;
}

/**
 * Catálogo filtrado por categoría. El slug viene del segmento de ruta, no de
 * los filtros: por eso no se puede quitar desde el panel.
 */
export default function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // En Next 15 `params` es una promesa; `use` la resuelve en el cliente.
  const { slug } = React.use(params);

  return (
    <React.Suspense fallback={null}>
      <CategoryContent slug={slug} />
    </React.Suspense>
  );
}
