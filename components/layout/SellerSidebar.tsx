"use client";

import { Package, PlusCircle, ClipboardList } from "lucide-react";

import { NavLink } from "@/components/layout/NavLink";
import { cn } from "@/lib/utils";

const SELLER_LINKS = [
  { href: "/vendedor/productos", label: "Mis productos", icon: Package },
  { href: "/vendedor/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/vendedor/publicar", label: "Publicar", icon: PlusCircle },
] as const;

type SellerSidebarProps = {
  className?: string;
};

/**
 * Navegación lateral del panel del vendedor.
 *
 * En < md el layout la coloca como fila horizontal desplazable en vez de
 * columna: un sidebar fijo se come la pantalla en móvil.
 */
export function SellerSidebar({ className }: SellerSidebarProps) {
  return (
    <nav
      aria-label="Panel del vendedor"
      className={cn(
        "flex gap-1 overflow-x-auto md:w-56 md:shrink-0 md:flex-col md:overflow-visible",
        className,
      )}
    >
      {SELLER_LINKS.map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          href={href}
          // `/vendedor/productos` es prefijo de `/vendedor/productos/x/editar`,
          // que debe marcar el mismo enlace: por eso no se usa `exact`.
          className="flex items-center gap-2 rounded-md px-3 py-2 whitespace-nowrap hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium"
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
