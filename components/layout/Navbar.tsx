"use client";

import { useRouter } from "next/navigation";

import { Brand } from "@/components/layout/Brand";
import { CartIndicator } from "@/components/layout/CartIndicator";
import { CategoriesMenu } from "@/components/layout/CategoriesMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { SearchBar } from "@/components/layout/SearchBar";
import { UserMenu, type NavUser } from "@/components/layout/UserMenu";
import { NavLink } from "@/components/layout/NavLink";
import { Container } from "@/components/shared/Container";
import type { Category } from "@/types/product";

type NavbarProps = {
  /** Vacío hasta que la 3.4 conecte `useCategories`. */
  categories: Category[];
  /** `null` hasta que la 3.3 conecte `useAuth`. */
  user: NavUser | null;
  /** 0 hasta que la 3.6 conecte `useCart`. */
  cartCount: number;
  onLogout?: () => void;
};

/**
 * Cabecera de la tienda, en los tres pisos del mockup:
 *
 *   1. banda navy fina (identidad, sin navegación)
 *   2. barra blanca: marca + buscador ancho + cuenta + carrito
 *   3. fila de categorías (oculta en móvil, donde vive en el sheet)
 *
 * Es un componente de composición: no hace fetching. Lo único que resuelve por
 * su cuenta es la navegación del buscador, porque `useRouter` es del framework,
 * no de la capa de datos.
 */
export function Navbar({
  categories,
  user,
  cartCount,
  onLogout,
}: NavbarProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      {/* Piso 1 — banda navy. Decorativa: identidad de marca, sin enlaces. */}
      <div className="bg-band text-band-foreground">
        <Container width="wide" className="flex h-8 items-center justify-between">
          <span className="text-[0.7rem] font-medium tracking-[0.18em] uppercase">
            Marketplace de tecnología
          </span>
          <span className="hidden text-[0.7rem] tracking-wide sm:inline">
            Envíos a todo el Perú
          </span>
        </Container>
      </div>

      {/* Piso 2 — marca, buscador y accesos de cuenta. */}
      <Container width="wide" className="flex h-16 items-center gap-4">
        <div className="md:hidden">
          <MobileNav
            categories={categories}
            user={user}
            cartCount={cartCount}
            onLogout={onLogout}
          />
        </div>

        <Brand />

        <div className="hidden flex-1 md:block">
          <SearchBar
            onSearch={(query) =>
              router.push(`/buscar?q=${encodeURIComponent(query)}`)
            }
          />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <CartIndicator count={cartCount} />
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </Container>

      {/* Buscador en su propia fila en móvil: en la barra no cabe. */}
      <Container width="wide" className="pb-3 md:hidden">
        <SearchBar
          onSearch={(query) =>
            router.push(`/buscar?q=${encodeURIComponent(query)}`)
          }
          placeholder="Buscar productos…"
        />
      </Container>

      {/* Piso 3 — categorías. */}
      <div className="hidden border-t border-border md:block">
        <Container width="wide" className="flex h-11 items-center gap-5">
          <CategoriesMenu categories={categories} />
          <NavLink href="/" exact>
            Inicio
          </NavLink>
          {categories.slice(0, 6).map((category) => (
            <NavLink key={category.id} href={`/categoria/${category.slug}`}>
              {category.name}
            </NavLink>
          ))}
        </Container>
      </div>
    </header>
  );
}
