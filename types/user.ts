// Tipos de dominio de usuarios.
import type { Database } from "@/types/database";
import type { UserRole } from "@/lib/constants/roles";

/**
 * Perfil del usuario. `role` se estrecha a la unión de
 * `lib/constants/roles.ts` (en la BD es `text` con CHECK) y `avatar_url` es la
 * URL pública ya resuelta a partir de `avatar_path`.
 *
 * Ojo (decisión 8 de la spec): RLS solo deja leer el perfil propio o, si eres
 * admin, cualquiera. Las pantallas que muestran autores de reseñas y preguntas
 * NO reciben este tipo, sino una etiqueta genérica.
 */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  role: UserRole;
  avatar_url: string | null;
};
