/**
 * Fábrica de clientes Supabase, POR LLAMADA.
 *
 * Por qué no importa `lib/supabase/admin.ts`: ese archivo empieza con
 * `import "server-only"`, un guard que solo el bundler de Next sabe
 * neutralizar; bajo Node/tsx puro lanza SIEMPRE. Está comprobado en este
 * mismo repo — lo documenta la cabecera de `scripts/index-all.ts`, que sufrió
 * exactamente esto en la sesión 4. Aquí se construye un cliente equivalente
 * con la misma service role key; el cliente admin sigue confinado a
 * Route Handlers, `scripts/` y este archivo.
 *
 * Por qué por llamada y no un singleton al arrancar: el servidor puede vivir
 * horas colgado de un cliente MCP. Un cliente creado al arranque congela
 * credenciales y conexiones; si el token rota o el socket muere, no hay forma
 * de recuperarse sin reiniciar el proceso.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Client = SupabaseClient<Database>;

export interface McpContext {
  /** Respeta RLS como un visitante anónimo de la web. Es el default. */
  anon: Client;
  /**
   * BYPASEA RLS por completo. Solo para las tools/resources donde una
   * política lo obliga, y siempre con el comentario que la cita al lado.
   * Lanza si no hay service role key configurada.
   */
  admin: Client;
}

const OPTIONS = { auth: { autoRefreshToken: false, persistSession: false } } as const;

export function createContext(): McpContext {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Lanza el servidor desde la raíz del repo para que se lea .env.local.",
    );
  }

  const anon = createClient<Database>(url, anonKey, OPTIONS);

  return {
    anon,
    // Getter perezoso: que falte la service role key solo debe romper a quien
    // de verdad la necesita, no a las 6 tools que corren con anon.
    get admin(): Client {
      if (!serviceKey) {
        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY ausente en .env.local: esta operación " +
            "necesita bypasear RLS y no puede continuar.",
        );
      }
      return createClient<Database>(url, serviceKey, OPTIONS);
    },
  };
}
