// Tests de services/auth.service.ts (Fase 6.3). Cliente inyectado.
//
// Aquí el doble imita `supabase.auth.*` en vez de la cadena de PostgREST,
// pero la regla es la misma: el cliente entra por el último parámetro y no
// hay `vi.mock` de `lib/supabase/*` en ninguna parte.

import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  getCurrentUser,
  getProfile,
  login,
  logout,
  onAuthStateChange,
  register,
} from "@/services/auth.service";
import { dbError, hasFilter, mockSupabase } from "@/services/test-utils/supabase-mock";

const USER_ID = "u1";
const usuario = { id: USER_ID, email: "buyer1@mercadotech.test" };

describe("register", () => {
  it("manda display_name y role en options.data, de donde los lee el trigger", async () => {
    const supabase = mockSupabase({
      auth: { signUp: { data: { user: usuario, session: { access_token: "t" } }, error: null } },
    });

    const result = await register(
      {
        email: "nuevo@mercadotech.test",
        password: "MercadoTech123!",
        displayName: "Ana",
        role: "seller",
      },
      supabase,
    );

    expect(supabase.authCalls("signUp")[0][0]).toEqual({
      email: "nuevo@mercadotech.test",
      password: "MercadoTech123!",
      options: { data: { display_name: "Ana", role: "seller" } },
    });
    expect(result.user).toEqual(usuario);
    expect(result.signedIn).toBe(true);
  });

  it("signedIn = false cuando el proyecto exige confirmar el correo", async () => {
    const supabase = mockSupabase({
      auth: { signUp: { data: { user: usuario, session: null }, error: null } },
    });

    const result = await register(
      { email: "a@b.test", password: "x".repeat(8), displayName: "A", role: "buyer" },
      supabase,
    );

    // La UI usa esto para no prometer un acceso inmediato que en producción
    // no ocurriría (en local `enable_confirmations = false`).
    expect(result.signedIn).toBe(false);
  });

  it("propaga el error de Auth", async () => {
    const supabase = mockSupabase({ auth: { signUp: dbError("User already registered", "422") } });

    await expect(
      register(
        { email: "a@b.test", password: "x".repeat(8), displayName: "A", role: "buyer" },
        supabase,
      ),
    ).rejects.toThrow("User already registered");
  });
});

describe("login y logout", () => {
  it("login devuelve el usuario autenticado", async () => {
    const supabase = mockSupabase({
      auth: { signInWithPassword: { data: { user: usuario, session: {} }, error: null } },
    });

    await expect(login("buyer1@mercadotech.test", "MercadoTech123!", supabase)).resolves.toEqual(
      usuario,
    );
    expect(supabase.authCalls("signInWithPassword")[0][0]).toEqual({
      email: "buyer1@mercadotech.test",
      password: "MercadoTech123!",
    });
  });

  it("login propaga el error de credenciales", async () => {
    const supabase = mockSupabase({
      auth: { signInWithPassword: dbError("Invalid login credentials", "400") },
    });

    await expect(login("buyer1@mercadotech.test", "mala", supabase)).rejects.toThrow(
      "Invalid login credentials",
    );
  });

  it("logout cierra la sesión", async () => {
    const supabase = mockSupabase();

    await expect(logout(supabase)).resolves.toBeUndefined();
    expect(supabase.authCalls("signOut")).toHaveLength(1);
  });

  it("logout propaga el error", async () => {
    const supabase = mockSupabase({ auth: { signOut: dbError("network error") } });

    await expect(logout(supabase)).rejects.toThrow("network error");
  });
});

describe("getProfile", () => {
  const fila = {
    id: USER_ID,
    display_name: "Ana",
    role: "seller",
    avatar_path: null as string | null,
  };

  it("devuelve el perfil con el rol estrechado y sin avatar", async () => {
    const supabase = mockSupabase({ profiles: { maybeSingle: fila } });

    const profile = await getProfile(USER_ID, supabase);

    expect(profile?.role).toBe("seller");
    expect(profile?.avatar_url).toBeNull();
    expect(hasFilter(supabase.filters("profiles"), "eq", "id", USER_ID)).toBe(true);
  });

  it("resuelve avatar_path a una URL pública del bucket avatars", async () => {
    const supabase = mockSupabase({
      profiles: { maybeSingle: { ...fila, avatar_path: "u1/foto.jpg" } },
    });

    const profile = await getProfile(USER_ID, supabase);

    // La UI recibe siempre una URL, nunca un path de Storage.
    expect(profile?.avatar_url).toContain("avatars/u1/foto.jpg");
  });

  it("un rol desconocido en la BD degrada a 'buyer' en vez de romper la pantalla", async () => {
    const supabase = mockSupabase({ profiles: { maybeSingle: { ...fila, role: "moderador" } } });

    const profile = await getProfile(USER_ID, supabase);

    expect(profile?.role).toBe("buyer");
  });

  it("devuelve null si RLS no deja ver el perfil", async () => {
    await expect(getProfile("ajeno", mockSupabase())).resolves.toBeNull();
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ profiles: { maybeSingle: dbError("boom") } });

    await expect(getProfile(USER_ID, supabase)).rejects.toThrow("boom");
  });
});

describe("getCurrentUser", () => {
  it("usa getUser (valida el token contra el servidor), no getSession", async () => {
    const supabase = mockSupabase({
      auth: { getUser: { data: { user: usuario }, error: null } },
      profiles: { maybeSingle: { id: USER_ID, display_name: "Ana", role: "buyer", avatar_path: null } },
    });

    const result = await getCurrentUser(supabase);

    expect(result?.user).toEqual(usuario);
    expect(result?.profile?.role).toBe("buyer");
    expect(supabase.authCalls("getUser")).toHaveLength(1);
  });

  it("sin sesión devuelve null: getUser fallando es un caso normal, no un fallo", async () => {
    const supabase = mockSupabase({ auth: { getUser: dbError("Auth session missing!") } });

    await expect(getCurrentUser(supabase)).resolves.toBeNull();
    // No intenta leer el perfil de nadie.
    expect(supabase.calls("profiles")).toEqual([]);
  });

  it("devuelve el usuario con profile null si RLS oculta el perfil", async () => {
    const supabase = mockSupabase({
      auth: { getUser: { data: { user: usuario }, error: null } },
      profiles: { maybeSingle: null },
    });

    const result = await getCurrentUser(supabase);

    expect(result?.user).toEqual(usuario);
    expect(result?.profile).toBeNull();
  });
});

describe("onAuthStateChange", () => {
  it("traduce el evento a 'usuario o null' y devuelve la baja", () => {
    const supabase = mockSupabase();
    const vistos: (User | null)[] = [];

    const unsubscribe = onAuthStateChange((user) => vistos.push(user), supabase);

    // El callback registrado se dispara como lo haría Supabase.
    const registrado = supabase.authCalls("onAuthStateChange")[0][0] as (
      event: string,
      session: unknown,
    ) => void;
    registrado("SIGNED_IN", { user: usuario });
    registrado("SIGNED_OUT", null);

    expect(vistos).toEqual([usuario, null]);
    expect(typeof unsubscribe).toBe("function");

    unsubscribe();
    expect(supabase.authCalls("unsubscribe")).toHaveLength(1);
  });
});
