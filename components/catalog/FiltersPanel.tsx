"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  PRICE_RANGE,
  SORT_OPTIONS,
  type CatalogFilters,
} from "@/lib/constants/catalog";
import { PRODUCT_CONDITIONS } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";
import type { ProductCondition } from "@/lib/constants/roles";

type FiltersPanelProps = {
  value: CatalogFilters;
  /** Recibe un parcial: el rango de precio fija mínimo y máximo a la vez. */
  onChange: (partial: Partial<CatalogFilters>) => void;
  onClear: () => void;
  className?: string;
};

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

/** Título de sección en versalitas espaciadas, como en el mockup. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-[0.14em] text-foreground uppercase">
      {children}
    </h3>
  );
}

/** Contenido del panel. Puro: solo `value` + `onChange`. */
function FiltersBody({ value, onChange, onClear }: FiltersPanelProps) {
  // El precio se edita como texto local y solo se propaga al confirmar: si se
  // emitiera en cada tecla, escribir "1500" dispararía cuatro consultas.
  const [minDraft, setMinDraft] = React.useState(value.minPrice?.toString() ?? "");
  const [maxDraft, setMaxDraft] = React.useState(value.maxPrice?.toString() ?? "");

  React.useEffect(() => {
    setMinDraft(value.minPrice?.toString() ?? "");
    setMaxDraft(value.maxPrice?.toString() ?? "");
  }, [value.minPrice, value.maxPrice]);

  const commitPrice = () => {
    const min = minDraft === "" ? undefined : Number(minDraft);
    const max = maxDraft === "" ? undefined : Number(maxDraft);
    // Una sola llamada con ambos: dos seguidas se pisarían entre sí, porque
    // cada una parte del mismo estado de la URL.
    onChange({
      minPrice: typeof min === "number" && Number.isFinite(min) ? min : undefined,
      maxPrice: typeof max === "number" && Number.isFinite(max) ? max : undefined,
    });
  };

  const toggleCondition = (condition: ProductCondition) => {
    const next = value.condition.includes(condition)
      ? value.condition.filter((c) => c !== condition)
      : [...value.condition, condition];
    onChange({ condition: next });
  };

  const hasFilters =
    value.condition.length > 0 ||
    value.minPrice !== undefined ||
    value.maxPrice !== undefined ||
    value.sort !== "recientes";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <SectionTitle>Filtros</SectionTitle>
        {hasFilters ? (
          <Button
            variant="link"
            size="xs"
            onClick={onClear}
            data-testid="filters-clear"
            className="h-auto p-0"
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      <Separator />

      <section className="flex flex-col gap-2">
        <SectionTitle>Ordenar por</SectionTitle>
        <div className="flex flex-col gap-1">
          {SORT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="sort"
                data-testid={`filter-sort-${option.value}`}
                checked={value.sort === option.value}
                onChange={() => onChange({ sort: option.value })}
                className="size-4 accent-[var(--primary)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <SectionTitle>Precio</SectionTitle>
        {/* Un <form> de verdad: al pulsar Enter en un input de texto el
            navegador envía el formulario por sí mismo, sin depender de que un
            handler de teclado se propague. `onBlur` cubre el caso de salir del
            campo con Tab o con el ratón. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commitPrice();
          }}
          className="flex items-center gap-2"
        >
          <div className="flex-1">
            <Label htmlFor="minPrice" className="sr-only">
              Precio mínimo
            </Label>
            <Input
              id="minPrice"
              data-testid="filter-min-price"
              inputMode="numeric"
              placeholder={`S/ ${PRICE_RANGE.min}`}
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
              onBlur={commitPrice}
            />
          </div>
          <span aria-hidden="true" className="text-muted-foreground">
            –
          </span>
          <div className="flex-1">
            <Label htmlFor="maxPrice" className="sr-only">
              Precio máximo
            </Label>
            <Input
              id="maxPrice"
              data-testid="filter-max-price"
              inputMode="numeric"
              placeholder={`S/ ${PRICE_RANGE.max.toLocaleString("es-PE")}`}
              value={maxDraft}
              onChange={(e) => setMaxDraft(e.target.value)}
              onBlur={commitPrice}
            />
          </div>
          {/* Permite enviar con Enter sin ocupar espacio visual. */}
          <button type="submit" className="sr-only">
            Aplicar rango de precio
          </button>
        </form>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <SectionTitle>Condición</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {PRODUCT_CONDITIONS.map((condition) => (
            <label
              key={condition}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                data-testid={`filter-condition-${condition}`}
                checked={value.condition.includes(condition)}
                onChange={() => toggleCondition(condition)}
                className="size-4 accent-[var(--primary)]"
              />
              {CONDITION_LABELS[condition]}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Panel de filtros.
 *
 * En desktop es una columna fija a la izquierda (como el mockup); en móvil el
 * mismo contenido vive dentro de un `sheet`, porque una columna de filtros se
 * comería la pantalla.
 */
export function FiltersPanel(props: FiltersPanelProps) {
  return (
    <>
      <aside
        className={cn(
          "hidden w-60 shrink-0 rounded-lg border border-border bg-card p-4 md:block",
          props.className,
        )}
      >
        <FiltersBody {...props} />
      </aside>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-8">
              <FiltersBody {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
