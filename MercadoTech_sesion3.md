# MercadoTech — Sesión 3: UI Inteligente y Frontend Multimodal

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion3.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 3.1: sistema visual y componentes base."
3. "Ejecuta la Fase 3.2: layouts y navegación."
4. "Ejecuta la Fase 3.3: autenticación (pantallas, hook y service)."
5. "Ejecuta la Fase 3.4: catálogo de productos."
6. "Ejecuta la Fase 3.5: detalle de producto con preguntas y reseñas."
7. "Ejecuta la Fase 3.6: carrito y checkout simulado."
8. "Ejecuta la Fase 3.7: panel del vendedor con drag & drop (galería y kanban de pedidos)."
9. "Ejecuta la Fase 3.8: revisión de responsive y estados de carga/vacío/error."

---

## Objetivo general

Construir un MVP completamente funcional del marketplace sobre la infraestructura
de la sesión 2: todas las pantallas, navegación, hooks y servicios, con
separación estricta UI/lógica y dos interacciones drag & drop (galería del
producto y kanban de pedidos del vendedor).

## Objetivos específicos

* Integrar shadcn/ui y Tailwind sin fricción (sistema visual coherente).
* Convertir wireframes a código usando Vision (metodología, ver abajo).
* Crear componentes avanzados con drag & drop (dnd-kit).
* Modular TODA la lógica de estado con custom hooks.
* Mantener la independencia total entre componentes, hooks y services.

## Reutilización de la infraestructura existente

* NO modificar migraciones existentes ni `seed.sql` ni políticas RLS.
* Sí se permite AGREGAR migraciones nuevas si una pantalla lo exige y se justifica.
* Todo acceso a datos pasa por `services/` con el cliente de navegador (RLS
  aplica siempre). NO construir capa REST paralela para el CRUD: los Route
  Handlers de `app/api/v1/` quedan reservados para lo que no puede correr en el
  navegador (sesión 4 en adelante), salvo `auth` si se decide manejo por cookies.

## Metodología Vision (transversal a todas las fases de pantallas)

Antes de construir cada pantalla se puede adjuntar un wireframe (foto de un
boceto a mano o captura de una referencia). El prompt patrón es:

> "Aquí está el wireframe de [pantalla]. Conviértelo a código usando NUESTROS
> componentes base de la Fase 3.1 y los tokens del sistema visual. No inventes
> componentes nuevos si ya existe uno equivalente. La pantalla no hace fetching:
> recibe todo por props/hook."

Si no hay wireframe, usar como referencia la disposición típica de Mercado
Libre (grid de cards, ficha de producto con galería a la izquierda y caja de
compra a la derecha).

---

# FASES

## Fase 3.1 — Sistema visual y componentes base

**Prompt sugerido:** "Ejecuta la Fase 3.1 de `MercadoTech_sesion3.md`."

1. Definir tokens en `globals.css` (tema claro y oscuro): color primario
   (azul/eléctrico, coherente con marketplace tech), radios, tipografía.
2. Instalar componentes shadcn/ui necesarios: `button`, `card`, `input`,
   `label`, `textarea`, `select`, `badge`, `dialog`, `dropdown-menu`, `avatar`,
   `separator`, `skeleton`, `tabs`, `sheet`, `sonner` (toasts), `table`.
3. Componentes propios de presentación (en `components/ui/` o `components/layout/`):
   * `Price` — formatea `numeric` a `S/ 1,299.90` (usa util pura de `lib/utils.ts`).
   * `RatingStars` — muestra rating 1–5 (solo lectura y editable).
   * `EmptyState`, `ErrorState`, `LoadingState`, `Container`.
   * `ConditionBadge` — nuevo/usado/reacondicionado.
4. Regla: ninguno de estos componentes importa Supabase ni hooks — solo props.

## Fase 3.2 — Layouts y navegación

**Prompt sugerido:** "Ejecuta la Fase 3.2 de `MercadoTech_sesion3.md`."

1. `app/layout.tsx` raíz (fuentes, Toaster, metadata).
2. Layout `(shop)`: `Navbar` con logo, `SearchBar` (búsqueda por texto — la
   semántica llega en la sesión 4, dejar el espacio), `CategoriesMenu`
   (dropdown alimentado por hook), `CartIndicator` (ícono + contador),
   `UserMenu` (avatar, mis pedidos, favoritos, panel vendedor si rol seller,
   soporte, cerrar sesión). `MobileNav` en `sheet`.
