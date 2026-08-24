"use client";

import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/product";

type CategoriesMenuProps = {
  /** Vacío en esta fase; `useCategories` lo alimenta en la 3.4. */
  categories: Category[];
  className?: string;
};

export function CategoriesMenu({ categories, className }: CategoriesMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        Categorías
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {categories.length === 0 ? (
          // Estado honesto mientras la 3.4 no conecte `useCategories`.
          <DropdownMenuItem disabled>Sin categorías</DropdownMenuItem>
        ) : (
          categories.map((category) => (
            <DropdownMenuItem
              key={category.id}
              render={<Link href={`/categoria/${category.slug}`} />}
              nativeButton={false}
            >
              {category.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
