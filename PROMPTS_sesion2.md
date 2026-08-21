# MercadoTech — Prompts específicos de la Sesión 2 (Backend con Supabase)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase** — no un mínimo
fijo. Para tareas de código/SQL los que más rinden son Contexto, Objetivo,
Restricciones, Formato y Razonamiento; Rol ayuda a fijar el estándar de calidad;
Público/tono y Ejemplos se usan donde el contenido lo amerita (seed y documentación).

Todos asumen que existe `mercadotech/MercadoTech_sesion2.md` (la spec). El prompt
la referencia SIEMPRE — la spec es la fuente de verdad; el prompt es el disparador
autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento |
|---|---|---|---|---|---|---|---|---|
| 2.1 Estructura | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ |
| 2.2 Esquema/migraciones | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ |
| 2.3 RLS | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ |
| 2.4 Storage | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | — |
| 2.5 Seed | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| 2.6 Validación RLS | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ |
| 2.7 Documentación | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ |

---

## Prompt Fase 2.1 — Estructura del proyecto y configuración inicial

```text
[ROL] Actúa como arquitecto de software senior especializado en Next.js 15
(App Router) y Supabase, obsesionado con la separación de capas.

[CONTEXTO] Proyecto MercadoTech: marketplace de productos tecnológicos con
soporte por agentes de voz (se construye en 8 sesiones). Estado actual: solo
existe el repositorio inicializado en la sesión 1 (git, .gitignore, CLAUDE.md,
docs/). Aún NO existe la app Next.js. La especificación completa de esta sesión
está en mercadotech/MercadoTech_sesion2.md — léela antes de empezar.

[OBJETIVO] Ejecuta la Fase 2.1: crea el proyecto Next.js 15 con TypeScript
estricto, TailwindCSS v4 y ESLint; inicializa shadcn/ui (solo components.json y
utilidades base); crea la estructura de carpetas EXACTA del diagrama de la
Fase 2.1 de la spec; crea los 4 clientes de Supabase en lib/supabase/
(client, server, middleware, admin); crea .env.example documentado y
lib/constants/roles.ts con roles y estados; actualiza CLAUDE.md con los
comandos reales.

[RESTRICCIONES]
- NO instales componentes shadcn de dominio (button, card, etc. son de la sesión 3).
- NO crees tablas, hooks, services de negocio ni endpoints.
- admin.ts debe llevar un comentario de advertencia: bypasea RLS, solo servidor,
  jamás importarlo desde código cliente.
- No adelantes trabajo de fases o sesiones futuras.

[RAZONAMIENTO] Antes de crear nada: presenta el plan (comandos que vas a correr
y árbol de carpetas resultante) y espera mi confirmación. Si algún comando de
scaffolding pregunta opciones interactivas, indícame cuáles elegir y por qué.

[FORMATO DE SALIDA] Al terminar entrega: (1) árbol de archivos creados,
(2) comandos ejecutados, (3) evidencia de que `npm run dev` levanta y de que
`npm run lint` y `tsc --noEmit` pasan sin errores.
```

## Prompt Fase 2.2 — Esquema de base de datos y migraciones

```text
[ROL] Actúa como DBA senior de PostgreSQL con experiencia en Supabase,
integridad referencial y diseño de esquemas para e-commerce.

[CONTEXTO] MercadoTech, Fase 2.1 completada: proyecto Next.js con estructura de
carpetas y clientes Supabase listos; carpeta supabase/migrations/ vacía. La
spec mercadotech/MercadoTech_sesion2.md, Fase 2.2, define las 15 entidades con
sus campos, tipos, checks y relaciones (profiles, categories, products,
product_images, cart_items, orders, order_items, questions, reviews, favorites,
product_views, support_articles, support_tickets, ticket_messages) más la
función transaccional create_order_from_cart y los índices. Léela completa
antes de escribir SQL.

[OBJETIVO] Genera las migraciones SQL que construyen TODA la base de datos
desde cero, en orden de dependencia, incluyendo: extensiones, trigger
handle_new_user, las 15 tablas con sus constraints, la función
create_order_from_cart (transaccional, con bloqueo de stock FOR UPDATE y
validación de auth.uid()), y todos los índices. Actualiza supabase/schema.sql
como copia de referencia (documentando que NO es la fuente de verdad).

[RESTRICCIONES]
- Cada tabla se crea con `enable row level security` en su misma migración,
  pero las POLÍTICAS van en la Fase 2.3 — no las escribas aún.
- Nada de datos (el seed es la Fase 2.5).
- Las migraciones deben reconstruir todo con `supabase db reset` sin
  intervención manual.
- Precios numeric(12,2) con check > 0; stock integer >= 0; rating 1–5;
  todos los unique compuestos de la spec (cart, favorites, reviews).
- order_items lleva title_snapshot y price_snapshot (histórico inmutable) y
  seller_id denormalizado — respeta la justificación de la spec.
- La función create_order_from_cart: SECURITY DEFINER, set search_path = public,
  revoke a public/anon y grant execute solo a authenticated.

[EJEMPLOS] Convención de nombres de migración (una por bloque lógico):
  20260819100000_enable_extensions.sql
  20260819100100_create_profiles.sql
  20260819100200_create_categories.sql
  ... (orden = orden de dependencia)
Ejemplo del estilo de comentario esperado dentro del SQL:
  -- Un like/favorito único por (usuario, producto): evita duplicados por
  -- doble clic y simplifica el toggle en el frontend.

[RAZONAMIENTO] Primero lista las tablas en orden de dependencia (qué debe
existir antes de qué) y los puntos donde la spec deja alguna decisión abierta;
resuélvelos declarando tu supuesto en un comentario SQL. Después escribe las
migraciones.

[FORMATO DE SALIDA] (1) Lista de migraciones creadas en orden con una línea de
descripción cada una; (2) resultado de `supabase db reset` limpio;
(3) schema.sql actualizado.
```

