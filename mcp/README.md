# Servidor MCP de MercadoTech

Este directorio es un **proceso Node independiente** de la aplicación web. Su
trabajo es exponer MercadoTech, **en solo lectura**, a cualquier asistente de IA
que hable el protocolo MCP: Claude Code, Claude Desktop, el MCP Inspector o el
agente de voz que llega en la sesión 8.

La analogía que usa la spec: si la web es la tienda, esto es el **mostrador de
atención para asistentes**. Y la regla de oro es que el mostrador **no cocina**:
todo lo que sirve sale de la misma cocina que ya usa la web — los `services/` y
`lib/ai/` de las sesiones 3 y 4.

```
Claude Code / Claude Desktop / Inspector / agente de voz (sesión 8)
                    │  stdio (JSON-RPC)
                    ▼
        mcp/src  ·  10 Tools · 7 Resources · 5 Prompts
                    │
                    ▼
     services/*.service.ts  y  lib/ai/*     ← sin duplicar lógica
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Supabase local        Hugging Face
   (mismas tablas,       (solo las tools
    misma RLS)            semánticas)
```

## Comandos

Todo se lanza **desde la raíz del repositorio**, no desde `mcp/` (ver
"Decisiones", punto 5).

```bash
npx tsx mcp/src/index.ts
```

Arranca el servidor en desarrollo. Queda esperando por stdio: **no imprime nada
en stdout**; el banner de arranque sale por stderr.

```bash
npx @modelcontextprotocol/inspector npx tsx mcp/src/index.ts
```

Abre el MCP Inspector (UI web) contra el servidor. Es la lupa manual: permite
recorrer tools, resources y prompts a mano.

```bash
npx @modelcontextprotocol/inspector --cli npx tsx mcp/src/index.ts --method tools/list
```

El mismo Inspector sin interfaz, para scripts y CI.

```bash
node mcp/scripts/rpc.mjs tools/call '{"name":"search_products","arguments":{"search":"laptop"}}'
```

Cliente JSON-RPC mínimo incluido en este repo. Hace el `initialize` y ejecuta
los métodos que le pases, en orden. Sirve para dejar **evidencia reproducible**
de una verificación en un solo comando, y aborta si detecta que algo ensució
stdout. Con `MCP_TARGET=dist` prueba el build de producción en vez del fuente.

```bash
cd mcp && npm run build && node dist/index.js
```

Build de producción y arranque desde el bundle.

```bash
cd mcp && npm run type-check
```

## Requisitos

* El stack local de Supabase corriendo (`supabase start` desde la raíz).
* `knowledge_embeddings` poblada (`npx tsx scripts/index-all.ts`) — si está
  vacía, las tools semánticas devuelven cero resultados sin fallar.
* `.env.local` **en la raíz del repo** (este directorio no tiene `.env` propio):

| Variable | Sin ella |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | el servidor no arranca |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | el servidor no arranca |
| `SUPABASE_SERVICE_ROLE_KEY` | fallan las 5 operaciones que necesitan admin; el resto sigue |
| `HUGGINGFACEHUB_API_TOKEN` | fallan las 4 tools de IA; el resto sigue |

## Decisiones, y por qué

**1. stdout es sagrado.** Con transporte stdio, stdout transporta los mensajes
JSON-RPC. Un solo `console.log` — propio o de una dependencia — intercala texto
que el cliente no puede parsear y corta la sesión. Por eso `src/lib/stdout-guard.ts`
redirige `console.log/info/warn/debug` a stderr, y se importa **antes que
cualquier otro módulo** en `src/index.ts`. Ojo con el matiz: en ESM los `import`
se hoistean, así que poner la asignación "en la línea 1" del cuerpo de
`index.ts` correría *después* de que todos sus imports ya se ejecutaron. Un
módulo aparte importado primero sí garantiza el orden.

**2. Contexto por llamada, no al arranque.** `src/context.ts` construye los
clientes de Supabase en cada invocación. El servidor puede vivir horas colgado
de un cliente; un singleton creado al arrancar congela credenciales y
conexiones, y si el token rota o el socket muere no hay forma de recuperarse
sin reiniciar el proceso.

