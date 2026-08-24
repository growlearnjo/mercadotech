"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";

/**
 * Mis favoritos (decisión 7: el UserMenu enlazaba aquí y ninguna fase la creaba).
 * El middleware ya garantiza que hay sesión en esta ruta.
 */
export default function FavoritesPage() {
  const { user } = useAuth();
  const { items, loading, error, retry } = useFavorites(user?.id ?? null);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis favoritos</h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Cargando…"
            : `${items.length} ${items.length === 1 ? "producto guardado" : "productos guardados"}`}
        </p>
      </header>

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Aún no guardaste favoritos"
          description="Marca el corazón en cualquier producto para tenerlo a mano."
          action={
            <Button render={<Link href="/" />} nativeButton={false} size="sm">
              Explorar el catálogo
            </Button>
          }
        />
      ) : (
        <ProductGrid
          products={items}
          loading={loading}
          error={error}
          onRetry={retry}
        />
      )}
    </div>
  );
}
