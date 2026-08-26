"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CatalogView } from "@/components/catalog/CatalogView";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";

/** Pestaña "Resultados con IA": mismo ProductGrid, sin filtros ni paginación (fuera de alcance de la búsqueda semántica). */
function SemanticResultsTab({ query, active }: { query: string; active: boolean }) {
  const { results, loading, error } = useSemanticSearch(query, active);

  const similarityByProductId = React.useMemo(
    () => Object.fromEntries(results.map((r) => [r.product.id, r.similarity])),
    [results],
  );

  if (!loading && error) {
    return (
      <EmptyState
        title="No pudimos completar la búsqueda"
        description={error}
      />
    );
  }

  if (!loading && results.length === 0) {
    return (
      <EmptyState
        title="Sin resultados"
        description="Prueba describir para qué lo necesitas, en vez de un nombre exacto."
      />
    );
  }

  return (
    <ProductGrid
      products={results.map((r) => r.product)}
      loading={loading}
      similarityByProductId={similarityByProductId}
    />
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const catalog = useProducts({ search: query });
  const { user, initializing } = useAuth();
  const [tab, setTab] = React.useState<"exacta" | "ia">("exacta");

  const loginHref = `/login?redirectTo=${encodeURIComponent(
    `/buscar${query ? `?q=${encodeURIComponent(query)}` : ""}`,
  )}`;

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={tab} onValueChange={(value) => setTab(value as "exacta" | "ia")}>
        <TabsList>
          <TabsTrigger value="exacta">Coincidencia exacta</TabsTrigger>
          <TabsTrigger value="ia">Resultados con IA</TabsTrigger>
        </TabsList>

        <TabsContent value="exacta">
          <CatalogView
            title={query ? `Resultados para «${query}»` : "Buscar"}
            {...catalog}
          />
        </TabsContent>

        <TabsContent value="ia" className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {query ? `Resultados con IA para «${query}»` : "Buscar con IA"}
          </h1>
          {!query.trim() ? (
            <EmptyState
              title="Escribe algo para buscar"
              description="Prueba describir para qué lo necesitas, ej. «audífonos para el gimnasio»."
            />
          ) : initializing ? null : !user ? (
            <EmptyState
              title="Inicia sesión para usar la búsqueda inteligente"
              description="La búsqueda por significado está disponible solo con sesión iniciada."
              action={
                <Button render={<Link href={loginHref} />} nativeButton={false} size="sm">
                  Iniciar sesión
                </Button>
              }
            />
          ) : (
            <SemanticResultsTab query={query} active={tab === "ia"} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={null}>
      <SearchContent />
    </React.Suspense>
  );
}