3. Layout `(seller)`: sidebar con "Mis productos", "Pedidos", "Publicar".
   Protegido: si el rol no es seller/admin, redirigir con toast.
4. Layout `(auth)`: centrado, sin navbar.
5. Componente `NavLink` con estado activo. Navegación 100% responsive.

## Fase 3.3 — Autenticación

**Prompt sugerido:** "Ejecuta la Fase 3.3 de `MercadoTech_sesion3.md`."

1. `services/auth.service.ts`: `register` (email, password, display_name, rol
   buyer o seller — nunca admin desde el registro), `login`, `logout`,
   `getCurrentUser` (con el profile). Cliente inyectable.
2. `hooks/useAuth.ts`: estado `user/initializing/loading/error`, expone las
   acciones; escucha `onAuthStateChange`.
3. Pantallas `(auth)/login` y `(auth)/register` con `LoginForm` /
   `RegisterForm` (componentes puros + validadores en `lib/validators/auth.ts`).
4. Reglas de navegación: usuario no autenticado puede navegar el catálogo y ver
   productos; carrito/checkout/preguntas/favoritos requieren sesión (redirigir a
   login con `redirectTo`).

## Fase 3.4 — Catálogo de productos

**Prompt sugerido:** "Ejecuta la Fase 3.4 de `MercadoTech_sesion3.md`."

1. `services/product.service.ts`: `listActiveProducts({categorySlug, search,
   condition, minPrice, maxPrice, sort, page})` (búsqueda por `ilike` en
   título/marca — provisional hasta la sesión 4), `getProductById`,
   `getProductImages`, `registerView`. `services/category.service.ts`:
   `listCategories`.
2. `hooks/useProducts.ts` (listado + filtros + paginación) y
   `hooks/useCategories.ts`.
3. Home `(shop)/page.tsx`: grid responsive de `ProductCard` (imagen principal,
   título, `Price`, `ConditionBadge`, rating promedio si existe), skeletons
   durante carga, `EmptyState` si no hay resultados.
4. `(shop)/categoria/[slug]/page.tsx` reutiliza el MISMO grid y hook con filtro.
5. `FiltersPanel` (condición, rango de precio, orden por precio/recientes) —
   componente puro; el estado vive en el hook/URL (`searchParams`).

## Fase 3.5 — Detalle de producto

**Prompt sugerido:** "Ejecuta la Fase 3.5 de `MercadoTech_sesion3.md`."

1. `(shop)/producto/[id]/page.tsx`, composición de componentes puros:
   * `ProductGallery` — imagen grande + miniaturas ordenadas por `position`.
   * `ProductInfo` — título, marca, condición, precio, stock disponible.
   * `BuyBox` — selector de cantidad (max = stock), "Agregar al carrito",
     botón favorito. Deshabilitado sin stock o producto propio.
   * `QuestionsSection` — lista de preguntas/respuestas + formulario para
     preguntar (autenticado); si el usuario es el vendedor dueño, puede responder inline.
   * `ReviewsSection` — promedio + lista; formulario visible SOLO si el hook
     confirma que el usuario tiene un pedido 'entregado' con este producto
     (la RLS lo garantiza de todos modos — defensa en profundidad).
2. Services: `question.service.ts` (`listByProduct`, `create`, `answer`),
   `review.service.ts` (`listByProduct`, `getAverage`, `create`, `canReview`),
   `favorite.service.ts` (`toggle`, `isFavorite`, `listMine`).
3. Hooks: `useProduct`, `useQuestions`, `useReviews`, `useFavorite`.
4. Registrar `product_view` al montar (fire-and-forget, sin bloquear la UI).

## Fase 3.6 — Carrito y checkout simulado

**Prompt sugerido:** "Ejecuta la Fase 3.6 de `MercadoTech_sesion3.md`."

1. `services/cart.service.ts`: `getItems` (con join a products para precio y
   stock actuales), `addItem`, `updateQuantity`, `removeItem`, `clear`.
2. `services/order.service.ts`: `checkout` (llama al RPC
   `create_order_from_cart`), `listMyOrders`, `getOrderById`,
   `cancelIfPending`.
3. `hooks/useCart.ts` (items, subtotal, contador para el navbar, acciones) y
   `hooks/useOrders.ts`.
4. `(shop)/carrito/page.tsx`: tabla/lista de `CartItemRow` (cantidad editable,
   quitar), resumen con subtotal, botón "Finalizar compra" → llama a
   `checkout` → toast de éxito → redirige a `(shop)/pedidos/[id]`.
   Manejar el error de stock insuficiente mostrando QUÉ producto falló.
