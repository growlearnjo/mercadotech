import Link from "next/link";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Price } from "@/components/shared/Price";
import type { Order } from "@/types/order";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href={`/pedidos/${order.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            Pedido #{order.id.slice(0, 8)}
          </span>
          <OrderStatusBadge status={order.status} />
        </div>
        <span className="text-sm text-muted-foreground">
          {formatDate(order.created_at)} · {itemCount}{" "}
          {itemCount === 1 ? "producto" : "productos"}
        </span>
      </div>
      <Price value={order.total} size="md" />
    </Link>
  );
}
