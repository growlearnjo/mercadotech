"use client";

import { ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { OrdersKanban } from "@/components/seller/OrdersKanban";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useSellerOrders } from "@/hooks/useSellerOrders";

export default function SellerOrdersPage() {
  const { profile } = useAuth();
  const { orders, byStatus, loading, error, move, reload } = useSellerOrders(
    profile?.id ?? null,
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Arrastra una tarjeta a la siguiente columna para avanzar su estado.
        </p>
      </header>

      {loading ? (
        <LoadingState variant="list" count={4} label="Cargando pedidos" />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin pedidos todavía"
          description="Cuando alguien compre tus productos, los verás aquí."
        />
      ) : (
        <OrdersKanban
          byStatus={byStatus}
          onMove={async (orderId, to) => {
            const result = await move(orderId, to);
            if (result.ok) toast.success("Pedido actualizado");
            else toast.error(result.message);
          }}
        />
      )}
    </div>
  );
}
