# MercadoTech — Sesión 5: Custom Skills y Protocolo MCP

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion5.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 5.1: crea las 4 Skills de gobernanza del proyecto."
3. "Ejecuta la Fase 5.2: scaffolding del servidor MCP."
4. "Ejecuta la Fase 5.3: implementa las Tools del servidor MCP."
5. "Ejecuta la Fase 5.4: implementa los Resources y Prompts del servidor MCP."
6. "Ejecuta la Fase 5.5: registra y valida el servidor MCP."
7. "Ejecuta la Fase 5.6: corre las Skills sobre el código de las sesiones 2–4 y corrige los hallazgos."

---

## Objetivo general

Extender Claude Code con conocimiento propio del proyecto: cuatro **Skills** que
hacen cumplir la arquitectura y la calidad de MercadoTech, y un **servidor MCP**
que expone la plataforma (solo lectura) a cualquier cliente MCP, reutilizando
los services existentes sin duplicar lógica.

## Objetivos específicos

* Comprender la extensión del modelo mediante Skills.
* Crear un servidor MCP para conectar Claude al entorno de MercadoTech.
* Desarrollar Skills personalizadas (enforcement, revisión, validación, tech lead).
* Aplicar lógica de validación automática sobre el código ya escrito (lab del curso:
  ejecutar la Skill "Tech Lead" y corregir malas prácticas SOLID detectadas).

## Tecnologías

* Claude Code Skills (`.claude/skills/<nombre>/SKILL.md`).
* `@modelcontextprotocol/sdk` (TypeScript) sobre transporte **stdio**.
* `zod` para schemas de inputs (fijar la versión compatible con el SDK — en
  ReadHub hubo que pinnear `3.25.76`; verificar la compatibilidad vigente).
* `tsup` para el build del servidor (no hay bundler de Next aquí) y `tsx` para dev.

---

# FASES

## Fase 5.1 — Skills de gobernanza (`.claude/skills/`)

**Prompt sugerido:** "Ejecuta la Fase 5.1 de `MercadoTech_sesion5.md`."

Crear 4 Skills. Cada `SKILL.md` lleva frontmatter (`name`, `description` con
disparadores claros) y cuerpo con reglas accionables. **Commitearlas al repo**
(en ReadHub quedaron sin versionar — no repetir el error).

### 1. `mercadotech-architecture-enforcer`

Gate PREVIO a crear/mover archivos. Verifica solo ubicación y dependencias:

* ¿Componente con fetching? → rechazar: el fetching va en un hook → service.
* ¿Service que importa React o algo de `app/`? → rechazar.
* ¿Alguien fuera de `lib/ai/` importando `@huggingface/*`? → rechazar.
* ¿Alguien fuera de `lib/voice/` usando Web Speech API? → rechazar.
* ¿Cliente admin importado fuera de Route Handlers/scripts? → rechazar.
* ¿Nueva capa REST para CRUD que ya funciona vía hooks+RLS? → rechazar.
* ¿Tunable hardcodeado fuera de `lib/constants/`? → rechazar.
* Fuente de verdad: `CLAUDE.md` del repo; ante contradicción, `CLAUDE.md` gana.

### 2. `mercadotech-code-reviewer`

Solo lectura, informe estilo PR con calificación /10, errores críticos,
importantes y sugerencias. Checklist específica del dominio:

* RLS: ¿la operación nueva respeta las políticas o intenta esquivarlas con admin?
* Pedidos: ¿se usan los snapshots o se leyó el precio actual del producto?
* Stock: ¿toda mutación de stock pasa por la función transaccional?
* RAG: ¿el orden búsqueda → contexto → completion se preservó? ¿tunables en constants?
* TypeScript estricto, manejo de errores con mensajes accionables, sin `any`.

### 3. `mercadotech-automatic-validator`