5. `(shop)/pedidos/page.tsx` (lista con estado como `Badge` de color) y
   `(shop)/pedidos/[id]/page.tsx` (ítems con snapshots, total, estado,
   cancelar si 'pendiente').
6. El checkout es SIMULADO: dejar comentario y texto en la UI ("pago simulado
   para el laboratorio") — no pedir ni almacenar datos de tarjeta.

## Fase 3.7 — Panel del vendedor con drag & drop

**Prompt sugerido:** "Ejecuta la Fase 3.7 de `MercadoTech_sesion3.md`."

Instalar `@dnd-kit/core` + `@dnd-kit/sortable` (mantenido y accesible).

1. `services/seller.service.ts`: `listMyProducts` (incluye inactivos),
   `createProduct`, `updateProduct`, `toggleActive`, `deleteProduct`,
   `listMyOrders` (pedidos con ítems propios, vía RLS), `updateOrderStatus`.
   `services/storage.service.ts`: `uploadProductImage` (path
   `{seller_id}/{product_id}/…`), `deleteProductImage`, `getPublicUrl`,
   `saveImageOrder` (actualiza `position` en lote).
2. `(seller)/productos/page.tsx`: tabla de mis productos (estado, stock,
   precio, acciones). `(seller)/publicar/page.tsx` y
   `(seller)/productos/[id]/editar/page.tsx` comparten `ProductForm`.
3. **Drag & drop #1 — `SortableImageGallery`** (dentro de `ProductForm`):
   subir múltiples imágenes, previsualizar y REORDENAR arrastrando; al soltar,
   el hook llama a `saveImageOrder`. La primera imagen es la portada del card.
4. **Drag & drop #2 — `OrdersKanban`** en `(seller)/pedidos/page.tsx`:
   columnas por estado (pendiente → pagado → enviado → entregado; cancelado
   aparte). Arrastrar una tarjeta de pedido entre columnas llama a
   `updateOrderStatus`. Reglas en el hook: solo transiciones hacia adelante
   válidas; actualización optimista con rollback si la RLS la rechaza.
5. Hooks: `useSellerProducts`, `useSellerOrders`, `useProductForm` (incluye
   validación con `lib/validators/product.ts`: título 5–120 chars, precio > 0,
   stock >= 0, categoría obligatoria, al menos 1 imagen).

## Fase 3.8 — Responsive y estados

**Prompt sugerido:** "Ejecuta la Fase 3.8 de `MercadoTech_sesion3.md`."

Pasada final por TODAS las pantallas verificando: móvil/tablet/desktop; skeleton
en toda carga; `EmptyState` con acción sugerida en toda lista vacía;
`ErrorState` con reintento en todo fallo; foco y navegación por teclado en
formularios y en ambos drag & drop (dnd-kit lo soporta — activarlo); imágenes
con `next/image` y `alt`.

---

## Restricciones de la sesión

* NO tocar migraciones existentes, `seed.sql` ni políticas RLS (solo migraciones NUEVAS justificadas).
* NO implementar IA, embeddings, chat ni voz (sesiones 4 y 8).
* NO crear el panel admin completo (solo se necesita el rol para moderación vía RLS).
* Componentes NO hacen fetching; hooks NO contienen lógica de negocio; services NO conocen React.
* Sin pasarela de pagos real.

## Entregables

1. Sistema visual + componentes base.
2. Navegación completa (shop/seller/auth) responsive.
3. Auth funcional (registro con rol, login, logout, rutas protegidas).
4. Catálogo con filtros + detalle con Q&A y reseñas verificadas.
5. Carrito + checkout simulado transaccional + mis pedidos.
6. Panel vendedor: CRUD de productos, galería drag & drop, kanban de pedidos drag & drop.
7. Hooks y services para cada dominio, con cliente Supabase inyectable.

## Criterios de aceptación de la sesión

* Flujo comprador completo: registro → explorar → filtrar → detalle → preguntar
  → carrito → checkout → ver pedido.
* Flujo vendedor completo: publicar con imágenes reordenadas → producto visible
  en catálogo → recibir pedido → moverlo por el kanban → comprador ve el nuevo estado.
* Reseña solo posible tras pedido 'entregado'.
* `npm run lint` y `tsc --noEmit` pasan.
* Ningún componente importa `lib/supabase/` directamente (verificable con grep).
