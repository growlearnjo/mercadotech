import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rutas que exigen sesión.
 *
 * Deliberadamente NO incluye `/producto` ni `/categoria` ni `/buscar`: el
 * catálogo y el detalle son públicos por spec. Protegerlos expulsaría a
 * `/login` a quien llega desde un enlace compartido o desde un buscador, y
 * además contradiría las políticas RLS, que ya permiten leer los productos
 * activos de forma anónima.
 *
 * Las acciones dentro del detalle (preguntar, favorito, agregar al carrito) no
 * se cubren aquí: se muestran y redirigen al hacer clic (regla de la spec).
 */
const PROTECTED_PREFIXES = [
  "/carrito",
  "/pedidos",
  "/favoritos",
  "/vendedor",
  // Sesión 4 (decisión 1): la IA exige sesión — protege la cuota gratuita
  // de Hugging Face y evita que un anónimo llegue a pantallas sin acceso
  // real a knowledge_embeddings (RLS: SELECT solo authenticated).
  "/asistente",
  "/soporte",
] as const;

function requiresSession(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

// Patrón oficial de @supabase/ssr: refresca el token de sesión en cada
// request y lo propaga tanto a la request entrante como a la respuesta.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales configuradas (antes de la Fase 2.2+) no hay sesión que
  // refrescar; se deja pasar la request para no romper `npm run dev`.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // No eliminar: refresca el token antes de que las Server Components lo lean.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard de sesión. Se resuelve aquí y no en el cliente para que no haya
  // parpadeo: quien no tiene sesión nunca llega a ver la pantalla protegida.
  const { pathname, search } = request.nextUrl;
  if (!user && requiresSession(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Se conserva la query original para devolver al usuario exactamente
    // donde estaba tras iniciar sesión.
    loginUrl.searchParams.set("redirectTo", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
