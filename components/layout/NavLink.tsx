"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  /**
   * Por defecto una ruta se considera activa si el pathname empieza por `href`
   * (así `/vendedor/productos/x/editar` marca "Mis productos"). Con `exact` se
   * exige coincidencia total, necesario para "/" que si no marcaría siempre.
   */
  exact?: boolean;
  className?: string;
  activeClassName?: string;
};

export function NavLink({
  href,
  children,
  exact = false,
  className,
  activeClassName = "text-primary",
}: NavLinkProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      // `aria-current` es lo que anuncia el lector de pantalla; el color solo
      // sirve a quien ve.
      aria-current={active ? "page" : undefined}
      className={cn(
        "text-sm transition-colors hover:text-primary",
        active ? activeClassName : "text-foreground/80",
        className,
      )}
    >
      {children}
    </Link>
  );
}