**3. Nunca se importa `lib/supabase/admin.ts`.** Ese archivo empieza con
`import "server-only"`, un guard que solo el bundler de Next sabe neutralizar;
bajo Node/tsx puro **lanza siempre**. Está comprobado en este repo: lo documenta
la cabecera de `scripts/index-all.ts`, que se golpeó con esto en la sesión 4.
`src/context.ts` construye un cliente equivalente con `@supabase/supabase-js`.

**4. Node no lee `.env.local` solo.** Eso lo hace Next. `src/env.ts` la parsea a
mano, con el mismo patrón que `scripts/index-all.ts`, y apunta a la `.env.local`
de la **raíz**: una sola fuente de credenciales, sin duplicar secretos aquí.

**5. Se lanza desde la raíz.** El alias `@/*` del `tsconfig.json` raíz resuelve
a `./*`. Ejecutar desde otra carpeta rompe los imports de `@/services/*`. En el
build, `tsup.config.ts` declara el alias explícitamente por la misma razón.

**6. anon por defecto, admin solo donde una política lo obliga.** Cada uso del
cliente admin lleva **junto a él** el comentario con la política RLS que lo
exige. Nunca "admin para todo por comodidad".

**7. `service_role` bypasea RLS, pero eso no le da privilegios de tabla.** Este
servidor es el primer consumidor del proyecto que corre como `service_role`, y
destapó que el esquema concedía los GRANTs solo a `authenticated` (que es como
corre la web). Cuatro tools fallaban con `42501 permission denied`. Lo arregla
la migración `20260828200750_grant_service_role_mcp_reads.sql`, que concede
**solo SELECT** sobre `orders`, `order_items`, `product_images`, `reviews` y
`profiles`, más EXECUTE sobre `match_knowledge`.

**8. Nada se cae del todo.** `src/lib/safe.ts` envuelve toda tool y todo
resource. Un error vuelve como *resultado* (`isError: true` en tools, contenido
con el error en resources), nunca como excepción que escape al transporte. Con
Supabase detenido, `resources/list` sigue respondiendo.

**9. Derivaciones, no services nuevos.** Cuando un dato no existe como service
(estadísticas, listado de FAQ, perfil público de vendedor), se **compone** en
`src/shared/` y se declara como derivación en el comentario del archivo. No se
agregan services al proyecto web "para el MCP".

**10. Prompts MCP ≠ Skills de Claude Code.** Los Prompts de este servidor son
plantillas que salen por el protocolo a cualquier cliente. Las Skills viven en
`.claude/skills/` y solo las carga Claude Code. Mismo curso, dos conceptos: no
mezclarlos ni en el código ni en la documentación.

## Privacidad

Ninguna tool ni resource devuelve datos personales: ni nombres de compradores,
ni emails, ni teléfonos, ni carritos, ni tickets. Las salidas se proyectan campo
por campo en vez de reenviar la fila completa, precisamente para que agregar una
columna a la base no filtre nada por accidente.

`get_order_status` merece una advertencia aparte: **en producción no bastaría**.
Hoy cualquiera con el id del pedido puede consultarlo. Un despliegue real debe
exigir autenticación del comprador antes de responder. Es aceptable aquí porque
el servidor corre en local contra el seed del curso.

## Tools (10)

| # | Tool | Reutiliza | Cliente |
|---|---|---|---|
| 1 | `search_products` | `product.service.listActiveProducts` | anon |
| 2 | `get_product` | `shared/product-detail` (product + images + reviews + questions) | anon |
| 3 | `list_categories` | `shared/stats.categoriesWithCount` | anon |
| 4 | `semantic_search_products` | `vector-search.service.searchProducts` | **admin** |
| 5 | `ask_assistant` | `chat.service.ask` (modos `compras` / `soporte`) | **admin** |
| 6 | `compare_products` | `product.service.getProductsByIds` + `review.service.getAverage` | anon |
| 7 | `find_related_products` | `lib/ai/embeddings` + `vector-search.service.searchByEmbedding` | **admin** |
| 8 | `summarize_reviews` | `review.service.listByProduct` + `lib/ai/completion` | anon |
| 9 | `get_store_stats` | `shared/stats.storeStats` | anon + **admin** |
| 10 | `get_order_status` | `order.service.getOrderById` | **admin** |