Gate binario: VALIDACIÓN APROBADA / FALLIDA (un solo ítem fallido = todo falla,
sin "aprobado con observaciones"). Checklist fija: reglas del enforcer + errores
críticos del reviewer + `npm run lint` + `tsc --noEmit` + (desde la sesión 6)
`npm run test`. No corrige código: reporta qué y dónde.

### 4. `mercadotech-tech-lead`

Juicio de diseño, scorecard ponderado (no binario): SRP/SOLID, acoplamiento
entre capas, deuda técnica, mantenibilidad, escalabilidad de decisiones nuevas,
y si el pipeline RAG conserva su orden. Anclado en las restricciones REALES del
repo (`CLAUDE.md`), no en dogma de libro.

## Fase 5.2 — Scaffolding del servidor MCP

**Prompt sugerido:** "Ejecuta la Fase 5.2 de `MercadoTech_sesion5.md`."

1. Carpeta `mcp/` dentro del repo (o `apps/mcp` si se decide monorepo — ver
   nota al final) con `package.json` propio, `tsconfig.json`, `tsup.config.ts`.
2. `src/index.ts` (entrada, transporte stdio) y `src/server.ts` (metadata del
   servidor: nombre `mercadotech`, versión, capabilities).
3. **Regla stdio crítica**: redirigir `console.log` → `stderr` desde la primera
   línea (stdout es el canal JSON-RPC; un log lo corrompe).
4. `src/context.ts`: fábrica de contexto POR LLAMADA (no al arrancar) que crea
   el cliente Supabase (anon para lecturas públicas; admin solo si una tool
   documentada lo exige) y expone los services REUTILIZADOS del proyecto —
   el servidor MCP no reimplementa lógica de negocio, importa
   `services/*.service.ts` y `lib/ai/*` existentes.
5. `src/lib/`: `tool-result.ts` (formateo consistente), `errors.ts`
   (errores tipados), `safe.ts` (wrapper try/catch uniforme).
6. `.env.example` propio: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `HUGGINGFACEHUB_API_TOKEN` (solo para tools semánticas).

## Fase 5.3 — Tools (10, un archivo por tool)

**Prompt sugerido:** "Ejecuta la Fase 5.3 de `MercadoTech_sesion5.md`."

Registro central en `src/tools/index.ts` (agregar una tool = un archivo + una
línea). Inputs validados con zod. Todas de solo lectura salvo la #10.

| # | Tool | Descripción |
|---|---|---|
| 1 | `search_products` | búsqueda por texto con filtros (categoría, precio, condición) |
| 2 | `get_product` | detalle completo: producto + imágenes + rating + preguntas |
| 3 | `list_categories` | árbol de categorías con conteo de productos |
| 4 | `semantic_search_products` | búsqueda vectorial (reutiliza `vector-search.service`) |
| 5 | `ask_assistant` | RAG completo modo compras o soporte (reutiliza `chat.service`) |
| 6 | `compare_products` | recibe 2-4 ids y produce comparación estructurada (specs, precio, rating) |
| 7 | `find_related_products` | similares por embedding a un producto dado |
| 8 | `summarize_reviews` | resumen de reseñas de un producto (completion sobre reseñas reales) |
| 9 | `get_store_stats` | agregados: productos por categoría, rating promedio, top vendidos |
| 10 | `get_order_status` | estado de un pedido por id — REQUIERE identificador verificable; documentar que en producción exigiría auth del comprador. **Esta tool la reutilizará el agente de voz (sesión 8)** |

## Fase 5.4 — Resources (7) y Prompts (5)

**Prompt sugerido:** "Ejecuta la Fase 5.4 de `MercadoTech_sesion5.md`."

Resources (URIs estables; `resources/list` nunca debe fallar por completo —
cada resource captura sus propios errores):

| URI | Contenido |
|---|---|
| `mercadotech://info` | descripción de la plataforma y capacidades del servidor |
| `mercadotech://products` | listado de productos activos (resumen) |
| `mercadotech://products/{id}` | template: detalle de un producto |
| `mercadotech://categories` | categorías |
| `mercadotech://sellers/{sellerId}` | perfil público del vendedor + sus productos |
| `mercadotech://faq` | artículos de soporte publicados |
| `mercadotech://stats` | estadísticas agregadas |

