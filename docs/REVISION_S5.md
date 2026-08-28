# Revisión de gobernanza — Sesión 5 (Fase 5.6)

Este documento es el resultado del laboratorio de la Fase 5.6: las cuatro
Skills creadas en la Fase 5.1 auditando el código de las sesiones 2–4 y el
servidor MCP recién construido. El ciclo es **hallazgo → veredicto →
evidencia**, y termina con el veredicto binario del validator.

La regla que gobierna los veredictos (decisión 10 de la spec): lo que
`docs/BITACORA.md` ya documenta como **deuda aceptada** se justifica con su
enlace, **no se re-corrige**. Solo lo nuevo y corregible se corrige.

## Cómo se ejecutó

| Paso | Skill invocada | Alcance |
|---|---|---|
| 1 | `mercadotech-tech-lead` | `services/` y `hooks/` completos, más `mcp/src/` |
| 2 | `mercadotech-code-reviewer` | `lib/ai/`, los 3 Route Handlers y `mcp/src/` |
| 3 | — | Consolidación en este documento |
| 4 | — | Correcciones, una por commit, de menor a mayor riesgo |
| 5 | `mercadotech-automatic-validator` | Estado final del repositorio |

**Nota de método, para que nadie la dé por supuesta:** la spec pedía correr
este laboratorio en una conversación nueva, porque las Skills se descubren al
arrancar la sesión. En esta ejecución el harness las detectó **en caliente**,
según se iban creando en la Fase 5.1, y las invocaciones de los pasos 1 y 2
cargaron el `SKILL.md` correspondiente de verdad. El reinicio no fue
necesario; si en otro entorno una Skill no se activa al nombrarla, hay que
reiniciar antes de continuar.

## Orden de corrección, y por qué

Se corrigió **de menor a mayor riesgo de romper algo**: primero configuración
que no afecta al runtime (ESLint), después un archivo de documentación
(`CLAUDE.md`), y al final el único cambio de código ejecutable (los Route
Handlers) — que además solo toca la rama `catch`, es decir, el camino que ya
estaba fallando. Nada de lo corregido altera el comportamiento visible de la
aplicación ni un contrato de service.

## Hallazgos

