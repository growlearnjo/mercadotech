"use client";

import { Button } from "@/components/ui/button";
import { Price } from "@/components/shared/Price";
import { Separator } from "@/components/ui/separator";

type CartSummaryProps = {
  subtotal: number;
  itemCount: number;
  submitting?: boolean;
  /** Bloquea el checkout: carrito vacío o con productos no disponibles. */
  disabledReason?: string | null;
  onCheckout: () => void;
};

export function CartSummary({
  subtotal,
  itemCount,
  submitting,
  disabledReason,
  onCheckout,
}: CartSummaryProps) {
  return (
    <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-[0.14em] uppercase">
        Resumen
      </h2>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {itemCount} {itemCount === 1 ? "producto" : "productos"}
        </span>
        <Price value={subtotal} size="sm" />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="font-medium">Total</span>
        <Price value={subtotal} size="lg" />
      </div>

      {disabledReason ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}

      <Button
        onClick={onCheckout}
        disabled={Boolean(disabledReason) || submitting}
        className="w-full"
      >
        {submitting ? "Procesando…" : "Finalizar compra"}
      </Button>

      {/* El proyecto NO tiene pasarela de pago en ningún momento. */}
      <p className="text-center text-xs text-muted-foreground">
        Pago simulado para el laboratorio — no se cobra nada ni se piden datos
        de tarjeta.
      </p>
    </aside>
  );
}
