"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { CatalogView } from "@/components/catalog/CatalogView";
import { useProducts } from "@/hooks/useProducts";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const catalog = useProducts({ search: query });

  return (
    <CatalogView
      title={query ? `Resultados para «${query}»` : "Buscar"}
      {...catalog}
    />
  );
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={null}>
      <SearchContent />
    </React.Suspense>
  );
}
