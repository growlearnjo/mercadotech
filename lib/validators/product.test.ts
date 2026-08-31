// Tests de lib/validators/product.ts (Fase 6.2).
//
// El contrato que se prueba no es solo "ok: false", sino que el error caiga
// en el CAMPO correcto: el formulario pinta el mensaje junto a su input, y un
// error en la llave equivocada se ve como un formulario que no explica nada.

import { describe, expect, it } from "vitest";

import { validateProduct, type ProductInput } from "@/lib/validators/product";
import { TITLE_MAX, TITLE_MIN } from "@/lib/constants/product";
import { PRODUCT_CONDITIONS } from "@/lib/constants/roles";

const okProduct: ProductInput = {
  title: "Laptop Lenovo IdeaPad 3",
  description: "14 pulgadas, 8 GB RAM, SSD 512 GB.",
  brand: "Lenovo",
  categoryId: "a0000000-0000-4000-8000-000000000001",
  condition: "nuevo",
  price: 2199.9,
  stock: 5,
  imageCount: 3,
};

describe("validateProduct — caso feliz", () => {
  it("acepta un producto completo sin ningún error", () => {
    const result = validateProduct(okProduct);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it.each(PRODUCT_CONDITIONS)("acepta la condición %s", (condition) => {
    expect(validateProduct({ ...okProduct, condition }).ok).toBe(true);
  });

  it("mide el título DESPUÉS del trim", () => {
    const soloEspacios = validateProduct({ ...okProduct, title: `   ${"a".repeat(TITLE_MIN - 1)}   ` });

    expect(soloEspacios.ok).toBe(false);
    expect(soloEspacios.errors.title).toBeDefined();
  });
});

describe("validateProduct — título", () => {
  it(`rechaza ${TITLE_MIN - 1} caracteres y acepta ${TITLE_MIN}`, () => {
    const corto = validateProduct({ ...okProduct, title: "a".repeat(TITLE_MIN - 1) });
    const justo = validateProduct({ ...okProduct, title: "a".repeat(TITLE_MIN) });

    expect(corto.ok).toBe(false);
    expect(corto.errors.title).toContain(String(TITLE_MIN));
    expect(justo.ok).toBe(true);
  });

  it(`acepta ${TITLE_MAX} caracteres y rechaza ${TITLE_MAX + 1}`, () => {
    const justo = validateProduct({ ...okProduct, title: "a".repeat(TITLE_MAX) });
    const largo = validateProduct({ ...okProduct, title: "a".repeat(TITLE_MAX + 1) });

    expect(justo.ok).toBe(true);
    expect(largo.ok).toBe(false);
    expect(largo.errors.title).toContain(String(TITLE_MAX));
  });
});

describe("validateProduct — categoría y condición", () => {
  it("rechaza sin categoría, en el campo categoryId", () => {
    const result = validateProduct({ ...okProduct, categoryId: "" });

    expect(result.ok).toBe(false);
    expect(result.errors.categoryId).toBe("Elige una categoría.");
    expect(result.errors.title).toBeUndefined();
  });

  it("rechaza una condición fuera de PRODUCT_CONDITIONS", () => {
    const result = validateProduct({ ...okProduct, condition: "roto" as never });

    expect(result.ok).toBe(false);
    expect(result.errors.condition).toBe("Elige la condición del producto.");
  });
});

describe("validateProduct — precio", () => {
  it("rechaza precio 0 y negativo", () => {
    expect(validateProduct({ ...okProduct, price: 0 }).errors.price).toBeDefined();
    expect(validateProduct({ ...okProduct, price: -1 }).errors.price).toBeDefined();
  });

  it("rechaza precio no finito (NaN o Infinity, lo que devuelve un input vacío)", () => {
    expect(validateProduct({ ...okProduct, price: Number.NaN }).errors.price).toBeDefined();
    expect(
      validateProduct({ ...okProduct, price: Number.POSITIVE_INFINITY }).errors.price,
    ).toBeDefined();
  });

  it("acepta el mínimo positivo con decimales", () => {
    expect(validateProduct({ ...okProduct, price: 0.01 }).ok).toBe(true);
  });
});

describe("validateProduct — stock", () => {
  it("acepta 0: un producto agotado sigue siendo publicable", () => {
    expect(validateProduct({ ...okProduct, stock: 0 }).ok).toBe(true);
  });

  it("rechaza stock negativo", () => {
    const result = validateProduct({ ...okProduct, stock: -1 });

    expect(result.ok).toBe(false);
    expect(result.errors.stock).toBe("El stock debe ser 0 o más.");
  });

  it("rechaza stock decimal: no se venden medias laptops", () => {
    expect(validateProduct({ ...okProduct, stock: 1.5 }).errors.stock).toBeDefined();
  });
});

describe("validateProduct — imágenes", () => {
  it("rechaza 0 imágenes y acepta 1", () => {
    const sin = validateProduct({ ...okProduct, imageCount: 0 });

    expect(sin.ok).toBe(false);
    expect(sin.errors.imageCount).toBe("Agrega al menos una imagen.");
    expect(validateProduct({ ...okProduct, imageCount: 1 }).ok).toBe(true);
  });
});

describe("validateProduct — errores acumulados", () => {
  it("reporta TODOS los campos rotos de una vez, no solo el primero", () => {
    const result = validateProduct({
      ...okProduct,
      title: "SSD",
      categoryId: "",
      condition: "roto" as never,
      price: 0,
      stock: -3,
      imageCount: 0,
    });

    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual([
      "categoryId",
      "condition",
      "imageCount",
      "price",
      "stock",
      "title",
    ]);
  });
});
