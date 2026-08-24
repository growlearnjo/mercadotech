"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { OrderKanbanCard } from "@/components/seller/OrderKanbanCard";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
} from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import type { SellerOrder } from "@/types/order";

type OrdersKanbanProps = {
  byStatus: Record<OrderStatus, SellerOrder[]>;
  onMove: (orderId: string, to: OrderStatus) => void;
};

function Column({
  status,
  orders,
  droppable,
}: {
  status: OrderStatus;
  orders: SellerOrder[];
  droppable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !droppable });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${ORDER_STATUS_LABELS[status]} (${orders.length})`}
      className={cn(
        "flex min-w-60 flex-1 flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors",
        isOver && droppable && "border-primary bg-accent",
      )}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-[0.14em] uppercase">
          {ORDER_STATUS_LABELS[status]}
        </h3>
        <span className="text-xs text-muted-foreground">{orders.length}</span>
      </header>

      {!droppable ? (
        <p className="text-xs text-muted-foreground">
          Solo lectura: cancelar es cosa del comprador.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {orders.map((order) => (
          <OrderKanbanCard key={order.id} order={order} draggable={droppable} />
        ))}
      </ul>

      {orders.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Sin pedidos
        </p>
      ) : null}
    </section>
  );
}

/**
 * Drag & drop #2 — kanban de pedidos.
 *
 * Soltar una tarjeta en otra columna cambia `orders.status`. La columna
 * "Cancelado" no acepta drops y sus tarjetas no se arrastran: la RLS solo
 * permite al vendedor poner pagado/enviado/entregado (decisión 9).
 */
export function OrdersKanban({ byStatus, onMove }: OrdersKanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    onMove(String(active.id), over.id as OrderStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {ORDER_STATUS_FLOW.map((status) => (
          <Column
            key={status}
            status={status}
            orders={byStatus[status] ?? []}
            droppable
          />
        ))}
        <Column
          status="cancelado"
          orders={byStatus.cancelado ?? []}
          droppable={false}
        />
      </div>
    </DndContext>
  );
}
