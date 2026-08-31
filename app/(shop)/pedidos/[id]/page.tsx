"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Price } from "@/components/shared/Price";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Separator } from "@/components/ui/separator";
import { useOrder } from "@/hooks/useOrders";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function OrderDetail({ id }: { id: string }) {
  const { order, loading, error, cancel, retry } = useOrder(id);

  if (loading) {
    return <LoadingState variant="card" label="Cargando pedido" />;
  }
  // RLS devuelve null para un pedido ajeno: se ve igual que uno inexistente,
  // que es justo lo deseable (no se filtra qué pedidos existen).
  if (error || !order) {
    return (
      <ErrorState
        title="No pudimos mostrar este pedido"
        description={error ?? "Inténtalo de nuevo."}
        onRetry={retry}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        render={<Link href="/pedidos" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Mis pedidos
      </Button>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              data-testid="order-title"
              className="text-2xl font-semibold tracking-tight"
            >
              Pedido #{order.id.slice(0, 8)}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.created_at)}
          </p>
        </div>

        {/* Solo se puede cancelar mientras siga pendiente; en cualquier otro
            estado el botón no existe (y si se forzara, la RLS lo rechaza). */}
        {order.status === "pendiente" ? (
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Cancelar pedido
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Cancelar este pedido?</DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer. Ten en cuenta que el stock
                  reservado no se repone automáticamente.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" size="sm" />}>
                  Volver
                </DialogClose>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const done = await cancel();
                    if (done) toast.success("Pedido cancelado");
                    else toast.error("Este pedido ya no se puede cancelar");
                  }}
                >
                  Sí, cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </header>

      <OrderItemsTable items={order.items} />

      <Separator />

      <div className="flex items-center justify-between">
        <span className="font-medium">Total</span>
        <Price value={order.total} size="lg" data-testid="order-total" />
      </div>

      <p className="text-xs text-muted-foreground">
        Compra simulada: este pedido no generó ningún cobro real.
      </p>
    </div>
  );
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return <OrderDetail id={id} />;
}
