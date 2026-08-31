"use client";

import Link from "next/link";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import type { Product } from "@/types/product";

type ProductsTableProps = {
  products: Product[];
  onToggleActive: (productId: string, isActive: boolean) => void;
  onDelete: (productId: string) => void;
};

export function ProductsTable({
  products,
  onToggleActive,
  onDelete,
}: ProductsTableProps) {
  return (
    <div
      data-testid="seller-products-table"
      className="overflow-x-auto rounded-lg border border-border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Foto</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} data-testid="seller-product-row">
              <TableCell>
                <ProductImage
                  src={product.image_url}
                  alt=""
                  className="size-12"
                  sizes="48px"
                />
              </TableCell>
              <TableCell>
                <Link
                  href={`/producto/${product.id}`}
                  className="line-clamp-2 text-sm hover:text-primary"
                >
                  {product.title}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Price value={product.price} size="sm" />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {product.stock}
              </TableCell>
              <TableCell>
                <Badge
                  variant={product.is_active ? "default" : "secondary"}
                  className="transition-none"
                >
                  {product.is_active ? "Publicado" : "Oculto"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    render={<Link href={`/vendedor/productos/${product.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${product.title}`}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onToggleActive(product.id, !product.is_active)}
                    aria-label={
                      product.is_active
                        ? `Ocultar ${product.title}`
                        : `Publicar ${product.title}`
                    }
                  >
                    {product.is_active ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(product.id)}
                    aria-label={`Eliminar ${product.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