| # | Hallazgo | Origen | Severidad | Veredicto | Evidencia |
|---|---|---|---|---|---|
| 1 | Los tres Route Handlers pierden el diagnóstico de todo error de Supabase: `err instanceof Error` es **false** para un PostgrestError (objeto plano), así que cualquier fallo de base de datos llegaba como "Error desconocido…" | code-reviewer | Importante | **corregido** | `errorMessage()` en [lib/api-response.ts](../lib/api-response.ts), aplicado en los 3 handlers. lint + type-check + build ok |
| 2 | Los cuatro greps de arquitectura de `CLAUDE.md` daban **falsos positivos**: matcheaban los comentarios que explican por qué un archivo NO importa algo (`embedding.service.ts`, `vector-search.service.ts`) | tech-lead | Importante | **corregido** | Anclados a `^import` en [CLAUDE.md](../CLAUDE.md); los cuatro salen vacíos |
| 3 | ESLint analizaba `mcp/dist/index.js`, el bundle generado por tsup: 59 errores y 67 warnings de código que nadie escribió | validator (paso 5, primera pasada) | Importante | **corregido** | `mcp/dist/**` en los `ignores` de [eslint.config.mjs](../eslint.config.mjs); `npm run lint` vuelve a exit 0 |
| 4 | `service_role` bypasea RLS pero **no tiene privilegios de tabla**. El esquema concedía los GRANTs solo a `authenticated` (como corre la web); el MCP es el primer consumidor que corre como `service_role` y 4 tools fallaban con `42501` | Fase 5.3, al ejercitar las tools | Crítico | **corregido** | Migración [20260828200750_grant_service_role_mcp_reads.sql](../supabase/migrations/20260828200750_grant_service_role_mcp_reads.sql). Desviación consciente de la restricción "no tocar migraciones", aprobada explícitamente antes de aplicarla |
| 5 | La spec asume columnas `products.model`, `products.specs` y `reviews.title`; **el esquema real no las tiene** | Fase 5.3, type-check | Importante | **corregido** | Tools ajustadas a los campos reales; comentado en `compare-products.ts` y `product-detail.ts` |
| 6 | `mercadotech://faq` no tiene service que lo respalde: `support_articles` solo lo toca `embedding.service.ts`, en una función privada de un artículo a la vez | Prompt 1, contra `grep` de exports | Importante | **aceptado como deuda** | Resuelto como derivación documentada en [mcp/src/shared/faq.ts](../mcp/src/shared/faq.ts). Crear un service nuevo en la web está prohibido por las restricciones de la sesión. Candidato a sesión 7, si nace una pantalla de FAQ |
| 7 | `tool.handler as never` en el registro central de tools: único punto del servidor donde se apaga el compilador | code-reviewer | Sugerencia | **aceptado como deuda** | El arreglo (tipo `ToolDefinition` genérico + `satisfies`) es correcto pero no urgente: los tipos reales los garantiza cada archivo de tool, ya verificados por `tsc`. [mcp/src/tools/index.ts](../mcp/src/tools/index.ts) |
| 8 | `MAX_PAGES = 50` vive en `mcp/src/shared/stats.ts`, no en `lib/constants/` | code-reviewer | Sugerencia | **falso positivo** | `lib/constants/` es del proyecto **web**; esto es un tope de seguridad interno del MCP, no un tunable de negocio. La regla de `CLAUDE.md` no alcanza a `mcp/` |
| 9 | `useProductForm.ts` con 302 líneas orquestando 4 services | tech-lead | Importante | **aceptado como deuda** | Refactorizar el archivo que publica productos **sin tests** tiene más riesgo que beneficio. Propuesta para la sesión 6, después de Vitest |
| 10 | `listAllActiveProducts` pagina en cliente para calcular agregados | tech-lead | Sugerencia | **aceptado como deuda** | Trivial con 16 productos; a escala pide una vista SQL. El tope de páginas ya está escrito. Sin sesión asignada |
| 11 | Vulnerabilidad **low** en `esbuild` (transitiva de `tsup`) en `mcp/` | Prompt 0, `npm audit` | Sugerencia | **aceptado como deuda** | `npm audit fix` movería la versión que la lección 4 de la spec obliga a pinear. Solo afecta al dev server de esbuild en Windows, que este proyecto no usa |

## Deuda ya documentada (revisada, NO re-corregida)

Cada una se contrastó contra [docs/BITACORA.md](BITACORA.md) y sigue siendo la
decisión correcta hoy:

| Ítem | Dónde está documentada | Sigue vigente |
|---|---|---|
| `profiles` sin SELECT público | Sesión 3 §Deuda, ítem 1 | Sí, pero **ahora incomoda más**: el resource de vendedores necesitó `service_role` y filtrar columnas a mano. Una vista `public_profiles` resolvería web y MCP a la vez — sesión 7 |
| Cancelar un pedido no repone stock | Sesión 3 §Deuda, ítem 2 | Sí, sin cambios |
| Pedidos multi-vendedor | Sesión 3 §Deuda, ítem 3 | Sí, sin cambios |
| Búsqueda por `ilike` | Sesión 3 §Deuda, ítem 5 | Sí; la tool `search_products` la hereda a propósito, para no divergir de la web |
| Vulnerabilidades transitivas de `next@15.5.23` | Sesión 3 §Deuda, ítem 6 | Sí, exige Next 16 |
| Sin streaming en el chat | Sesión 4 §Deuda, ítem 3 | Sí, fuera de alcance |
| Historial de chat en memoria | Sesión 4 §Deuda, ítem 5 | Sí, decisión de alcance |
| Threshold único para ambas fuentes RAG | Sesión 4 §Deuda, ítem 1 | Sí; el MCP reutiliza los valores calibrados sin tocarlos |
| `source_id` sin FK dura | Sesión 4 §Deuda, ítem 2 | Sí, decisión de diseño |
| Sin tests automatizados | Sesiones 3 y 4 §Deuda | Sí — y **es la que más pesa ahora**: esta sesión agregó ~1.500 líneas en `mcp/` verificadas solo a mano. Sesión 6 |

