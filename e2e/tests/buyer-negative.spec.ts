// Negativos del comprador (Fase 6.5): lo que la tienda debe IMPEDIR.
//
// Los tres casos protegen el checkout desde ángulos distintos: sin stock, sin
// carrito y sin sesión. Ninguno crea datos, así que no dependen del reset —
// pero sí conviven con el flujo feliz en la misma corrida.

import { expect, test } from "@/e2e/fixtures/test";
import { BUYER1, SEED_PRODUCTS } from "@/e2e/data/users";

test.describe("Comprador — casos negativos", () => {
  test("un producto sin stock no se puede agregar, y dice por qué", async ({
    loginAs,
    productPage,
  }) => {
    await loginAs(BUYER1);
    // Monitor Samsung Odyssey: ACTIVO (se ve en el catálogo) pero con stock 0.
    await productPage.goto(SEED_PRODUCTS.sinStock);

    await expect(productPage.addToCartButton()).toBeDisabled();
    // Un botón gris sin explicación es una pared; el motivo es parte del
    // contrato de la pantalla.
    await expect(productPage.blockedReason()).toBeVisible();
    await expect(productPage.blockedReason()).toHaveText("Sin stock por ahora.");
  });

  test("el producto sin stock sí aparece en el catálogo, marcado 'Sin stock'", async ({
    catalogPage,
  }) => {
    await catalogPage.gotoCategory("monitores");

    // Sigue activo a propósito: se avisa EN LA CARD para no llevar a nadie a
    // un detalle donde no puede comprar.
    const card = catalogPage.cards().filter({ hasText: "Samsung Odyssey" });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("product-card-out-of-stock")).toBeVisible();
  });

  test("con el carrito vacío no hay checkout que pulsar", async ({
    loginAs,
    cartPage,
  }) => {
    await loginAs(BUYER1);
    await cartPage.goto();

    // La UI real no pinta el resumen con el botón deshabilitado: pinta un
    // EmptyState y el botón no existe. Se afirma lo que la app hace.
    await expect(cartPage.emptyState()).toBeVisible();
    await expect(cartPage.checkoutButton()).toHaveCount(0);
    await expect(cartPage.summary()).toHaveCount(0);
  });

  test("un anónimo en /carrito acaba en /login con su redirectTo", async ({
    page,
  }) => {
    await page.goto("/carrito");

    // Lo impone el middleware, antes de que la página llegue a renderizarse.
    await expect(page).toHaveURL("/login?redirectTo=%2Fcarrito");
    await expect(page.getByTestId("login-submit")).toBeVisible();
  });

  test("el detalle de producto SÍ es público: no exige sesión", async ({
    productPage,
    page,
  }) => {
    await productPage.goto(SEED_PRODUCTS.laptopConStock);

    await expect(page).toHaveURL(`/producto/${SEED_PRODUCTS.laptopConStock}`);
    await expect(productPage.buyBox()).toBeVisible();
  });
});