## Prompt Fase 2.3 — Políticas RLS

```text
[ROL] Actúa como especialista en seguridad de bases de datos PostgreSQL,
experto en Row Level Security de Supabase y en sus errores típicos
(políticas que re-evalúan auth.uid() por fila, GRANTs faltantes).

[CONTEXTO] MercadoTech con el esquema de la Fase 2.2 aplicado: 15 tablas con
RLS habilitado pero SIN políticas (hoy todo está denegado por defecto). La
tabla de políticas por tabla/operación está en mercadotech/MercadoTech_sesion2.md,
Fase 2.3 — es el contrato exacto a implementar.

[OBJETIVO] Genera la migración de políticas RLS para las 15 tablas cubriendo
SELECT/INSERT/UPDATE/DELETE según la tabla de la spec, más: función helper
is_admin() (SECURITY DEFINER, search_path fijado), protección de la columna
profiles.role (un usuario no puede auto-promoverse), y TODOS los GRANTs de la
Data API para anon y authenticated. Actualiza supabase/policies.sql como
referencia.

[RESTRICCIONES]
- Usa `(select auth.uid())` en las políticas, nunca `auth.uid()` a secas
  (evita re-evaluación por fila).
- orders y order_items NO aceptan INSERT directo del cliente: solo vía la
  función create_order_from_cart. Las políticas deben reflejarlo.
- El vendedor solo avanza el status de pedidos que contengan ítems suyos;
  el comprador solo cancela pedidos 'pendiente'.
- Las reseñas exigen pedido 'entregado' que contenga el producto (EXISTS
  sobre orders + order_items dentro de la política).
- No olvides los GRANTs: RLS sin GRANT produce errores opacos de permiso
  (lección documentada en el README del plan).

[EJEMPLOS] Estilo esperado (nombre descriptivo + comentario con la regla de
negocio):
  -- Los compradores solo ven y editan SU propio carrito.
  create policy "cart_items_select_own" on public.cart_items
    for select using ((select auth.uid()) = user_id);

[RAZONAMIENTO] Antes del SQL: recorre tabla por tabla enumerando actor →
operación → condición, y contrástalo contra la tabla de la spec. Si detectas
una celda ambigua o contradictoria, señálala y propón resolución ANTES de
implementar. Después escribe la migración.

[FORMATO DE SALIDA] (1) La migración con políticas agrupadas por tabla;
(2) policies.sql actualizado; (3) tabla resumen final: tabla × operación ×
quién puede, para verificación visual contra la spec.
```

## Prompt Fase 2.4 — Storage: buckets y políticas

