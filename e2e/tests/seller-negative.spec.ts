// Negativos del vendedor (Fase 6.6): lo que el panel debe IMPEDIR.
//
// Dos barreras distintas: el ROL (un comprador no entra al panel) y la
// SECUENCIA del kanban (un pedido no retrocede). La segunda vive en el hook,
// no en la RLS — que aceptaría el destino sin mirar el orden. Este spec es la
// comprobación de que esa regla llega hasta la pantalla.

import { expect, test } from "@/e2e/fixtures/test";
import { BUYER1, SEED_ORDERS, SELLER2 } from "@/e2e/data/users";

test.describe("Vendedor — casos negativos", () => {
  test("un comprador que entra a /vendedor/productos es expulsado del panel", async ({
    page,
    loginAs,
  }) => {
    await loginAs(BUYER1);
    await page.goto("/vendedor/productos");

    // El middleware solo garantiza SESIÓN; el rol lo comprueba el layout del
    // panel, que redirige a la tienda y avisa con un toast.
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Necesitas una cuenta de vendedor")).toBeVisible();
    await expect(page.getByTestId("seller-products-table")).toHaveCount(0);
  });

  // Bloqueado por el HALLAZGO de accesibilidad documentado en
  // seller-flow.spec.ts: una pulsación de flecha no saca la tarjeta de su
  // columna, así que el intento de retroceso ni siquiera llega a producirse y
  // el toast no aparece. La regla en sí SÍ está cubierta sin navegador, en
  // hooks/useSellerOrders.test.ts ("rechaza retroceder de …").
  test.fixme("un pedido 'enviado' no puede retroceder a 'pagado': toast y la tarjeta no se mueve", async ({
    page,
    loginAs,
    sellerKanbanPage,
  }) => {
    // c…04 está 'enviado' en el seed y tiene un ítem de seller2.
    const pedido = SEED_ORDERS.enviadoMultiVendedor;

    await loginAs(SELLER2);
    await sellerKanbanPage.goto();
    await expect(sellerKanbanPage.cardInColumn(pedido, "enviado")).toBeVisible();

    await sellerKanbanPage.moveByKeyboard(pedido, "ArrowLeft");

    // El mensaje sale de validateTransition, la misma función que cubre
    // hooks/useSellerOrders.test.ts sin navegador.
    await expect(page.getByText(/avanza de a un paso/)).toBeVisible();
    await expect(sellerKanbanPage.cardInColumn(pedido, "enviado")).toBeVisible();
    await expect(sellerKanbanPage.cardInColumn(pedido, "pagado")).toHaveCount(0);
  });

  test("la columna 'cancelado' es de solo lectura: sus tarjetas no tienen asa", async ({
    loginAs,
    sellerKanbanPage,
  }) => {
    await loginAs(SELLER2);
    await sellerKanbanPage.goto();

    // Cancelar es cosa del comprador (decisión 9): la RLS solo admite
    // pagado/enviado/entregado como destino del vendedor.
    await expect(sellerKanbanPage.column("cancelado")).toContainText(
      "Solo lectura",
    );
  });
});