Prompts (parametrizados, obtienen contenido vía los mismos services — sin
duplicar el pipeline):

1. `describir_producto(productId)` — redacción de ficha atractiva y fiel.
2. `comparar_productos(ids)` — tabla comparativa + recomendación por perfil de uso.
3. `redactar_respuesta_pregunta(questionId)` — borrador de respuesta para el vendedor.
4. `resumen_de_resenas(productId)` — pros/contras según compradores.
5. `generar_articulo_faq(tema)` — borrador de artículo de soporte nuevo.

## Fase 5.5 — Registro y validación

**Prompt sugerido:** "Ejecuta la Fase 5.5 de `MercadoTech_sesion5.md`."

1. `.mcp.json` en la raíz del repo apuntando al servidor por stdio
   (`command: "npx", args: ["tsx", "mcp/src/index.ts"]` en dev; `node dist/…` en build).
2. Validar con MCP Inspector (`npx @modelcontextprotocol/inspector`): listar y
   ejercitar cada tool/resource/prompt con casos reales del seed.
3. Probar desde Claude Code: "usa la tool `compare_products` con dos laptops
   del catálogo" y verificar respuesta coherente.
4. `mcp/README.md`: arquitectura, decisiones (por-llamada vs arranque, stdio y
   console.log, por qué reutiliza services), variables, comandos, tabla de
   tools/resources/prompts.

## Fase 5.6 — Lab: validación automática aplicada

**Prompt sugerido:** "Ejecuta la Fase 5.6 de `MercadoTech_sesion5.md`: corre `mercadotech-tech-lead` y `mercadotech-code-reviewer` sobre el código de las sesiones 2–4, lista los hallazgos y aplícales corrección uno por uno."

1. Ejecutar la Skill tech-lead sobre `services/` y `hooks/` completos.
2. Ejecutar el code-reviewer sobre `lib/ai/` y los Route Handlers.
3. Consolidar hallazgos en `docs/REVISION_S5.md` (hallazgo → severidad →
   corrección aplicada o justificación de no corregir).
4. Cerrar con `mercadotech-automatic-validator`: debe terminar en VALIDACIÓN
   APROBADA antes de dar la sesión por concluida.

---

## Nota opcional: monorepo

Si el servidor MCP crece o se prevé otra app consumidora, replicar el patrón de
ReadHub: npm workspaces + Turborepo (`apps/web`, `apps/mcp`,
`packages/{types,config,database,ai,services,shared}`), exports por archivo sin
barrels, `transpilePackages` en Next. **No es obligatorio en esta sesión** — la
carpeta `mcp/` importando por path relativo/alias es suficiente para el laboratorio;
decidir con el criterio del tech-lead y documentar la decisión en `docs/ARQUITECTURA.md`.

## Restricciones de la sesión

* El servidor MCP es de SOLO LECTURA (ninguna tool muta datos de la plataforma).
* No duplicar lógica de negocio en `mcp/` — importar los services existentes.
* No exponer datos privados (carritos, tickets ajenos, emails) por ninguna tool/resource.
* Las Skills no editan código por sí mismas (reportan; la corrección es un paso aparte).

## Entregables

1. 4 Skills commiteadas en `.claude/skills/`.
2. Servidor MCP: 10 Tools, 7 Resources, 5 Prompts + `mcp/README.md`.
3. `.mcp.json` funcional.
4. `docs/REVISION_S5.md` con el ciclo hallazgo → corrección → validación aprobada.

## Criterios de aceptación de la sesión

* MCP Inspector lista y ejecuta las 10 tools sin errores con datos del seed.
* `ask_assistant` desde MCP produce la misma calidad de respuesta que la UI web.
* La Skill validator termina en APROBADA sobre el estado final del repo.
* `type-check` del workspace/carpeta `mcp/` pasa.