```text
[ROL] Actúa como ingeniero backend experto en Supabase Storage y sus políticas
sobre storage.objects.

[CONTEXTO] MercadoTech con esquema y RLS aplicados (Fases 2.2–2.3). Aún no
existe ningún bucket. La spec es mercadotech/MercadoTech_sesion2.md, Fase 2.4.

[OBJETIVO] Genera la migración que crea los buckets `product-images` y
`avatars` (ambos de lectura pública) con sus políticas de escritura/borrado:
cada usuario solo escribe dentro de su propia carpeta raíz.

[RESTRICCIONES]
- Convención de paths OBLIGATORIA: product-images/{seller_id}/{product_id}/{n}.{ext}
  y avatars/{user_id}/... — la política compara el PRIMER segmento del path
  con (select auth.uid()).
- Límites por bucket: solo MIME de imagen (image/jpeg, image/png, image/webp),
  máximo 5 MB.
- Sin políticas de UPDATE sobre objetos si no son necesarias (subir + borrar
  basta para el flujo del vendedor); si decides lo contrario, justifícalo en
  un comentario.

[EJEMPLOS] Condición típica de "carpeta propia":
  (storage.foldername(name))[1] = (select auth.uid())::text

[FORMATO DE SALIDA] (1) Migración de buckets + políticas; (2) tabla resumen:
bucket × operación × quién puede × condición de path; (3) nota en schema.sql
o policies.sql de referencia según corresponda.
```

## Prompt Fase 2.5 — Datos de prueba (seed.sql)

```text
[ROL] Actúa como QA data engineer que diseña datos de prueba REALISTAS para
un marketplace de tecnología peruano.

[CONTEXTO] MercadoTech con esquema, RLS y Storage listos (Fases 2.2–2.4). El
seed se ejecuta con `supabase db reset` después de las migraciones. Cantidades
y composición exactas: mercadotech/MercadoTech_sesion2.md, Fase 2.5. Estos
datos alimentarán TODAS las sesiones siguientes: las pantallas de la sesión 3,
el RAG de la sesión 4 (los artículos de FAQ se vectorizan tal cual) y los
tests E2E de la sesión 6 (los usuarios del seed son los usuarios de prueba).

[OBJETIVO] Genera supabase/seed.sql completo: 6 usuarios (3 buyers, 2 sellers,
1 admin) en auth.users + profiles; 8 categorías tech; ~16 productos repartidos
entre los 2 vendedores (2 inactivos, 1 con stock 0); product_images con paths
coherentes con la convención del bucket; pedidos en LOS 5 estados con sus
order_items y snapshots correctos; 6+ preguntas (mitad respondidas); reseñas
solo sobre pedidos 'entregado'; favoritos y product_views; 10 artículos de FAQ
con contenido real; 2 tickets con mensajes.

[PÚBLICO/TONO] El contenido visible (títulos, descripciones, preguntas,
reseñas, FAQ) va en español neutro, verosímil para un usuario peruano: precios
en soles coherentes con el mercado (una laptop gama media no cuesta S/ 100),
marcas reales (Lenovo, Logitech, Samsung...), reseñas con voz de comprador
real. Los artículos de FAQ deben tener 2–4 párrafos ÚTILES de verdad (política
de devoluciones, tiempos de envío, métodos de pago simulados, gestión de
cuenta) — nada de lorem ipsum: serán la base de conocimiento del asistente.

[RESTRICCIONES]
- Respetar TODAS las constraints: FKs, uniques compuestos, checks de precio/
  stock/rating, y la regla de reseñas (solo compradores con pedido entregado
  de ese producto).
- Contraseña común de laboratorio: MercadoTech123! — documentada en comentario.
- UUIDs fijos y legibles por prefijo (a000... usuarios, b000... productos,
  c000... pedidos...) para poder referenciarlos en tests.
- Documentar en comentario el gap conocido: los paths de product_images no
  tienen archivo real en Storage hasta subirlo por la UI.

[EJEMPLOS] Estilo de producto esperado:
  ('b0000000-0000-0000-0000-000000000001', <seller1>, <cat_laptops>,
   'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD',
   'Ideal para estudios y teletrabajo... (2-3 frases reales)',
   'Lenovo', 'nuevo', 2199.00, 8, true)

[FORMATO DE SALIDA] Un único supabase/seed.sql organizado por secciones con
encabezados comentados, ejecutable sin errores por `supabase db reset`;
al final, un bloque de comentario con el resumen: conteos por tabla y
credenciales de los 6 usuarios.
```

## Prompt Fase 2.6 — Validación de políticas RLS

