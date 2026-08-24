import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Price } from "@/components/shared/Price";
import type { OrderItem } from "@/types/order";

/**
 * Ítems del pedido con los SNAPSHOTS, no con los datos vivos del producto:
 * si el vendedor cambia el precio o el título después, el pedido no cambia.
 */
export function OrderItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Cant.</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link
                  href={`/producto/${item.product_id}`}
                  className="hover:text-primary"
                >
                  {item.title_snapshot}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Price value={item.price_snapshot} size="sm" />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.quantity}
              </TableCell>
              <TableCell className="text-right">
                <Price
                  value={item.price_snapshot * item.quantity}
                  size="sm"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
