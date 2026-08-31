// Page Object de /pedidos y /pedidos/[id] (Fase 6.4).
//
// El listado y el detalle son la misma historia de negocio ("mis pedidos"), y
// los specs saltan de uno a otro en el mismo paso.

import type { Locator, Page } from "@playwright/test";

export class OrdersPage {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/pedidos");
  }

  async gotoDetail(orderId: string): Promise<void> {
    await this.page.goto(`/pedidos/${orderId}`);
    await this.title().waitFor();
  }

  cards(): Locator {
    return this.page.getByTestId("order-card");
  }

  /**
   * Card de un pedido concreto. La UI muestra los 8 primeros caracteres del
   * uuid, que es lo que se busca dentro de la card.
   */
  cardFor(orderId: string): Locator {
    return this.cards().filter({ hasText: orderId.slice(0, 8) });
  }

  title(): Locator {
    return this.page.getByTestId("order-title");
  }

  /** Badge de estado. En el detalle hay uno; en el listado, uno por card. */
  status(): Locator {
    return this.page.getByTestId("order-status");
  }

  itemRows(): Locator {
    return this.page.getByTestId("order-item-row");
  }

  total(): Locator {
    return this.page.getByTestId("order-total");
  }
}