Por qué admin en cada caso: **#4, #5, #7** porque
`knowledge_embeddings_select_authenticated` es `to authenticated` y
`match_knowledge` no tiene EXECUTE para anon. **#9 (solo el top de vendidos) y
#10** porque `orders_select_*` y `order_items_select_*` conceden SELECT
únicamente al comprador dueño, al vendedor con ítems o al admin.

## Resources (7)

| URI | Contenido | Cliente |
|---|---|---|
| `mercadotech://info` | Plataforma y capacidades. **Estático**: responde aunque la base esté caída | — |
| `mercadotech://products` | Productos activos (resumen) | anon |
| `mercadotech://products/{productId}` | Detalle — template, lista sus instancias | anon |
| `mercadotech://categories` | Categorías con conteo | anon |
| `mercadotech://sellers/{sellerId}` | Solo `display_name` + productos activos — template | **admin** |
| `mercadotech://faq` | Artículos de soporte publicados | anon |
| `mercadotech://stats` | Agregados del catálogo | anon + **admin** |

`sellers/{sellerId}` usa admin porque `profiles_select_own_or_admin` no concede
SELECT público — la misma deuda por la que la web muestra "Usuario" y "Comprador
verificado" en vez de nombres.

## Prompts MCP (5)

| Prompt | Argumentos | Para qué |
|---|---|---|
| `describir_producto` | `productId` | Ficha comercial atractiva y fiel |
| `comparar_productos` | `productIds` (ids separados por coma) | Tabla comparativa + recomendación por perfil |
| `redactar_respuesta_pregunta` | `productId`, `questionId` | Borrador de respuesta del vendedor |
| `resumen_de_resenas` | `productId` | Pros y contras según compradores reales |
| `generar_articulo_faq` | `tema` | Borrador de artículo de soporte nuevo |

## Registro en Claude Code

`.mcp.json` en la raíz del repositorio ya declara el servidor:

```json
{ "mcpServers": { "mercadotech": { "command": "npx", "args": ["tsx", "mcp/src/index.ts"] } } }
```

Para usar el build de producción en vez del fuente, cambia a
`"command": "node", "args": ["mcp/dist/index.js"]` (requiere `npm run build`
previo dentro de `mcp/`).

Claude Code pedirá **aprobar el servidor** la primera vez: es lo esperado.
Después, `/mcp` lo lista con sus capacidades.

## Si algo falla

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| Claude Code no lo ve en `/mcp` | `.mcp.json` nuevo con la sesión ya abierta, o servidor sin aprobar | Reiniciar Claude Code y aprobarlo cuando pregunte |
| Conecta pero "se cae" al primer uso | Algo escribió en stdout | Buscar `console.log` que no pase por el guard; los logs van a stderr |
| Error de tipos al registrar tools | zod 4 instalado | Pinear `zod@^3.25.76` y reinstalar: el SDK 1.x no es compatible con zod 4 |
| `This module cannot be imported…` | Alguien importó `lib/supabase/admin.ts` | Usar `src/context.ts` (decisión 3) |
| `Faltan NEXT_PUBLIC_SUPABASE_URL…` | Lanzado fuera de la raíz | `npx tsx mcp/src/index.ts` **desde la raíz** |
| `permission denied … (42501)` | Falta un GRANT a `service_role` | Ver decisión 7 y la migración de la sesión 5 |
| Tools semánticas devuelven vacío | `knowledge_embeddings` sin poblar | `npx tsx scripts/index-all.ts` |
| Tools semánticas fallan con 401 | Token de Hugging Face ausente o modelo rotado | Misma tabla de síntomas que `docs/RAG.md` |
| `Cannot find module '@/services/…'` | Lanzado desde otra carpeta | Ver decisión 5 |
