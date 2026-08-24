"use client";

import Link from "next/link";
import { Package } from "lucide-react";

import { OrderCard } from "@/components/orders/OrderCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useOrders } from "@/hooks/useOrders";

export default function OrdersPage() {
  const { user } = useAuth();
  const { orders, loading, error, retry } = useOrders(user?.id ?? null);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
        <p className="text-sm text-muted-foreground">
          {loading ? "Cargando…" : `${orders.length} en total`}
        </p>
      </header>

      {loading ? (
        <LoadingState variant="list" count={3} label="Cargando pedidos" />
      ) : error ? (
        <ErrorState description={error} onRetry={retry} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Todavía no hiciste pedidos"
          description="Cuando compres algo, aparecerá aquí."
          action={
            <Button render={<Link href="/" />} nativeButton={false} size="sm">
              Ver productos
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
