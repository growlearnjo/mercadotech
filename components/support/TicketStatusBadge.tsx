import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TICKET_STATUS_CLASSES,
  TICKET_STATUS_LABELS,
} from "@/lib/constants/support";
import type { TicketStatus } from "@/lib/constants/roles";

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    // `transition-none`: mismo motivo que OrderStatusBadge/ConditionBadge.
    <Badge
      className={cn("transition-none", TICKET_STATUS_CLASSES[status], className)}
    >
      {TICKET_STATUS_LABELS[status]}
    </Badge>
  );
}
