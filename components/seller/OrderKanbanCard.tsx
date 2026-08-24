"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Price } from "@/components/shared/Price";
import { cn } from "@/lib/utils";
import type { SellerOrder } from "@/types/order";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}

export function OrderKanbanCard({
  order,
  draggable,
}: {
  order: SellerOrder;
  /** La columna "Cancelado" es de solo lectura: sus tarjetas no se arrastran. */
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: order.id, disabled: !draggable });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-3",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium">#{order.id.slice(0, 8)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(order.created_at)}
          </span>
        </div>
        {draggable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover pedido ${order.id.slice(0, 8)}`}
            className="cursor-grab rounded-md p-1 text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-0.5">
        {order.items.map((item) => (
          <li key={item.id} className="line-clamp-1 text-xs text-muted-foreground">
            {item.quantity}× {item.title_snapshot}
          </li>
        ))}
      </ul>

      {/* Total de MIS ítems, no `orders.total`: el pedido puede incluir
          productos de otros vendedores. */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">Mis ítems</span>
        <Price value={order.myTotal} size="sm" />
      </div>
    </li>
  );
}
