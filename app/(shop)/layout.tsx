"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Container } from "@/components/shared/Container";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useCategories } from "@/hooks/useCategories";

/** Layout de la tienda: navbar + contenido + pie mínimo. */
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, logout } = useAuth();
  const { categories } = useCategories();
  const { count } = useCart(user?.id ?? null);

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar
        categories={categories}
        // `UserMenu` solo necesita nombre, avatar y rol; se le pasa el perfil,
        // no el usuario de Auth, porque el rol vive en `profiles`.
        user={profile}
        cartCount={count}
        onLogout={logout}
      />

      <main className="flex-1 py-6">
        <Container width="wide">{children}</Container>
      </main>

      <footer className="border-t border-border py-6">
        <Container
          width="wide"
          className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row"
        >
          <p>MercadoTech — proyecto de curso, sin cobros reales. Desplegado con Vercel.</p>
          <p>El checkout es simulado: crea el pedido y descuenta stock.</p>
        </Container>
      </footer>
    </div>
  );
}
