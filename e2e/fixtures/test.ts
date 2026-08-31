// Fixture compartida de los E2E (Fase 6.4).
//
// Extiende el `test` de Playwright con los Page Objects ya construidos y con
// un helper de login. Cada test recibe un contexto de navegador LIMPIO: no se
// comparte sesión entre specs (nada de `storageState` global), porque un
// spec que dependa del login de otro falla en cuanto cambia el orden o se
// corre uno solo.

import { test as base, expect } from "@playwright/test";

import { CartPage } from "@/e2e/pages/CartPage";
import { CatalogPage } from "@/e2e/pages/CatalogPage";
import { LoginPage } from "@/e2e/pages/LoginPage";
import { OrdersPage } from "@/e2e/pages/OrdersPage";
import { ProductPage } from "@/e2e/pages/ProductPage";
import { SellerKanbanPage } from "@/e2e/pages/SellerKanbanPage";
import { SellerProductsPage } from "@/e2e/pages/SellerProductsPage";
import type { TestUser } from "@/e2e/data/users";

type Pages = {
  loginPage: LoginPage;
  catalogPage: CatalogPage;
  productPage: ProductPage;
  cartPage: CartPage;
  ordersPage: OrdersPage;
  sellerProductsPage: SellerProductsPage;
  sellerKanbanPage: SellerKanbanPage;
  /** Inicia sesión con un usuario del seed y deja la sesión lista. */
  loginAs: (user: TestUser) => Promise<void>;
};

export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  catalogPage: async ({ page }, use) => {
    await use(new CatalogPage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  ordersPage: async ({ page }, use) => {
    await use(new OrdersPage(page));
  },
  sellerProductsPage: async ({ page }, use) => {
    await use(new SellerProductsPage(page));
  },
  sellerKanbanPage: async ({ page }, use) => {
    await use(new SellerKanbanPage(page));
  },
  loginAs: async ({ loginPage }, use) => {
    await use((user: TestUser) => loginPage.login(user));
  },
});

export { expect };
