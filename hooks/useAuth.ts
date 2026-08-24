"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import * as authService from "@/services/auth.service";
import type { Profile } from "@/types/user";
import type { RegisterParams } from "@/services/auth.service";

export type UseAuthResult = {
  user: User | null;
  profile: Profile | null;
  /** true mientras se resuelve la sesión inicial: evita parpadeos de "no hay sesión". */
  initializing: boolean;
  /** true mientras corre una acción (login/registro/logout). */
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (params: RegisterParams) => Promise<boolean>;
  logout: () => Promise<void>;
};

/** Traduce el error de Supabase a algo que una persona pueda accionar. */
function toMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(raw)) {
    return "Correo o contraseña incorrectos.";
  }
  if (/already registered|already been registered/i.test(raw)) {
    return "Ese correo ya tiene una cuenta. Inicia sesión.";
  }
  if (/password/i.test(raw) && /short|least/i.test(raw)) {
    return "La contraseña es demasiado corta.";
  }
  if (/email.*invalid|invalid.*email/i.test(raw)) {
    return "Ese correo no parece válido.";
  }
  return "No pudimos completar la operación. Inténtalo de nuevo.";
}

/**
 * Sesión del usuario y acciones de autenticación.
 *
 * Se suscribe a `onAuthStateChange`, así que cualquier pestaña o componente
 * que inicie o cierre sesión actualiza a todos los demás sin recargar.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [initializing, setInitializing] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    // Carga inicial: ¿hay sesión válida?
    authService
      .getCurrentUser()
      .then((result) => {
        if (!active) return;
        setUser(result?.user ?? null);
        setProfile(result?.profile ?? null);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setProfile(null);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    const unsubscribe = authService.onAuthStateChange((nextUser) => {
      if (!active) return;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        return;
      }
      // El perfil vive en otra tabla: al cambiar la sesión hay que releerlo.
      authService
        .getProfile(nextUser.id)
        .then((p) => {
          if (active) setProfile(p);
        })
        .catch(() => {
          if (active) setProfile(null);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.login(email, password);
        return true;
      } catch (err) {
        setError(toMessage(err));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const register = React.useCallback(
    async (params: RegisterParams) => {
      setLoading(true);
      setError(null);
      try {
        const { signedIn } = await authService.register(params);
        if (!signedIn) {
          // Proyecto hosted con confirmación de correo activa.
          setError("Revisa tu correo para confirmar la cuenta.");
          return false;
        }
        return true;
      } catch (err) {
        setError(toMessage(err));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = React.useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    profile,
    initializing,
    loading,
    error,
    login,
    register,
    logout,
  };
}
