"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
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
      data-testid={`kanban-column-${status}`}
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
 * Getter de coordenadas del teclado para el kanban (Fase 7.2).
 *
 * POR QUÉ NO SE USA `sortableKeyboardCoordinates` de @dnd-kit/sortable, que es
 * lo que usa `SortableImageGallery`: ese getter hace
 * `droppableContainers.get(active.id)` y descarta el movimiento si no
 * encuentra nada. Solo `useSortable` registra un elemento como draggable Y
 * droppable a la vez; aquí las tarjetas son `useDraggable` y los droppables
 * son las columnas, así que ese `get` siempre da undefined y el getter
 * devuelve `undefined`: la tarjeta no se mueve ni un pixel. Comprobado con la
 * región aria-live, que tras ArrowRight seguía anunciando la columna origen.
 *
 * QUÉ HACE ESTE: ordena las columnas habilitadas por su borde izquierdo, ubica
 * la tarjeta en esa fila y salta a la columna contigua — una pulsación, una
 * columna. Devuelve el `left`/`top` de la columna destino porque el
 * `KeyboardSensor` inicializa sus coordenadas con el `left`/`top` del nodo
 * arrastrado: la resta da el desplazamiento exacto.
 *
 * ArrowLeft SÍ está permitido aunque el flujo de estados no admita retrocesos:
 * el rechazo es responsabilidad del hook (`useSellerOrders` avisa con un
 * toast), no del teclado. Si el getter bloqueara el intento, el usuario de
 * teclado no recibiría ninguna explicación.
 */
const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { collisionRect, droppableRects, droppableContainers } },
) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return;
  event.preventDefault();
  if (!collisionRect) return;

  const columnas = droppableContainers
    .getEnabled()
    .flatMap((entry) => {
      const rect = entry ? droppableRects.get(entry.id) : undefined;
      return rect ? [rect] : [];
    })
    .sort((a, b) => a.left - b.left);
  if (columnas.length === 0) return;

  // La columna actual es la que contiene el centro de la tarjeta; si el
  // arrastre ya la sacó de toda columna, la más cercana por la izquierda.
  const centro = collisionRect.left + collisionRect.width / 2;
  const actual = columnas.findLastIndex((rect) => rect.left <= centro);
  if (actual === -1) return;

  const destino = columnas[actual + (event.code === "ArrowRight" ? 1 : -1)];
  if (!destino) return;

  return { x: destino.left, y: destino.top };
};

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
    useSensor(KeyboardSensor, {
      // Sin getter, el default de dnd-kit mueve 25 px por flecha y las
      // columnas miden 240 px: la tarjeta nunca salía de la suya.
      coordinateGetter: kanbanKeyboardCoordinates,
    }),
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
