import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    // `transition-none` por el mismo motivo que ConditionBadge: animar un color
    // que sale de una variable CSS deja el badge anclado al tema anterior.
    <Badge
      data-testid="order-status"
      className={cn("transition-none", ORDER_STATUS_CLASSES[status], className)}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
