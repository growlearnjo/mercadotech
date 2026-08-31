// Smoke de la tubería E2E (Fase 6.4).
//
// No prueba negocio: prueba que el circo está montado — el webServer levanta,
// el navegador abre la app, la home renderiza contra el Supabase local con el
// seed, y los Page Objects encuentran sus `data-testid`. Si este spec falla,
// ningún otro va a decir nada útil.

import { test, expect } from "@/e2e/fixtures/test";

test.describe("Home", () => {
  test("carga y muestra el grid de productos del seed", async ({
    page,
    catalogPage,
  }) => {
    await catalogPage.goto();

    await expect(page).toHaveTitle(/MercadoTech/i);
    await expect(catalogPage.grid()).toBeVisible();
    // El seed publica 14 productos activos y la página muestra 12 (page size).
    await expect(catalogPage.cards().first()).toBeVisible();
    expect(await catalogPage.cards().count()).toBeGreaterThan(0);
  });

  test("un visitante sin sesión ve el acceso a Ingresar, no el menú de usuario", async ({
    page,
    catalogPage,
  }) => {
    await catalogPage.goto();

    await expect(page.getByTestId("nav-login")).toBeVisible();
    await expect(page.getByTestId("user-menu")).toHaveCount(0);
  });
});
