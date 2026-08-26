"use client";

import Link from "next/link";
import {
  Heart,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Category } from "@/types/product";
import type { NavUser } from "@/components/layout/UserMenu";

type MobileNavProps = {
  categories: Category[];
  user: NavUser | null;
  cartCount: number;
  onLogout?: () => void;
};

/**
 * Navegación para < md: los mismos destinos del navbar dentro de un `sheet`.
 *
 * El foco, Escape y el cierre por teclado los gestiona el Dialog de Base UI
 * sobre el que se apoya `Sheet`; no hace falta añadir manejo propio.
 */
export function MobileNav({
  categories,
  user,
  cartCount,
  onLogout,
}: MobileNavProps) {
  const canSell = user?.role === "seller" || user?.role === "admin";

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Abrir menú" />
        }
      >
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>

      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-4 pb-6">
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/carrito"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              />
            }
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            Carrito
            {cartCount > 0 ? (
              <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {cartCount}
              </span>
            ) : null}
          </SheetClose>

          {user ? (
            <>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/pedidos"
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  />
                }
              >
                <Package className="size-4" aria-hidden="true" />
                Mis pedidos
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/favoritos"
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  />
                }
              >
                <Heart className="size-4" aria-hidden="true" />
                Favoritos
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/asistente"
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  />
                }
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Asistente
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/soporte"
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  />
                }
              >
                <LifeBuoy className="size-4" aria-hidden="true" />
                Soporte
              </SheetClose>
              {canSell ? (
                <SheetClose
                  nativeButton={false}
                  render={
                    <Link
                      href="/vendedor/productos"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    />
                  }
                >
                  <Store className="size-4" aria-hidden="true" />
                  Panel del vendedor
                </SheetClose>
              ) : null}
            </>
          ) : (
            <SheetClose
              nativeButton={false}
              render={
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                />
              }
            >
              Ingresar
            </SheetClose>
          )}

          <Separator className="my-3" />

          <p className="px-2 pb-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Categorías
          </p>
          {categories.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              Sin categorías
            </p>
          ) : (
            categories.map((category) => (
              <SheetClose
                key={category.id}
                nativeButton={false}
                render={
                  <Link
                    href={`/categoria/${category.slug}`}
                    className="rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  />
                }
              >
                {category.name}
              </SheetClose>
            ))
          )}

          {user ? (
            <>
              <Separator className="my-3" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="justify-start text-destructive"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Cerrar sesión
              </Button>
            </>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
