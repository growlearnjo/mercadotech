"use client";

import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";

import { ProductsTable } from "@/components/seller/ProductsTable";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProducts } from "@/hooks/useSellerProducts";

export default function SellerProductsPage() {
  const { profile } = useAuth();
  const { products, loading, error, toggleActive, remove, reload } =
    useSellerProducts(profile?.id ?? null);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mis productos</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Cargando…" : `${products.length} en total`}
          </p>
        </div>
        <Button render={<Link href="/vendedor/publicar" />} nativeButton={false} size="sm">
          <PackagePlus className="size-4" aria-hidden="true" />
          Publicar producto
        </Button>
      </header>

      {loading ? (
        <LoadingState variant="list" count={4} label="Cargando productos" />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="Todavía no publicaste nada"
          description="Publica tu primer producto para empezar a vender."
          action={
            <Button render={<Link href="/vendedor/publicar" />} nativeButton={false} size="sm">
              Publicar producto
            </Button>
          }
        />
      ) : (
        <ProductsTable
          products={products}
          onToggleActive={async (id, isActive) => {
            const ok = await toggleActive(id, isActive);
            if (ok) toast.success(isActive ? "Producto publicado" : "Producto oculto");
            else toast.error("No pudimos cambiar el estado");
          }}
          onDelete={async (id) => {
            const message = await remove(id);
            // Decisión 10: si tiene ventas, la FK lo impide y se sugiere ocultar.
            if (message) toast.error(message);
            else toast.success("Producto eliminado");
          }}
        />
      )}
    </div>
  );
}
