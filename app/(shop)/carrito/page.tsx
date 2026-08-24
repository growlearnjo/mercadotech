"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { CartItemRow } from "@/components/cart/CartItemRow";
import { CartSummary } from "@/components/cart/CartSummary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const cart = useCart(user?.id ?? null);
  const [submitting, setSubmitting] = React.useState(false);

  const unavailable = cart.items.filter((item) => !item.product).length;
  const disabledReason =
    cart.items.length === 0
      ? "Tu carrito está vacío."
      : unavailable > 0
        ? "Quita los productos que ya no están disponibles para continuar."
        : null;

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const orderId = await cart.checkout();
      toast.success("Pedido creado");
      router.push(`/pedidos/${orderId}`);
    } catch (error) {
      // El mensaje del RPC ya nombra el producto que falló: se muestra tal cual.
      const message =
        error instanceof Error ? error.message : "No pudimos crear el pedido.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Tu carrito</h1>

      {cart.loading ? (
        <LoadingState variant="list" count={3} label="Cargando carrito" />
      ) : cart.error ? (
        <ErrorState description={cart.error} onRetry={cart.reload} />
      ) : cart.items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Tu carrito está vacío"
          description="Explora el catálogo y agrega lo que te guste."
          action={
            <Button render={<Link href="/" />} nativeButton={false} size="sm">
              Ver productos
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ul className="flex flex-col">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                id={item.id}
                quantity={item.quantity}
                product={item.product}
                onQuantityChange={(q) => cart.update(item.id, q)}
                onRemove={() => cart.remove(item.id)}
              />
            ))}
          </ul>

          <CartSummary
            subtotal={cart.subtotal}
            itemCount={cart.count}
            submitting={submitting}
            disabledReason={disabledReason}
            onCheckout={handleCheckout}
          />
        </div>
      )}
    </div>
  );
}