```text
[ROL] Actúa como QA de seguridad especializado en probar Row Level Security:
tu trabajo es intentar romper las políticas, no confirmar que funcionan.

[CONTEXTO] MercadoTech con esquema + RLS + seed aplicados (Fases 2.2–2.5).
Usuarios y datos disponibles: los del seed (3 buyers, 2 sellers, 1 admin, con
UUIDs fijos). Escenarios mínimos exigidos: mercadotech/MercadoTech_sesion2.md,
Fase 2.6 (son 9).

[OBJETIVO] Genera supabase/tests/rls-validation.sql (o un archivo por tabla si
queda más legible) con pruebas ejecutables que simulen cada actor usando
`set local role` + `request.jwt.claims`, cubriendo los 9 escenarios de la spec
más los casos negativos que se te ocurran al leer las políticas reales.

[RESTRICCIONES]
- Cada prueba declara su RESULTADO ESPERADO en un comentario inmediatamente
  encima (filas devueltas, error de permiso, o excepción de la función).
- Las pruebas NO usan service role (probaría nada); la única excepción
  permitida es preparar estado, y debe estar marcada como tal.
- Los escenarios de create_order_from_cart cubren: carrito vacío → error;
  stock insuficiente → error nombrando el producto; éxito → pedido creado,
  stock descontado, carrito vacío.
- Todo dentro de begin/rollback donde sea posible, para no ensuciar el seed.

[EJEMPLOS] Patrón esperado por prueba:
  -- ESCENARIO 4: seller2 intenta editar un producto de seller1.
  -- ESPERADO: 0 filas afectadas (la política products_update_own lo bloquea).
  begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub": "<uuid seller2>", "role": "authenticated"}';
  update public.products set price = 1.00 where id = '<uuid producto de seller1>';
  rollback;

[RAZONAMIENTO] Antes de escribir las pruebas: lee las políticas REALES de la
migración de la Fase 2.3 (no la spec) y deriva de ellas la lista de escenarios;
compárala con los 9 de la spec y agrega los que falten. Un escenario que la
spec no pidió pero la política permite/deniega también merece prueba.

[FORMATO DE SALIDA] (1) Los archivos de prueba; (2) tabla de resultados tras
ejecutarlos: escenario × esperado × obtenido × ✅/❌; (3) si algo dio ❌, el
diagnóstico (¿política mal escrita o prueba mal planteada?) ANTES de proponer
el fix.
```

## Prompt Fase 2.7 — Documentación técnica

```text
[ROL] Actúa como technical writer con criterio de arquitecto: documentas
decisiones y porqués, no solo inventarios de archivos.

[CONTEXTO] MercadoTech al cierre de la sesión 2: infraestructura completa
(proyecto Next.js, 15 tablas, RLS, Storage, seed, validación). Todo lo
construido está en el repo; la spec de referencia es
mercadotech/MercadoTech_sesion2.md, Fase 2.7.

[OBJETIVO] Genera docs/ARQUITECTURA.md cubriendo: arquitectura general y capas;
organización de carpetas; modelo relacional con diagrama mermaid ER; decisiones
de diseño con su porqué (snapshots en order_items, checkout como función
transaccional, seller_id denormalizado para RLS, product_views como eventos);
integración Next.js ↔ Supabase; flujo de autenticación (middleware + cookies);
estrategia de escalabilidad; y descripción de cada política RLS en lenguaje de
negocio.

[PÚBLICO/TONO] Un desarrollador nuevo que se une al proyecto y NO estuvo en las
sesiones: español claro, directo, sin asumir contexto del curso. Cada decisión
con su porqué en 2–4 líneas, no ensayos.

[RESTRICCIONES]
- Documenta lo CONSTRUIDO, no el plan: si el código difiere de la spec en
  algo, gana el código (y lo señalas en una nota).
- No dupliques la referencia SQL completa (para eso están schema.sql y
  policies.sql — enlázalos).
- Sin promesas de sesiones futuras salvo una sección corta final
  "Qué sigue" (frontend S3, RAG S4, voz S8).

[RAZONAMIENTO] Antes de escribir: lee las migraciones y políticas reales del
repo (no de memoria ni de la spec) y construye el diagrama ER desde el SQL.

[FORMATO DE SALIDA] docs/ARQUITECTURA.md con tabla de contenidos, secciones en
el orden del objetivo, diagrama mermaid ER, y una tabla final de políticas RLS
(tabla × operación × regla de negocio en una frase).
```

---

## Nota sobre la rúbrica

La regla "mínimo 4 ítems" que se enseña en cursos es una **heurística de
suficiencia**, no una ley: su función es evitar prompts de una línea sin
criterio de éxito. El criterio real es otro: *¿el prompt elimina la ambigüedad
importante y hace verificable el resultado?* En estas 7 fases eso se logra
siempre con Contexto + Objetivo + Restricciones + Formato; Razonamiento se
agrega cuando conviene planificar antes de ejecutar (esquema, RLS, validación);
Ejemplos cuando hay una convención de estilo que imitar (naming, políticas,
datos); y Público/tono solo donde el output es contenido para humanos (seed y
documentación). Rol se usa aquí como fijador del estándar de calidad — es el
ítem más prescindible de todos si el resto está bien escrito.
