// E2E del flujo del vendedor (Fase 6.6).
//
// QUÉ VENDEDOR Y POR QUÉ (leído del seed, no asumido): el ÚNICO pedido en
// estado 'pagado' es c…03, y pertenece a seller2 (GamerZone Lima), comprado
// por buyer2. Por eso el kanban se prueba con SELLER2 y la vuelta del
// comprador con BUYER2. Usar seller1 aquí habría dado una columna 'pagado'
// vacía y un test verde que no probaba nada.
//
// EL KANBAN SE MUEVE POR TECLADO (decisión 9). No es una comodidad: si el
// camino de teclado deja de funcionar, la accesibilidad murió aunque el mouse
// siga arrastrando. Ver el HALLAZGO documentado más abajo.
//
// PRERREQUISITO: `supabase db reset` antes de la corrida.

import { expect, test } from "@/e2e/fixtures/test";
import { BUYER2, SEED_ORDERS, SELLER2 } from "@/e2e/data/users";

/** Título único por corrida: el producto publicado sobrevive hasta el reset. */
function tituloUnico(): string {
  return `Webcam E2E Logitech ${Date.now()}`;
}

test.describe("Flujo del vendedor", () => {
  test("publica un producto y lo ve en su tabla y en el catálogo público", async ({
    page,
    loginAs,
    sellerProductsPage,
    catalogPage,
  }) => {
    const titulo = tituloUnico();

    await test.step("1. inicia sesión y entra a su panel", async () => {
      await loginAs(SELLER2);
      await sellerProductsPage.goto();
      await expect(sellerProductsPage.table()).toBeVisible();
    });

    await test.step("2. publica un producto con imagen", async () => {
      const productId = await sellerProductsPage.publish({
        title: titulo,
        brand: "Logitech",
        categoryLabel: "Accesorios",
        condition: "nuevo",
        price: "199.90",
        stock: "5",
      });

      // Comportamiento real: publicar lleva a la pantalla de EDICIÓN del
      // producto nuevo, no al listado — las imágenes necesitan el product_id
      // para respetar la política del bucket.
      expect(productId).toMatch(/^[0-9a-f-]{36}$/);
      await expect(page).toHaveURL(`/vendedor/productos/${productId}/editar`);
      await expect(sellerProductsPage.formError()).toHaveCount(0);
    });

    await test.step("3. aparece en SU tabla", async () => {
      await sellerProductsPage.goto();
      await expect(sellerProductsPage.rowFor(titulo)).toBeVisible();
      await expect(sellerProductsPage.rowFor(titulo)).toContainText("Publicado");
    });

    await test.step("4. y también en el catálogo público de su categoría", async () => {
      await catalogPage.gotoCategory("accesorios");
      await expect(catalogPage.cardByTitle(titulo)).toBeVisible();
    });
  });
});

/**
 * HALLAZGO DE ACCESIBILIDAD (Fase 6.6, decisión 9) — el camino de teclado del
 * kanban NO funciona en la práctica.
 *
 * QUÉ PASA: `OrdersKanban` registra el `KeyboardSensor` de dnd-kit pero NO le
 * pasa un `coordinateGetter`. El getter por defecto de la librería mueve la
 * tarjeta 25 px por pulsación de flecha, sin ninguna noción de columnas. Las
 * columnas miden `min-w-60` (240 px) más 12 px de separación, así que UNA
 * pulsación de ArrowRight deja la tarjeta dentro de su propia columna, y al
 * soltar dnd-kit anuncia literalmente:
 *
 *   "Draggable item c0000000-…-03 was dropped over droppable area pagado"
 *
 * Comprobado empíricamente: con 14 pulsaciones seguidas (≈350 px) la tarjeta
 * sí cruza y el cambio persiste. Ningún usuario de teclado va a descubrir eso.
 *
 * POR QUÉ ES UN DEFECTO Y NO UNA LIMITACIÓN DEL TEST: el otro drag & drop del
 * proyecto, `SortableImageGallery`, SÍ pasa `coordinateGetter:
 * sortableKeyboardCoordinates`. La galería es accesible por teclado; el
 * kanban no. La diferencia es una línea.
 *
 * QUÉ NO SE HIZO: resolverlo con `mouse.down/move/up` está prohibido por la
 * decisión 9 — enmascararía justo lo que este test existe para detectar. Y
 * corregir `OrdersKanban.tsx` es cambio de producción, fuera del alcance de
 * una fase de testing.
 *
 * CUANDO SE CORRIJA: borrar el test que documenta el defecto y quitar el
 * `test.fixme` de los dos tests marcados (aquí y en seller-negative.spec.ts).
 * Están escritos completos y deberían pasar tal cual.
 */
test.describe("Flujo del vendedor — kanban por teclado", () => {
  test("documenta el defecto: una pulsación de flecha NO cambia de columna", async ({
    loginAs,
    sellerKanbanPage,
  }) => {
    const pedido = SEED_ORDERS.pagadoDeSeller2;

    await loginAs(SELLER2);
    await sellerKanbanPage.goto();
    await expect(sellerKanbanPage.cardInColumn(pedido, "pagado")).toBeVisible();

    await sellerKanbanPage.moveByKeyboard(pedido, "ArrowRight");

    // Comportamiento actual, revisar: la tarjeta se levanta y se suelta sobre
    // SU MISMA columna. Este test se vuelve rojo el día que se agregue el
    // `coordinateGetter`, que es exactamente cuando hay que borrarlo y
    // habilitar el de abajo.
    await expect(sellerKanbanPage.cardInColumn(pedido, "pagado")).toBeVisible();
    await expect(sellerKanbanPage.cardInColumn(pedido, "enviado")).toHaveCount(0);
  });

  test.fixme(
    "mueve el pedido 'pagado' a 'enviado' POR TECLADO y el cambio persiste",
    async ({ page, loginAs, sellerKanbanPage, ordersPage }) => {
      const pedido = SEED_ORDERS.pagadoDeSeller2;

      await test.step("1. seller2 abre su kanban y ve el pedido en 'pagado'", async () => {
        await loginAs(SELLER2);
        await sellerKanbanPage.goto();
        await expect(sellerKanbanPage.cardInColumn(pedido, "pagado")).toBeVisible();
        await expect(sellerKanbanPage.cardInColumn(pedido, "enviado")).toHaveCount(0);
      });

      await test.step("2. lo mueve con Space → ArrowRight → Space", async () => {
        await sellerKanbanPage.moveByKeyboard(pedido, "ArrowRight");
        await expect(sellerKanbanPage.cardInColumn(pedido, "enviado")).toBeVisible();
        await expect(sellerKanbanPage.cardInColumn(pedido, "pagado")).toHaveCount(0);
      });

      await test.step("3. PERSISTE tras recargar", async () => {
        // El hook mueve la tarjeta de forma optimista: sin el reload, el test
        // estaría afirmando el estado de React, no el de la base de datos.
        await page.reload();
        await expect(sellerKanbanPage.cardInColumn(pedido, "enviado")).toBeVisible();
      });

      await test.step("4. el comprador de ese pedido ve 'Enviado' en su detalle", async () => {
        await page.getByTestId("user-menu").click();
        await page.getByTestId("user-menu-logout").click();
        await expect(page.getByTestId("nav-login")).toBeVisible();

        await loginAs(BUYER2);
        await ordersPage.gotoDetail(pedido);
        await expect(ordersPage.status()).toHaveText("Enviado");
      });
    },
  );
});
