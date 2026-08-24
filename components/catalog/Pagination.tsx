"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  // Con una sola página el control no aporta nada y solo mete ruido.
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginación del catálogo"
      className="flex items-center justify-center gap-4"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Anterior
      </Button>

      {/* `aria-live`: al cambiar de página el lector anuncia dónde estás. */}
      <span aria-live="polite" className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Siguiente
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
