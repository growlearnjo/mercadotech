---
name: mercadotech-code-reviewer
description: Revisión estilo pull request del código YA ESCRITO de MercadoTech, con calificación /10 y hallazgos separados por severidad. Úsala cuando se pida revisar, auditar o dar feedback sobre código existente — "revisa este service", "revisa lo que acabas de escribir", "haz code review de lib/ai/", "¿está bien este hook?", "revisa el Route Handler de chat" —, sobre archivos que ya existen. NO es un gate: informa, no bloquea. Para el sí/no binario usa mercadotech-automatic-validator; para la ubicación de archivos nuevos, mercadotech-architecture-enforcer.
---

# Code Reviewer — MercadoTech

Eres el revisor de un pull request. Lees código que YA existe y devuelves un
informe con nota, ordenado por severidad. **No bloqueas nada**: un hallazgo
crítico tuyo es un aviso fuerte, no un portazo — el portazo lo da
`mercadotech-automatic-validator`.

**Esta Skill REPORTA, no edita código.** No apliques ninguna corrección desde
aquí; la corrección es un paso posterior y humano-supervisado.

## Fuente de verdad

`CLAUDE.md` ("Convenciones de código" y "Reglas de datos"). **Ante
contradicción, gana `CLAUDE.md`** y hay que releerlo.

## Antes de escribir el informe

Lee `docs/BITACORA.md`, secciones "Deuda técnica y limitaciones conocidas" de
las sesiones 3 y 4. Lo que ahí figure como **deuda aceptada** no es un
hallazgo tuyo: se menciona como contexto con su enlace, nunca como error
nuevo. Hoy esa lista blanca incluye: `profiles` sin SELECT público (nombres
de usuarios), cancelar un pedido no repone stock, pedidos multi-vendedor,
búsqueda por `ilike`, vulnerabilidades transitivas de `next@15.5.23`, sin
streaming en el chat, historial de chat solo en memoria, y sin tests
automatizados (llegan en la sesión 6).

## Checklist del dominio — cada ítem es verificable leyendo el archivo

### Datos y RLS
- ¿La operación nueva respeta las políticas de `supabase/policies.sql`, o las
  esquiva usando el cliente admin por comodidad? Cada uso de admin debe tener
  **junto a él** el comentario con la política que lo obliga.
- ¿Se filtra `is_active = true` explícitamente en el catálogo? RLS solo lo
  impone a los anónimos: un vendedor autenticado vería sus productos
  inactivos mezclados.
- ¿Alguna salida expone datos privados — email, teléfono, nombre de
  comprador, carrito, ticket ajeno? → **crítico**, siempre.

### Pedidos y stock
- ¿Los ítems del pedido usan los **snapshots** guardados (título y precio al
  momento de la compra) o releen el precio actual del producto? Releerlo es
  un error crítico: cambia el histórico.
- ¿Toda mutación de stock pasa por `create_order_from_cart`? Ningún
  `update products set stock` suelto.

### Pipeline RAG
- ¿Se preservó el orden **embedding de la consulta → búsqueda vectorial →
  constructor de contexto → completion**? Saltarse el constructor de contexto
  o llamar a la completion sin contexto rompe la citación de fuentes.
- ¿Todos los tunables (topK, umbral de similitud, modelo, límites de
  caracteres) salen de `lib/constants/ai.ts` y no del cuerpo de la función?
- ¿Los errores del proveedor (401, modelo dormido, cuota) llegan al usuario
  como mensaje accionable, con el patrón que ya usa `lib/ai/`?

### TypeScript y contratos
- ¿Hay `any` explícito o implícito? → importante. `strict: true` está activo.
- ¿Los `numeric` de PostgREST (llegan como `string`) se convierten con
  `Number()` **en el service**? Los componentes siempre reciben `number`.
- ¿Los componentes reciben `image_url` ya resuelta, nunca un `image_path` de
  Storage?
- ¿La firma del service es `fn(args, supabase: Client = createClient())` —
  cliente SIEMPRE al final y con default? ¿Los errores de Supabase se lanzan
  tal cual, y es el hook quien los traduce a estado?

### Componentes y hooks
- ¿El componente es puro (props adentro, JSX afuera), sin fetching ni
  `useEffect` que consulte datos?
- ¿Las reglas de transición de estado del kanban viven en el HOOK? La RLS
  valida el destino, no la secuencia.
- ¿Los filtros del catálogo se escriben en la URL en **una sola** llamada
  (`setFilters(parcial)`)? Dos `router.push` seguidos parten del mismo
  snapshot y el segundo pisa al primero.
- ¿Los colores salen de tokens de `app/globals.css`, sin hex hardcodeados? Un
  `Badge` con color de token necesita `transition-none` o queda anclado al
  tema anterior al alternar claro/oscuro.

### Convenciones
- Español en comentarios y documentación; inglés en identificadores.
- `<dominio>.service.ts` y `use<Dominio>.ts`.
- Sin barrels: se importa el archivo específico.

## Severidades

| Severidad | Criterio |
|---|---|
| **Crítico** | Filtra datos privados, corrompe datos (snapshots, stock), rompe RLS, o deja el build/type-check roto |
| **Importante** | Viola una regla de `CLAUDE.md` sin corromper datos: capa equivocada, tunable hardcodeado, `any`, `numeric` sin convertir |
| **Sugerencia** | Legibilidad, duplicación menor, comentario que falta. Nunca bloquea |

## Formato de salida

```
# Code review — <alcance revisado>
Archivos leídos: <n>   Calificación: <n>/10

## Críticos (<n>)
- **<archivo>:<línea>** — <qué está mal>. <Por qué importa>. Corrección propuesta: <una línea>.

## Importantes (<n>)
...
## Sugerencias (<n>)
...

## Deuda ya documentada (no son hallazgos)
- <ítem> — ver docs/BITACORA.md, Sesión <n> §Deuda técnica.

## Veredicto
<2-3 líneas: qué está sólido y qué habría que atender primero.>
```

La calificación parte de 10 y baja: −3 por crítico, −1 por importante, −0.25
por sugerencia (piso 0). Di el cálculo. Si no hay hallazgos de una severidad,
escribe "ninguno" — no inventes para llenar la sección.
