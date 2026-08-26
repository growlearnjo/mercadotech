"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  /** Valor inicial, para rellenar el input al volver a /buscar?q=... */
  defaultValue?: string;
  /**
   * Qué hacer con la consulta. El componente NO navega por su cuenta: quien lo
   * usa decide (el Navbar hace router.push a /buscar?q=). Así sigue siendo
   * puro y se puede probar sin router.
   */
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Buscador del navbar. Siempre navega a /buscar?q=; la pestaña "Resultados
 * con IA" de esa página (Fase 4.4) reusa la misma query, sin tocar este
 * componente.
 */
export function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "Buscar procesadores, GPU, laptops, monitores…",
  className,
}: SearchBarProps) {
  const [value, setValue] = React.useState(defaultValue);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    onSearch(query);
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn("flex w-full items-center gap-2", className)}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label="Buscar productos"
          className="h-10 w-full pl-9"
        />
      </div>
      <Button type="submit" size="lg" className="h-10 shrink-0 px-5 uppercase">
        Buscar
      </Button>
    </form>
  );
}
