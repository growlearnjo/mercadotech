// E2E del flujo del comprador (Fase 6.5).
//
// PRERREQUISITO: `supabase db reset` antes de la corrida. El spec CREA un
// pedido real, y todas sus aserciones son sobre ESE pedido, identificado por
// el id que devuelve la URL de redirección del checkout — nunca "el primero
// de la lista", que cambia en cuanto otro spec compra antes.
//
// Ninguna aserción sobre respuestas de IA (decisión 8): este flujo no visita
// /asistente ni la pestaña de resultados con IA.

import { expect, test } from "@/e2e/fixtures/test";
import { BUYER1, SEED_CATEGORY_LAPTOPS, SEED_PRODUCTS } from "@/e2e/data/users";
import { formatPrice } from "@/lib/utils";

/**
 * Precio y stock del seed para la laptop que se compra. Se citan aquí para
 * poder calcular el subtotal esperado, pero el FORMATO sale siempre de
 * `formatPrice`: escribirlo a mano fallaría por el espacio duro que Intl
 * mete entre "S/" y la cifra.
 */
const LAPTOP = {
  id: SEED_PRODUCTS.laptopConStock,
  title: 'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD',
  price: 2199,
};
const CANTIDAD = 2;

test.describe("Flujo del comprador", () => {
  test("compra completa: login → filtrar → agregar → checkout → pedido → logout", async ({
    page,
    loginAs,
    catalogPage,
    productPage,
    cartPage,
    ordersPage,
  }) => {
    await test.step("1. inicia sesión y ve su menú de usuario", async () => {
      await loginAs(BUYER1);
      await expect(page.getByTestId("user-menu")).toBeVisible();
      await expect(page.getByTestId("nav-login")).toHaveCount(0);
    });

    await test.step("2. filtra por Laptops y el grid solo muestra laptops", async () => {
      await catalogPage.gotoCategory(SEED_CATEGORY_LAPTOPS.slug);
      await expect(catalogPage.grid()).toBeVisible();
      // El seed tiene 3 laptops, una de ellas inactiva: el catálogo público
      // muestra las 2 activas.
      await expect(catalogPage.cards()).toHaveCount(2);
      await expect(catalogPage.cardByTitle(LAPTOP.title)).toBeVisible();
    });

    await test.step("3. abre un producto CON stock y ve precio y galería", async () => {
      await productPage.goto(LAPTOP.id);
      await expect(productPage.price()).toHaveText(formatPrice(LAPTOP.price));
      await expect(productPage.gallery()).toBeVisible();
      await expect(productPage.addToCartButton()).toBeEnabled();
      await expect(productPage.blockedReason()).toHaveCount(0);
    });

    await test.step(`4. agrega ${CANTIDAD} unidades y el contador del navbar marca ${CANTIDAD}`, async () => {
      await productPage.addToCart(CANTIDAD);
      await expect(page.getByTestId("cart-count")).toHaveText(String(CANTIDAD));
    });

    await test.step("5. el carrito muestra la línea y el subtotal correcto", async () => {
      await cartPage.goto();
      await expect(cartPage.items()).toHaveCount(1);
      await expect(cartPage.itemCount()).toContainText(String(CANTIDAD));
      await expect(cartPage.total()).toHaveText(formatPrice(LAPTOP.price * CANTIDAD));
      await expect(cartPage.checkoutButton()).toBeEnabled();
      await expect(cartPage.disabledReason()).toHaveCount(0);
    });

    let orderId = "";

    await test.step("6. finaliza la compra y aterriza en el pedido recién creado", async () => {
      orderId = await cartPage.checkout();
      expect(orderId).toMatch(/^[0-9a-f-]{36}$/);

      await expect(ordersPage.title()).toContainText(orderId.slice(0, 8));
      // El checkout es SIMULADO: crea el pedido en 'pendiente' y descuenta
      // stock, sin cobrar nada.
      await expect(ordersPage.status()).toHaveText("Pendiente");
      // El snapshot congela título y precio al momento de la compra.
      await expect(ordersPage.itemRows()).toHaveCount(1);
      await expect(ordersPage.itemRows().first()).toContainText(LAPTOP.title);
      await expect(ordersPage.itemRows().first()).toContainText(String(CANTIDAD));
      await expect(ordersPage.total()).toHaveText(formatPrice(LAPTOP.price * CANTIDAD));
    });

    await test.step("7. el pedido aparece en 'Mis pedidos', identificado por su id", async () => {
      await ordersPage.gotoList();
      await expect(ordersPage.cardFor(orderId)).toBeVisible();
      await expect(ordersPage.cardFor(orderId)).toContainText("Pendiente");
    });

    await test.step("8. el carrito quedó vacío tras el checkout", async () => {
      // El RPC vacía el carrito dentro de la misma transacción.
      await cartPage.goto();
      await expect(cartPage.emptyState()).toBeVisible();
      await expect(page.getByTestId("cart-count")).toHaveCount(0);
    });

    await test.step("9. cierra sesión y el navbar vuelve a estado anónimo", async () => {
      await page.getByTestId("user-menu").click();
      await page.getByTestId("user-menu-logout").click();
      await expect(page.getByTestId("nav-login")).toBeVisible();
      await expect(page.getByTestId("user-menu")).toHaveCount(0);
    });
  });
});
