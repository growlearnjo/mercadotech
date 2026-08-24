import { Button } from "@/components/ui/button";
import { FiltersPanel } from "@/components/catalog/FiltersPanel";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import type { CatalogFilters } from "@/lib/constants/catalog";
import type { Product } from "@/types/product";

/**
 * Las props reproducen los nombres que devuelve `useProducts`, así que las
 * páginas pueden hacer `<CatalogView title={...} {...catalog} />`. El
 * componente NO importa el hook: la regla del CLAUDE.md es que solo las
 * páginas conectan hooks con componentes.
 */
type CatalogViewProps = {
  title: string;
  /** Texto bajo el título. Si se omite, se deriva del total. */
  subtitle?: string;
  items: Product[];
  total: number;
  page: number;
  totalPages: number;
  filters: CatalogFilters;
  loading: boolean;
  error: string | null;
  setFilters: (partial: Partial<CatalogFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  retry: () => void;
};

/**
 * Composición compartida por la home, la página de categoría y la de
 * búsqueda: las tres son el MISMO catálogo con un filtro fijo distinto.
 *
 * Existe para que ese "mismo grid y hook" que pide la spec sea literal y no
 * tres copias que se desincronizan a la primera corrección.
 */
export function CatalogView({
  title,
  subtitle,
  items,
  total,
  page,
  totalPages,
  filters,
  loading,
  error,
  setFilters,
  clearFilters,
  setPage,
  retry,
}: CatalogViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {subtitle ??
              (loading
                ? "Buscando productos…"
                : `${total} ${total === 1 ? "producto" : "productos"}`)}
          </p>
        </div>
      </header>

      <div className="flex gap-6">
        {/* Un solo montaje: el propio panel decide si se pinta como columna
            (md+) o como disparador de sheet (móvil). */}
        <FiltersPanel
          value={filters}
          onChange={setFilters}
          onClear={clearFilters}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <ProductGrid
            products={items}
            loading={loading}
            error={error}
            onRetry={retry}
            emptyAction={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
