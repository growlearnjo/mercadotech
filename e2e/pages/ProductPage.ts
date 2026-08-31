// Page Object de /producto/[id] (Fase 6.4).
//
// El detalle es PÚBLICO: se puede abrir sin sesión. Lo que exige sesión es
// agregar al carrito, y eso lo resuelve la propia app.

import type { Locator, Page } from "@playwright/test";

export class ProductPage {
  constructor(private readonly page: Page) {}

  async goto(productId: string): Promise<void> {
    await this.page.goto(`/producto/${productId}`);
    await this.buyBox().waitFor();
  }

  buyBox(): Locator {
    return this.page.getByTestId("buy-box");
  }

  price(): Locator {
    return this.page.getByTestId("buy-box-price");
  }

  addToCartButton(): Locator {
    return this.page.getByTestId("buy-box-add-to-cart");
  }

  /** Motivo visible por el que no se puede comprar (sin stock, propio, inactivo). */
  blockedReason(): Locator {
    return this.page.getByTestId("buy-box-blocked");
  }

  gallery(): Locator {
    return this.page.getByRole("img").first();
  }

  /** Elige la cantidad y agrega al carrito. */
  async addToCart(quantity: number): Promise<void> {
    await this.page
      .getByTestId("buy-box-quantity")
      .selectOption(String(quantity));
    await this.addToCartButton().click();
  }
}
