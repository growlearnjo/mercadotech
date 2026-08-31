// Page Object de /carrito (Fase 6.4).
//
// OJO con la UI real: cuando el carrito está vacío la app NO pinta el resumen
// — pinta un `EmptyState`. Por eso el "checkout imposible" se comprueba por la
// AUSENCIA del botón, no por su atributo disabled.

import type { Locator, Page } from "@playwright/test";

export class CartPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/carrito");
  }

  items(): Locator {
    return this.page.getByTestId("cart-item");
  }

  emptyState(): Locator {
    return this.page.getByTestId("empty-state");
  }

  summary(): Locator {
    return this.page.getByTestId("cart-summary");
  }

  /** Total del resumen, ya formateado por `formatPrice` (S/ + espacio duro). */
  total(): Locator {
    return this.page.getByTestId("cart-total");
  }

  itemCount(): Locator {
    return this.page.getByTestId("cart-item-count");
  }

  checkoutButton(): Locator {
    return this.page.getByTestId("cart-checkout");
  }

  disabledReason(): Locator {
    return this.page.getByTestId("cart-disabled-reason");
  }

  /**
   * Finaliza la compra y devuelve el id del pedido RECIÉN creado, leído de la
   * URL de redirección. Nunca "el primero de la lista": con `db reset` y
   * varios specs, esa suposición se rompe sola.
   */
  async checkout(): Promise<string> {
    await this.checkoutButton().click();
    await this.page.waitForURL(/\/pedidos\/[0-9a-f-]{36}$/);
    return this.page.url().split("/pedidos/")[1];
  }

  async setQuantity(index: number, quantity: number): Promise<void> {
    await this.page
      .getByTestId("cart-item-quantity")
      .nth(index)
      .selectOption(String(quantity));
  }

  async removeItem(index: number): Promise<void> {
    await this.page.getByTestId("cart-item-remove").nth(index).click();
  }
}
