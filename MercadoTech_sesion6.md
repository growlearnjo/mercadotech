# MercadoTech — Sesión 6: Testing, Debugging y Automatización

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion6.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 6.1: infraestructura de Vitest."
3. "Ejecuta la Fase 6.2: tests unitarios de validadores y utilidades puras."
4. "Ejecuta la Fase 6.3: tests unitarios de services con Supabase mockeado."
5. "Ejecuta la Fase 6.4: tests del context builder y de la capa de IA."
6. "Ejecuta la Fase 6.5: infraestructura de Playwright con Page Objects."
7. "Ejecuta la Fase 6.6: E2E del flujo comprador."
8. "Ejecuta la Fase 6.7: E2E del flujo vendedor."
9. "Ejecuta la Fase 6.8: documenta la metodología de debugging y automatización de revisión."

---

## Objetivo general

Cubrir MercadoTech con una red de seguridad: tests unitarios (Vitest) para toda
la lógica pura y de negocio, tests E2E (Playwright) para los dos flujos
críticos, y una metodología escrita de debugging asistido por IA. Aquí es donde
la **inyección del cliente Supabase** decidida en la sesión 2 paga: los services
se testean sin red.

## Objetivos específicos

* Usar comandos internos de Claude Code para depuración (logs, reproducción, hipótesis).
* Crear tests unitarios con Vitest y E2E con Playwright.
* Interpretar logs y errores del pipeline.
* Automatizar ciclos de revisión con IA (integrar tests al validator de la sesión 5).

## Tecnologías

* Vitest + `@vitest/coverage-v8` · Testing Library (react, jest-dom, user-event) · jsdom
* Playwright (`@playwright/test`)
* Supabase CLI (stack local para E2E — el remoto NUNCA se usa en tests)

---

# FASES

## Fase 6.1 — Infraestructura de Vitest

**Prompt sugerido:** "Ejecuta la Fase 6.1 de `MercadoTech_sesion6.md`."

1. Instalar Vitest + coverage; `vitest.config.ts` (environment jsdom para
   componentes, node para services), `vitest.setup.ts` (jest-dom).
2. Scripts: `test`, `test:watch`, `test -- --coverage`.
3. Convención: el test vive JUNTO al archivo (`cart.service.test.ts` al lado de
   `cart.service.ts`).
4. Verificar que `npm run test` corre (0 tests aún) y que coverage genera reporte.

## Fase 6.2 — Tests de validadores y utilidades puras

**Prompt sugerido:** "Ejecuta la Fase 6.2 de `MercadoTech_sesion6.md`."

* `lib/validators/product.ts`: título corto/largo, precio 0/negativo/válido,
  stock negativo, sin categoría, sin imágenes → errores por campo correctos.
* `lib/validators/auth.ts`: email inválido, password corta, rol admin rechazado.
* `lib/utils.ts`: `formatPrice` (0, redondeo, miles), `cn`, formateo de fechas.
* Objetivo: 100% de ramas en validadores (son pura lógica, no hay excusa).

## Fase 6.3 — Tests de services con Supabase mockeado

**Prompt sugerido:** "Ejecuta la Fase 6.3 de `MercadoTech_sesion6.md`."

Patrón: fabricar un mock del `SupabaseClient` encadenable
(`from().select().eq()…`) e INYECTARLO — nunca `vi.mock` del módulo de cliente.
Cobertura mínima por service (casos felices + errores):

* `cart.service`: agregar duplicado respeta unique (upsert/incremento según diseño), quantity <= 0 rechazado.
* `order.service`: `checkout` propaga el error de stock con el mensaje del RPC; `cancelIfPending` no cancela un 'enviado'.
* `product.service` / `seller.service`: filtros construyen la query correcta; `updateOrderStatus` solo transiciones válidas (la regla del kanban).
* `review.service`: `canReview` false sin pedido entregado.
* `question.service`, `favorite.service`, `auth.service`.
* `embedding.service` y `vector-search.service`: mock de `lib/ai/embeddings`
  (el proveedor NO se llama en tests); dimensión incorrecta → error claro;
  resultados huérfanos se descartan al hidratar.
* `chat.service`: orquesta en el ORDEN correcto (spy sobre cada colaborador),
  propaga `hasRelevantContext=false` cuando el builder no selecciona fuentes.
* Objetivo de cobertura: `services/` >= 80% líneas.

## Fase 6.4 — Tests del context builder y prompts

**Prompt sugerido:** "Ejecuta la Fase 6.4 de `MercadoTech_sesion6.md`."

`context-builder` es puro → tests exhaustivos sin mocks:

* Filtra por similitud mínima y por longitud mínima de contenido.
* Respeta `maxSources` y el presupuesto de caracteres.
* Descarta la última fuente si el resto de presupuesto < mínimo truncado.
* `contextTruncated` refleja la realidad.
* Orden estable por similitud descendente.
* `prompts.ts`: el mensaje de usuario contiene la query y las fuentes numeradas;
  el modo soporte incluye la instrucción de sugerir ticket.

