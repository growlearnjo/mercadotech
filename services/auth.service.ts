// Lógica de autenticación. Sigue el patrón de service del CLAUDE.md: funciones
// async puras, cliente inyectable como ÚLTIMO parámetro, sin React, y los
// errores de Supabase se lanzan tal cual para que el hook los traduzca.

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Profile } from "@/types/user";
import type { RegistrableRole } from "@/lib/validators/auth";
import { isUserRole } from "@/lib/validators/auth";

type Client = SupabaseClient<Database>;

export type RegisterParams = {
  email: string;
  password: string;
  displayName: string;
  role: RegistrableRole;
};

export type RegisterResult = {
  user: User | null;
  /**
   * `false` cuando Supabase no devolvió sesión: significa que el proyecto
   * exige confirmar el correo. En local `enable_confirmations = false`, así
   * que siempre viene `true`; la UI usa esto para no prometer un acceso
   * inmediato que en producción no ocurriría.
   */
  signedIn: boolean;
};

/**
 * Alta de usuario.
 *
 * `display_name` y `role` viajan en `options.data`, que Supabase guarda en
 * `auth.users.raw_user_meta_data`. De ahí los lee el trigger handle_new_user
 * al crear la fila de `profiles`.
 *
 * NO se hace un update de `profiles` después: el trigger protect_profile_role
 * lo rechazaría, porque un usuario no puede cambiar su propio rol.
 */
export async function register(
  { email, password, displayName, role }: RegisterParams,
  supabase: Client = createClient(),
): Promise<RegisterResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role },
    },
  });
  if (error) throw error;
  return { user: data.user, signedIn: data.session !== null };
}

export async function login(
  email: string,
  password: string,
  supabase: Client = createClient(),
): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function logout(supabase: Client = createClient()): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Perfil del usuario indicado, o null si RLS no deja verlo. */
export async function getProfile(
  userId: string,
  supabase: Client = createClient(),
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    // La columna es `text` con CHECK; si algún día llega algo fuera de la
    // unión, se degrada a 'buyer' en vez de romper la pantalla.
    role: isUserRole(data.role) ? data.role : "buyer",
    // `avatar_path` → URL pública. Se resuelve aquí para que la UI reciba
    // siempre una URL y nunca un path de Storage.
    avatar_url: data.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(data.avatar_path).data
          .publicUrl
      : null,
  };
}

/**
 * Usuario autenticado + su perfil.
 *
 * Usa `getUser()` y no `getSession()`: getUser valida el token contra el
 * servidor de Auth, mientras que getSession se fía de lo que haya en el
 * almacenamiento local, que es manipulable.
 */
export async function getCurrentUser(
  supabase: Client = createClient(),
): Promise<{ user: User; profile: Profile | null } | null> {
  const { data, error } = await supabase.auth.getUser();
  // Sin sesión, getUser devuelve error: es un caso normal, no un fallo.
  if (error || !data.user) return null;

  const profile = await getProfile(data.user.id, supabase);
  return { user: data.user, profile };
}

/**
 * Suscripción a los cambios de sesión.
 *
 * Vive aquí y no en el hook para que `hooks/` no tenga que importar el
 * cliente de Supabase: la regla de capas del CLAUDE.md reserva ese import
 * para `services/` y `app/`. Devuelve la función para darse de baja.
 */
export function onAuthStateChange(
  callback: (user: User | null) => void,
  supabase: Client = createClient(),
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}
