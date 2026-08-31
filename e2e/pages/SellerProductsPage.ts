// Page Object de /vendedor/productos y /vendedor/publicar (Fase 6.4).

import path from "node:path";

import type { Locator, Page } from "@playwright/test";

import type { ProductCondition } from "@/lib/constants/roles";

/**
 * Imagen de fixture del repo: JPEG de 8×8 válido, 353 bytes.
 *
 * Se resuelve con `__dirname` y no con `import.meta.url`: Playwright carga
 * estos archivos como CommonJS (la raíz no declara `"type": "module"`) y
 * `import.meta` ahí es un error de sintaxis, no un warning.
 */
export const FIXTURE_IMAGE = path.join(__dirname, "..", "data", "product-image.jpg");

export type NewProduct = {
  title: string;
  brand?: string;
  categoryLabel: string;
  condition?: ProductCondition;
  price: string;
  stock: string;
};

export class SellerProductsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/vendedor/productos");
  }

  async gotoPublish(): Promise<void> {
    await this.page.goto("/vendedor/publicar");
    await this.page.getByTestId("product-form-title").waitFor();
  }

  table(): Locator {
    return this.page.getByTestId("seller-products-table");
  }

  rows(): Locator {
    return this.page.getByTestId("seller-product-row");
  }

  rowFor(title: string): Locator {
    return this.rows().filter({ hasText: title });
  }

  /**
   * Rellena el formulario de publicación con la imagen de fixture y envía.
   *
   * El `<input type="file">` está oculto con `sr-only` para que el diseño use
   * su propio botón; `setInputFiles` no necesita que sea visible, así que se
   * ataca directo en vez de simular el clic del botón.
   */
  async publish(product: NewProduct): Promise<void> {
    await this.gotoPublish();
    await this.page.getByTestId("product-form-title").fill(product.title);
    if (product.brand) {
      await this.page.getByTestId("product-form-brand").fill(product.brand);
    }
    await this.page
      .getByTestId("product-form-category")
      .selectOption({ label: product.categoryLabel });
    if (product.condition) {
      await this.page
        .getByTestId("product-form-condition")
        .selectOption(product.condition);
    }
    await this.page.getByTestId("product-form-price").fill(product.price);
    await this.page.getByTestId("product-form-stock").fill(product.stock);
    await this.page.getByTestId("product-form-images").setInputFiles(FIXTURE_IMAGE);
    await this.page.getByTestId("product-form-submit").click();
  }

  formError(): Locator {
    return this.page.getByTestId("product-form-error");
  }
}
