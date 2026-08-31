// Page Object de la home y de /categoria/[slug] (Fase 6.4).
//
// Ambas pantallas pintan el MISMO grid con el mismo panel de filtros, así que
// comparten Page Object: duplicarlo obligaría a corregir dos archivos por
// cada cambio del catálogo.

import type { Locator, Page } from "@playwright/test";

import type { ProductCondition } from "@/lib/constants/roles";
import type { SortOption } from "@/lib/constants/catalog";

export class CatalogPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.grid().waitFor();
  }

  async gotoCategory(slug: string): Promise<void> {
    await this.page.goto(`/categoria/${slug}`);
  }

  grid(): Locator {
    return this.page.getByTestId("product-grid");
  }

  cards(): Locator {
    return this.page.getByTestId("product-card");
  }

  emptyState(): Locator {
    return this.page.getByTestId("empty-state");
  }

  /** Card por su título visible; el título es el ancla natural del catálogo. */
  cardByTitle(title: string): Locator {
    return this.cards().filter({ hasText: title });
  }

  /** Abre el detalle del producto en la posición indicada del grid. */
  async openCard(index = 0): Promise<void> {
    await this.cards().nth(index).click();
  }

  /** Ids de producto de las cards visibles, leídos de su href. */
  async visibleProductIds(): Promise<string[]> {
    const hrefs = await this.cards().evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href") ?? ""),
    );
    return hrefs.map((href) => href.replace("/producto/", ""));
  }

  async filterByCondition(condition: ProductCondition): Promise<void> {
    await this.page.getByTestId(`filter-condition-${condition}`).check();
  }

  async sortBy(sort: SortOption): Promise<void> {
    await this.page.getByTestId(`filter-sort-${sort}`).check();
  }

  async clearFilters(): Promise<void> {
    await this.page.getByTestId("filters-clear").click();
  }
}