## Scorecard del tech-lead

| Dimensión | Peso | Nota | Ponderado |
|---|---|---|---|
| Responsabilidad única (SRP) | 25% | 8 | 2.00 |
| Acoplamiento entre capas | 25% | 10 | 2.50 |
| Deuda técnica | 20% | 7 | 1.40 |
| Mantenibilidad | 15% | 9 | 1.35 |
| Escalabilidad de decisiones nuevas | 15% | 8 | 1.20 |
| **TOTAL** | **100%** | | **8.45/10** |

Calificación del code-reviewer sobre `lib/ai/` + Route Handlers + `mcp/src/`:
**8.5/10** (10 − 0 críticos − 1 importante − 2 sugerencias × 0.25).

**La prueba de fuego de la arquitectura la pasó esta sesión sin saberlo:** un
consumidor completamente nuevo, fuera de Next, se conectó a los 15 services
sin reescribir una sola línea de lógica de negocio. Eso solo funciona porque
la sesión 3 decidió que el cliente Supabase fuera inyectable y fuera siempre
el último parámetro.

## Commits de corrección

| Commit | Hallazgo | Verificación posterior |
|---|---|---|
| `b5bd3a4` | #4 (GRANTs de `service_role`) | Las 10 tools verdes contra el seed |
| `70fb01a` | #5 (columnas inexistentes) | `type-check` de `mcp/` exit 0 |
| Ver abajo | #1, #2, #3 | lint + type-check + build, exit 0 los tres |

## Salida del validator sobre el estado final

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| A1 | `@/lib/supabase` en `components`/`hooks` | ✅ vacío | — |
| A2 | `from "@/services"` en `components` | ✅ vacío | — |
| A3 | `@huggingface` fuera de `lib/ai/` | ✅ vacío | — |
| A4 | `lib/supabase/admin` fuera de `api/v1` | ✅ vacío | — |
| A5 | `lib/supabase/admin` importado en `mcp/src` | ✅ vacío | Solo se menciona en el comentario de `context.ts` |
| A6 | `mcp/src` importando `app/`, `components/`, `hooks/` | ✅ vacío | — |
| A7 | `console.log(` en `mcp/src` | ✅ vacío | La redirección vive en `stdout-guard.ts`, como primer import |
| B1 | Salidas con email, teléfono, comprador, carrito o ticket | ✅ ninguna | Los 2 hits del grep son los comentarios que prohíben la fuga |
| B2 | Ítems de pedido con snapshots | ✅ correcto | `price_snapshot` / `title_snapshot` |
| B3 | Mutación de stock fuera de `create_order_from_cart` | ✅ ninguna | — |
| B4 | Tunable nuevo hardcodeado fuera de `lib/constants/` | ✅ ninguno | — |
| B5 | `any` explícito introducido | ✅ ninguno | — |
| B6 | Cada `admin` con su política RLS al lado | ✅ correcto | 16 referencias, todas comentadas |
| C1 | `npm run lint` | ✅ exit 0 | — |
| C2 | `npm run type-check` | ✅ exit 0 | — |
| C3 | `npm run type-check` en `mcp/` | ✅ exit 0 | — |
| C4 | `npm run build` | ✅ exit 0 | — |
| C5 | `npm run test` | ⏭️ N/A (sesión 6) | El script no existe todavía |

```
VALIDACIÓN APROBADA
```

Primera pasada del validator: **FALLIDA** en C1, por el hallazgo 3 (ESLint
analizaba `mcp/dist/`). Corregido en `965a5b0` y re-invocado sobre el estado
nuevo, como exige la propia Skill.
