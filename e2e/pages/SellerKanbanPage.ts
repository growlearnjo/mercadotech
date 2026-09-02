// Page Object de /vendedor/pedidos — el kanban (Fase 6.4).
//
// EL MOVIMIENTO SE HACE POR TECLADO (decisión 9 de la spec). El drag con
// mouse de dnd-kit es frágil bajo Playwright, pero además el camino de
// teclado es el que garantiza la accesibilidad: si ese muere, murió la
// accesibilidad aunque el mouse siga funcionando. `KeyboardSensor` está
// activo desde la sesión 3.

import { expect, type Locator, type Page } from "@playwright/test";

import type { OrderStatus } from "@/lib/constants/roles";

export class SellerKanbanPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/vendedor/pedidos");
    await this.column("pagado").waitFor();
  }

  column(status: OrderStatus): Locator {
    return this.page.getByTestId(`kanban-column-${status}`);
  }

  /** Tarjeta por id de pedido, esté en la columna que esté. */
  card(orderId: string): Locator {
    return this.page.getByTestId(`kanban-card-${orderId}`);
  }

  /** Tarjeta de un pedido DENTRO de una columna concreta. */
  cardInColumn(orderId: string, status: OrderStatus): Locator {
    return this.column(status).getByTestId(`kanban-card-${orderId}`);
  }

  handle(orderId: string): Locator {
    return this.page.getByTestId(`kanban-handle-${orderId}`);
  }

  /**
   * Mueve una tarjeta N columnas con el patrón de `KeyboardSensor`:
   * foco en el asa → Space (levanta) → flecha (mueve) → Space (suelta).
   */
  async moveByKeyboard(
    orderId: string,
    direction: "ArrowRight" | "ArrowLeft",
    steps = 1,
  ): Promise<void> {
    const handle = this.handle(orderId);
    // dnd-kit narra cada paso del arrastre en una región aria-live: es el
    // único estado observable del drag y, de paso, lo que oye un lector de
    // pantalla. Esperar a que el anuncio CAMBIE tras cada flecha es lo que
    // vuelve determinista este movimiento: dnd-kit resuelve la columna de
    // destino en el frame siguiente, así que un Space disparado de inmediato
    // soltaba la tarjeta sobre la columna de origen. Una persona nunca teclea
    // tan rápido; Playwright sí.
    const anuncio = this.page.locator("[role='status']").first();
    await handle.focus();
    await this.page.keyboard.press("Space");
    for (let i = 0; i < steps; i += 1) {
      const previo = (await anuncio.textContent()) ?? "";
      await this.page.keyboard.press(direction);
      await expect(anuncio).not.toHaveText(previo);
    }
    await this.page.keyboard.press("Space");
  }
}
