// Tests de lib/validators/auth.ts (Fase 6.2).
//
// Lógica pura: cero mocks, cero red. Los valores frontera se importan de las
// constantes reales — si mañana PASSWORD_MIN_LENGTH sube a 10, estos tests
// siguen probando "uno menos / justo el mínimo" sin tocarse.

import { describe, expect, it } from "vitest";

import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  REGISTRABLE_ROLES,
  isUserRole,
  validateLogin,
  validateRegister,
  type RegisterInput,
} from "@/lib/validators/auth";
import { USER_ROLES } from "@/lib/constants/roles";

/** Entrada de registro válida; cada test rompe UN campo a la vez. */
const okRegister: RegisterInput = {
  email: "buyer1@mercadotech.test",
  password: "a".repeat(PASSWORD_MIN_LENGTH),
  displayName: "Ana Compradora",
  role: "buyer",
};

const okLogin = { email: okRegister.email, password: okRegister.password };

describe("validateLogin", () => {
  it("acepta credenciales válidas y devuelve el email recortado", () => {
    const result = validateLogin({ ...okLogin, email: "  buyer1@mercadotech.test  " });

    expect(result.ok).toBe(true);
    // El trim vive en el validador para que el service no reciba espacios.
    if (result.ok) expect(result.value.email).toBe("buyer1@mercadotech.test");
  });

  it("no toca la contraseña (los espacios pueden ser parte de ella)", () => {
    const result = validateLogin({ ...okLogin, password: " secreto123 " });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.password).toBe(" secreto123 ");
  });

  it("rechaza email vacío o solo espacios con el mensaje de campo faltante", () => {
    const vacio = validateLogin({ ...okLogin, email: "" });
    const espacios = validateLogin({ ...okLogin, email: "   " });

    expect(vacio.ok).toBe(false);
    expect(espacios.ok).toBe(false);
    if (!vacio.ok) expect(vacio.errors.email).toBe("Ingresa tu correo.");
    if (!espacios.ok) expect(espacios.errors.email).toBe("Ingresa tu correo.");
  });

  it.each([["sin-arroba.test"], ["sin@dominio"], ["con espacio@x.test"], ["@x.test"]])(
    "rechaza el email mal formado %s",
    (email) => {
      const result = validateLogin({ ...okLogin, email });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.email).toBe("Ese correo no parece válido.");
    },
  );

  it("rechaza contraseña vacía con un mensaje distinto al de longitud", () => {
    const result = validateLogin({ ...okLogin, password: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.password).toBe("Ingresa tu contraseña.");
  });

  it(`rechaza password de ${PASSWORD_MIN_LENGTH - 1} y acepta de ${PASSWORD_MIN_LENGTH}`, () => {
    const corta = validateLogin({
      ...okLogin,
      password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    });
    const justa = validateLogin({
      ...okLogin,
      password: "a".repeat(PASSWORD_MIN_LENGTH),
    });

    expect(corta.ok).toBe(false);
    if (!corta.ok) {
      expect(corta.errors.password).toContain(String(PASSWORD_MIN_LENGTH));
    }
    expect(justa.ok).toBe(true);
  });

  it("acumula los errores de los dos campos a la vez", () => {
    const result = validateLogin({ email: "roto", password: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
    }
  });
});

describe("validateRegister", () => {
  it.each(REGISTRABLE_ROLES)("acepta el caso feliz con rol %s", (role) => {
    const result = validateRegister({ ...okRegister, role });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.role).toBe(role);
      expect(result.value.displayName).toBe("Ana Compradora");
    }
  });

  it("recorta el display_name antes de devolverlo", () => {
    const result = validateRegister({ ...okRegister, displayName: "  Ana  " });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.displayName).toBe("Ana");
  });

  it("hereda las validaciones de email y contraseña del login", () => {
    const result = validateRegister({ ...okRegister, email: "roto", password: "x" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBe("Ese correo no parece válido.");
      expect(result.errors.password).toBeDefined();
    }
  });

  it(`rechaza display_name de ${DISPLAY_NAME_MIN_LENGTH - 1} y acepta de ${DISPLAY_NAME_MIN_LENGTH}`, () => {
    const corto = validateRegister({
      ...okRegister,
      displayName: "a".repeat(DISPLAY_NAME_MIN_LENGTH - 1),
    });
    const justo = validateRegister({
      ...okRegister,
      displayName: "a".repeat(DISPLAY_NAME_MIN_LENGTH),
    });

    expect(corto.ok).toBe(false);
    if (!corto.ok) {
      expect(corto.errors.displayName).toContain(String(DISPLAY_NAME_MIN_LENGTH));
    }
    expect(justo.ok).toBe(true);
  });

  it(`acepta display_name de ${DISPLAY_NAME_MAX_LENGTH} y rechaza de ${DISPLAY_NAME_MAX_LENGTH + 1}`, () => {
    const justo = validateRegister({
      ...okRegister,
      displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH),
    });
    const largo = validateRegister({
      ...okRegister,
      displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1),
    });

    expect(justo.ok).toBe(true);
    expect(largo.ok).toBe(false);
    if (!largo.ok) {
      expect(largo.errors.displayName).toContain(String(DISPLAY_NAME_MAX_LENGTH));
    }
  });

  it("el largo del nombre se mide DESPUÉS del trim", () => {
    // Nueve caracteres, de los cuales solo uno no es espacio.
    const result = validateRegister({ ...okRegister, displayName: "    a    " });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.displayName).toBeDefined();
  });

  it("rechaza el rol admin: no está en REGISTRABLE_ROLES", () => {
    const result = validateRegister({
      ...okRegister,
      // El formulario no ofrece 'admin', pero el tipo no protege de un POST
      // manipulado: esta es la segunda barrera del lado del cliente.
      role: "admin" as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.role).toBe("Elige si quieres comprar o vender.");
    // ROTO A PROPÓSITO: el portero del CI tiene que ver esto en rojo.
    expect(REGISTRABLE_ROLES).toContain("admin");
  });

  it("rechaza un rol inventado", () => {
    const result = validateRegister({ ...okRegister, role: "vendedor" as never });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.role).toBeDefined();
  });
});

describe("isUserRole", () => {
  it.each(USER_ROLES)("reconoce %s como rol del dominio", (role) => {
    expect(isUserRole(role)).toBe(true);
  });

  it.each([["Buyer"], ["moderador"], [""]])("rechaza %s", (value) => {
    expect(isUserRole(value)).toBe(false);
  });
});
