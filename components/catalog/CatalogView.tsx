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

/**
 * Esqueleto del catálogo mientras React resuelve el límite de Suspense
 * (Fase 7.2).
 *
 * Existe por una medición, no por estética: con `fallback={null}` la página
 * nacía VACÍA, el pie subía hasta el borde superior y volvía a bajar al llegar
 * el grid. Lighthouse lo cazó como el único desplazamiento de la home y le
 * puso nombre —"footer.border-t"— y precio: CLS 0.118, por encima del 0.1 que
 * exige la fase. Reservar el alto de una página de catálogo lo lleva a 0.
 *
 * Reutiliza `ProductGrid` en estado `loading` para que la reserva la calcule
 * el propio grid: si mañana cambia el número de columnas o el page size, el
 * esqueleto lo sigue solo.
 *
 * SOLO LA HOME lo usa, y a propósito. En `/categoria/[slug]` se intentó lo
 * mismo y no sirvió: ahí `React.use(params)` suspende POR ENCIMA de este
 * límite, y moverlo dentro dejaba la ruta colgada en el esqueleto para
 * siempre. En `/buscar` no se midió. Las dos quedaron como estaban: la fase
 * solo conserva cambios con número que los respalde.
 */
export function CatalogViewSkeleton({ title }: { title?: string }) {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {title ?? " "}
          </h1>
          <p className="text-sm text-muted-foreground">Cargando productos…</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="hidden w-56 shrink-0 md:block" />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <ProductGrid products={[]} loading />
        </div>
      </div>
    </div>
  );
}
