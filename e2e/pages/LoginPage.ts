// Page Object de /login (Fase 6.4).
//
// Un Page Object encapsula UNA pantalla: si mañana cambia el markup, se
// corrige aquí y no en los cinco specs que la usan. Los localizadores van
// SIEMPRE por `data-testid` o por rol accesible — nunca por clase CSS ni por
// un texto largo, que cambian con cada retoque de copy.

import type { Page } from "@playwright/test";

import type { TestUser } from "@/e2e/data/users";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  /** Inicia sesión y espera a que el menú de usuario confirme la sesión. */
  async login(user: TestUser): Promise<void> {
    await this.goto();
    await this.page.getByTestId("login-email").fill(user.email);
    await this.page.getByTestId("login-password").fill(user.password);
    await this.page.getByTestId("login-submit").click();
    // Esperar por un estado observable, no por un tiempo fijo: el avatar del
    // menú solo aparece cuando `useAuth` ya resolvió la sesión.
    await this.page.getByTestId("user-menu").waitFor();
  }

  /** Rellena y envía sin esperar sesión: para los casos de credencial inválida. */
  async submit(email: string, password: string): Promise<void> {
    await this.page.getByTestId("login-email").fill(email);
    await this.page.getByTestId("login-password").fill(password);
    await this.page.getByTestId("login-submit").click();
  }

  error() {
    return this.page.getByTestId("login-error");
  }
}
