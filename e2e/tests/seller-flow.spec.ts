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
 * HALLAZGO DE ACCESIBILIDAD DE LA FASE 6.6 — CERRADO EN LA FASE 7.2.
 *
 * QUÉ PASABA: `OrdersKanban` registraba el `KeyboardSensor` de dnd-kit sin
 * `coordinateGetter`. El getter por defecto mueve la tarjeta 25 px por
 * pulsación, sin noción de columnas; como las columnas miden 240 px más 12 de
 * separación, UNA pulsación de ArrowRight dejaba la tarjeta dentro de su
 * propia columna. Hacían falta ~14 pulsaciones para cruzar.
 *
 * EL FIX NO ERA DE UNA LÍNEA, como suponía la spec de la 7. Pasar
 * `sortableKeyboardCoordinates` —lo que hace la galería— NO funciona aquí: ese
 * getter arranca con `droppableContainers.get(active.id)` y abandona si no
 * encuentra nada, y solo `useSortable` registra un elemento como draggable Y
 * droppable a la vez. En el kanban las tarjetas son `useDraggable` y los
 * droppables son las columnas, así que devolvía `undefined` y la tarjeta no se
 * movía ni un pixel. `OrdersKanban` lleva ahora un getter propio de columnas,
 * documentado en el componente.
 *
 * Y EL TEST TAMPOCO ERA GRATIS: dnd-kit resuelve la columna de destino en el
 * frame siguiente a la flecha, así que el Space de soltar —disparado por
 * Playwright en el mismo milisegundo— soltaba sobre la columna de ORIGEN.
 * `moveByKeyboard` espera a que cambie el anuncio aria-live de dnd-kit; el
 * porqué está en el page object.
 *
 * Con eso, los dos tests que estaban en `test.fixme` desde la 6.6 (este y el
 * de retroceso en seller-negative.spec.ts) pasan tal como fueron escritos. El
 * tercer test —el que documentaba el defecto afirmando que una flecha NO
 * cambia de columna— se borró: hoy afirma lo contrario de lo correcto.
 */
test.describe("Flujo del vendedor — kanban por teclado", () => {
  test(
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
