import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de servidor: respeta RLS con la sesión del usuario autenticado
// (a través de sus cookies). Usar en Server Components y Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component: el middleware ya se encarga
            // de refrescar la sesión, así que este error es seguro de ignorar.
          }
        },
      },
    }
  );
}
