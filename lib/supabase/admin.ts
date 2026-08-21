import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ADVERTENCIA: este cliente usa la service role key y BYPASEA RLS por completo.
// Solo puede usarse en código que corre exclusivamente en el servidor
// (Route Handlers, Server Actions). JAMÁS importarlo desde un Client Component,
// un hook o cualquier archivo que pueda terminar en el bundle del navegador
// (el import de "server-only" convierte ese error en un fallo de build).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
