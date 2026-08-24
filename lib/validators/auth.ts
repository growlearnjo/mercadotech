// Validación de los formularios de autenticación.
//
// Framework-agnóstica a propósito: la usa el formulario antes de enviar y
// puede usarla el servidor si alguna vez hace falta. No importa React ni
// Supabase, y devuelve errores por campo para poder pintarlos junto al input.

import { USER_ROLES, type UserRole } from "@/lib/constants/roles";

/** Roles que un usuario puede elegir al registrarse. `admin` jamás. */
export const REGISTRABLE_ROLES = ["buyer", "seller"] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

/**
 * Mínimo de contraseña. Supabase Auth rechaza por debajo de 6; se sube a 8
 * porque es el mínimo razonable para una cuenta con datos de compra.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 60;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Partial<Record<keyof T, string>> };

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  displayName: string;
  role: RegistrableRole;
};

// Deliberadamente permisiva: validar email con regex a fondo es un pozo sin
// fondo y el servidor es la autoridad final. Solo se descartan errores obvios.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Ingresa tu correo.";
  if (!EMAIL_PATTERN.test(email.trim())) return "Ese correo no parece válido.";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Ingresa tu contraseña.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return undefined;
}

export function validateLogin(input: LoginInput): ValidationResult<LoginInput> {
  const errors: Partial<Record<keyof LoginInput, string>> = {};

  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const password = validatePassword(input.password);
  if (password) errors.password = password;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { email: input.email.trim(), password: input.password },
  };
}

export function validateRegister(
  input: RegisterInput,
): ValidationResult<RegisterInput> {
  const errors: Partial<Record<keyof RegisterInput, string>> = {};

  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const password = validatePassword(input.password);
  if (password) errors.password = password;

  const displayName = input.displayName.trim();
  if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
    errors.displayName = `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`;
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `El nombre no puede pasar de ${DISPLAY_NAME_MAX_LENGTH} caracteres.`;
  }

  // Segunda barrera del lado del cliente. La real está en el trigger SQL, que
  // degrada a 'buyer' cualquier valor fuera de la lista blanca: aquí solo se
  // evita mandar basura y dar un mensaje útil.
  if (!REGISTRABLE_ROLES.includes(input.role)) {
    errors.role = "Elige si quieres comprar o vender.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      email: input.email.trim(),
      password: input.password,
      displayName,
      role: input.role,
    },
  };
}

/** Comprueba que un string suelto de la BD sea un rol conocido. */
export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