## Fase 6.5 — Infraestructura de Playwright

**Prompt sugerido:** "Ejecuta la Fase 6.5 de `MercadoTech_sesion6.md`."

1. `playwright.config.ts`: baseURL configurable (`PLAYWRIGHT_BASE_URL`,
   default localhost:3000), webServer que levanta `npm run dev` si no hay uno,
   proyectos chromium/firefox/webkit (en CI solo chromium — sesión 7), reporter
   `github` cuando `CI=true`, screenshots/video solo en fallo.
2. Estructura `e2e/`: `data/users.ts` (usuarios DEL SEED: buyer1, seller1),
   `fixtures/test.ts`, `pages/` con Page Objects: `LoginPage`, `CatalogPage`,
   `ProductPage`, `CartPage`, `OrdersPage`, `SellerProductsPage`, `SellerKanbanPage`.
3. Requisito de entorno documentado: los E2E corren contra **Supabase local**
   (`supabase start && supabase db reset`) — nunca contra el proyecto remoto.
4. Los selectores usan `data-testid` — agregarlos a los componentes donde falten
   (cambio permitido: atributo, no lógica).

## Fase 6.6 — E2E: flujo comprador

**Prompt sugerido:** "Ejecuta la Fase 6.6 de `MercadoTech_sesion6.md`."

Spec `e2e/tests/buyer-flow.spec.ts` — un test largo con pasos claros (o serie
`test.step`):

1. Login como buyer1 → llega al catálogo, navbar muestra su nombre.
2. Filtra por categoría "Laptops" → el grid solo muestra laptops.
3. Abre un producto con stock → galería visible, precio correcto.
4. Agrega 2 unidades al carrito → contador del navbar pasa a 2.
5. Va al carrito → subtotal correcto → "Finalizar compra".
6. Redirige al detalle del pedido → estado 'pendiente', ítems con snapshot.
7. "Mis pedidos" lista el pedido nuevo.
8. Logout → navbar vuelve al estado anónimo.

Test negativo aparte: producto con stock 0 → botón deshabilitado; intento de
checkout con carrito vacío → error controlado.

## Fase 6.7 — E2E: flujo vendedor

**Prompt sugerido:** "Ejecuta la Fase 6.7 de `MercadoTech_sesion6.md`."

Spec `e2e/tests/seller-flow.spec.ts`:

1. Login como seller1 → accede al panel vendedor (un buyer NO puede: test aparte con redirección).
2. Publica un producto nuevo (título único por timestamp del test) con una imagen.
3. El producto aparece en su tabla y en el catálogo público.
4. En el kanban: arrastra un pedido de 'pagado' a 'enviado' (usar la API de
   drag de Playwright o el fallback accesible de dnd-kit) → la tarjeta cambia
   de columna y persiste tras recargar.
5. Login como el comprador de ese pedido → el estado ahora es 'enviado'.

## Fase 6.8 — Debugging y automatización de revisión

**Prompt sugerido:** "Ejecuta la Fase 6.8 de `MercadoTech_sesion6.md`."

1. `docs/DEBUGGING.md` — metodología:
   * Flujo: síntoma → reproducir (test que falla) → leer logs (servidor de Next,
     logs del endpoint de chat, `supabase logs`) → hipótesis → fix → el test pasa.
   * Cómo pedirle debugging a Claude (plantilla de `docs/PROMPTS.md` #3).
   * Errores típicos del stack y su lectura: RLS deniega (0 filas o 401 según
     ruta), GRANT faltante (permission denied), modelo HF sin proveedor
     (fallo en request, no en config), dimensión de vector errada.
2. Actualizar la Skill `mercadotech-automatic-validator`: ahora el gate incluye
   `npm run test` (y los E2E si el stack local está arriba).
3. Ciclo automatizado de revisión: al terminar cualquier feature futura, correr
   reviewer → validator → tests. Dejarlo escrito como norma en `CLAUDE.md`.

---

## Restricciones de la sesión

* Los tests unitarios NO llaman a la red (ni Supabase ni Hugging Face) — todo mockeado/inyectado.
* Los E2E NO corren contra el Supabase remoto.
* No cambiar lógica de producción para "hacer pasar" un test sin entender la causa
  (si un test revela un bug real, se corrige el bug y se documenta).
* No perseguir 100% de cobertura global — el objetivo es validadores 100%, services >= 80%, flujos E2E críticos completos.

## Entregables

1. Infraestructura Vitest + Playwright configurada.
2. Suite unitaria: validadores, utils, services, capa IA (>= 80% en services).
3. 2 specs E2E (comprador y vendedor) + tests negativos.
4. `docs/DEBUGGING.md` + validator actualizado + norma en `CLAUDE.md`.

## Criterios de aceptación de la sesión

* `npm run test` verde con la cobertura objetivo.
* `npm run test:e2e` verde contra Supabase local con el seed.
* El kanban drag & drop está cubierto por E2E (la interacción más frágil del proyecto).
* La Skill validator ejecuta los tests como parte del gate.
