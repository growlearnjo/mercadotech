# MercadoTech — Prompts específicos de la Sesión 5 (Skills y MCP)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase**. Lo
particular de esta sesión: (a) el producto de la Fase 5.1 son INSTRUCCIONES
para Claude, no código — así que Público/tono pesa como nunca (el "usuario"
de una Skill es el propio Claude de una sesión futura); (b) el servidor MCP
corre FUERA de Next.js, donde varias comodidades desaparecen (`.env.local`,
`server-only`, el bundler) — el Contexto de cada prompt carga esas trampas ya
resueltas para que el agente no las redescubra a golpes.

Todos asumen que existe `mercadotech/MercadoTech_sesion5.md` (la spec, versión
validada del 2026-08-26). La spec es la fuente de verdad; el prompt es el
disparador autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento | Modelo sugerido |
|---|---|---|---|---|---|---|---|---|---|
| 5.0 Entorno y dependencias | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Lectura de la spec | — | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 5.1 Skills de gobernanza | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Opus |
| 5.2 Scaffolding MCP | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 5.3 Tools | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Opus |
| 5.4 Resources y Prompts | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | Sonnet |
| 5.5 Registro y validación | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | Sonnet |
| 5.6 Lab de validación | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Opus |
| Cierre: bitácora + CLAUDE.md | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sonnet |

La columna "Modelo sugerido" sigue el criterio de la sesión 1 (no ejecutada —
sin `docs/COSTOS.md`): Opus donde el error cuesta caro o el juicio es fino
(redactar las reglas que gobernarán TODAS las sesiones futuras, la fontanería
stdio/env/contexto, la asignación anon/admin por tool, y el lab que toca
código en producción del curso); Sonnet para el resto.

---

## Cómo usar estos prompts

1. **Un prompt por turno, en orden, en conversación nueva** (o tras `/clear`).
2. **Dos reinicios obligatorios de sesión** que el flujo exige y no conviene
   saltarse: después de la Fase 5.1 (para que Claude Code descubra las Skills
   recién creadas) y después de crear `.mcp.json` en la 5.5 (para que
   descubra el servidor y pida aprobarlo). El prompt correspondiente lo
   recuerda al final.
3. **La Fase 5.6 se corre en conversación nueva** y consiste en INVOCAR las
   Skills, no en pedirle a Claude "que revise": la diferencia es el punto del
   laboratorio.
4. **Verificación visible por fase**: el Inspector de MCP es la lupa de esta
   sesión — casi toda evidencia sale de él o de `/mcp` en Claude Code.
5. **Commit por fase**: `feat:`/`chore:`/`docs:` + `for Fase 5.x`, como en
   las sesiones anteriores.

### Estado del repositorio al iniciar la sesión (verificado el 2026-08-26)

* Sesiones 2, 3 y 4 ejecutadas y commiteadas; `docs/BITACORA.md` al día
  (últimos commits: `d960477` Fase 4.8, `3e8e9b5` cierre S4). Las fases 2.6 y
  2.7 TAMBIÉN están hechas (la bitácora lo confirma).
* Sesión 1 NO ejecutada (sin `docs/COSTOS.md` ni `docs/PROMPTS.md`).
* 15 services en `services/`, `lib/ai/` completo, 3 Route Handlers en
  `app/api/v1/`, `scripts/index-all.ts` con el patrón `loadEnvLocal` + admin
  propio (la cabecera documenta por qué NO importa `lib/supabase/admin.ts`).
* `.claude/` existe pero SIN skills (solo `launch.json`). No hay `.mcp.json`.
* `tsx` instalado; FALTAN `@modelcontextprotocol/sdk`, `zod` y `tsup` (el
  `sdk` visible en `node_modules` es transitivo de shadcn — no cuenta).
* Deuda técnica ACEPTADA documentada en la bitácora (S3/S4): sin
  `public_profiles`, cancelar no repone stock, multi-vendedor, `ilike`
  provisional, vulnerabilidades transitivas de Next. La Fase 5.6 la trata
  como deuda justificada, no como hallazgo nuevo.

---

## Prompt 0 — Verificación del repo y dependencias del servidor MCP

```text
[ROL] Actúa como ingeniero DevOps que prepara el terreno para un proceso
Node independiente dentro de un repo Next.js: sabes que fuera de Next
desaparecen .env.local automática, "server-only" y el bundler.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Lee CLAUDE.md,
docs/BITACORA.md (secciones Sesión 4 y sus Pendientes) y las secciones
"Estado de partida" y "Guía de lecciones" de
mercadotech/MercadoTech_sesion5.md. Dato ya comprobado en este repo: la
cabecera de scripts/index-all.ts documenta que `server-only` lanza bajo
Node/tsx puro y cómo se resolvió (cliente admin propio + parseo manual de
.env.local) — ese patrón se reutilizará en el servidor MCP.

[OBJETIVO] Verifica y provisiona, en este orden:
1. Estado del repo: `git log --oneline | head -5` muestra el cierre de la
   sesión 4; `npm run build` pasa; stack local corriendo (`supabase status`,
   si no: `supabase start`); knowledge_embeddings poblada (24+ filas).
2. Confirma que .claude/skills/ NO existe todavía y que no hay .mcp.json
   (los crean las fases 5.1 y 5.5).
3. Verifica que el token HF sigue en .env.local (grep del NOMBRE de la
   variable, sin imprimir el valor) — lo usan 4 tools.
4. Crea la carpeta mcp/ con SOLO su package.json inicial (name
   "mercadotech-mcp", type module, private) e instala DENTRO de mcp/:
   `npm i @modelcontextprotocol/sdk@^1.29.0 zod@^3.25.76` y
   `npm i -D tsup@^8.5.1`. Las versiones van pineadas así porque el SDK 1.x
   no es compatible con zod 4 (lección 4 de la Guía — probado en ReadHub).
5. Smoke test del Inspector sin servidor propio:
   `npx @modelcontextprotocol/inspector --help` responde (el paquete baja y
   corre). No intentes conectarlo a nada todavía.
6. `npm run lint` y `npm run type-check` de la raíz siguen pasando.

[RESTRICCIONES]
- NO escribas código del servidor ni Skills: eso es 5.1+.
- NO instales nada en el package.json de la raíz.
- NO toques migraciones, seed ni la app web.
- No imprimas ningún valor de .env.local.

[RAZONAMIENTO] Antes de ejecutar, explica en 3 líneas por qué el servidor
MCP NO podrá importar lib/supabase/admin.ts y de dónde sale la prueba (está
escrita en este mismo repo). Si no encuentras esa prueba, búscala antes de
continuar.

[FORMATO DE SALIDA] (1) Tabla prerrequisito × estado × evidencia;
(2) mcp/package.json resultante; (3) versiones instaladas (npm ls dentro de
mcp/); (4) commit: "chore: provision MCP server dependencies for Sesión 5".
```

## Prompt 1 — Lectura de la spec (sin código)

```text
[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El Prompt 0 verificó
el repo y dejó mcp/ con sus dependencias pineadas. Vas a ejecutar la sesión
5 en 6 fases, una por prompt, cada una sin memoria de la anterior.

[OBJETIVO] Lee COMPLETOS, en este orden: CLAUDE.md;
mercadotech/MercadoTech_sesion5.md (incluidas la analogía del mostrador, el
glosario y la Guía de 9 lecciones de ReadHub — son decisiones cerradas);
docs/BITACORA.md (deuda técnica aceptada de S3/S4 — la Fase 5.6 la
necesitará); la cabecera de scripts/index-all.ts (lecciones 8-9 en vivo); y
la lista de exports de services/ (grep de "export" sobre
services/*.service.ts) — el servidor MCP solo puede usar lo que ahí exista.
Después confírmame que entiendes el alcance.

[RESTRICCIONES] No generes código. No propongas tools/resources nuevos ni
cambios de alcance. Si un service que la spec da por existente no aparece en
tu grep, repórtalo como bloqueo.

[RAZONAMIENTO] Explica en 5 líneas, con la analogía del mostrador, la
diferencia entre una Tool, un Resource y un Prompt MCP — y por qué un Prompt
MCP NO es una Skill de Claude Code (lección 2). Es la prueba de comprensión
de esta sesión.

[FORMATO DE SALIDA] (1) Resumen de 6 líneas, una por fase; (2) la
explicación Tool/Resource/Prompt/Skill; (3) la tabla anon/admin de la Fase
5.3 reproducida de memoria con el PORQUÉ de cada admin (RLS que lo obliga);
(4) dudas o bloqueos (o "ninguno"); (5) confirmación de no adelantar fases.
```

## Prompt Fase 5.1 — Skills de gobernanza

```text
[ROL] Actúa como tech lead que escribe los manuales de puesto de su equipo:
sabes que una regla ambigua es peor que ninguna, y que estas instrucciones
las leerá un Claude futuro SIN el contexto de esta conversación.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md COMPLETO (es la fuente de verdad que las 4 Skills harán
cumplir — cada regla de una Skill debe poder rastrearse a él o a la
estructura real del repo); mercadotech/MercadoTech_sesion5.md (Fase 5.1:
los 4 roles y sus checklists); docs/BITACORA.md (deuda aceptada: el
tech-lead debe contrastar contra ella, decisión 10); y la estructura real
con ls -R de components hooks services lib app. Referencia de formato: la
skill de ReadHub (frontmatter name + description con disparadores, cuerpo
con reglas accionables y cierre "CLAUDE.md gana") — su patrón está descrito
en la Guía de lecciones.

[OBJETIVO] Crea las 4 Skills en .claude/skills/, una carpeta con SKILL.md
cada una: mercadotech-architecture-enforcer (gate PREVIO, solo ubicación y
dependencias), mercadotech-code-reviewer (informe /10 con checklist del
dominio: RLS, snapshots, stock vía RPC, orden del pipeline RAG, numeric
como string), mercadotech-automatic-validator (binario: APROBADA/FALLIDA,
checklist fija incluyendo lint y type-check; el ítem npm run test queda
escrito como "desde la sesión 6"), mercadotech-tech-lead (scorecard
ponderado anclado en el repo real y en la deuda documentada). Commitea las
4 (lección 1: en ReadHub quedaron sin versionar).

[PÚBLICO/TONO] El lector es un Claude futuro sin este contexto: cada
description del frontmatter dice CUÁNDO activarse con ejemplos de
peticiones reales ("agrega una página que consulte…", "revisa este
service…"); cada regla es verificable con un grep o una lectura, no un
principio abstracto ("¿importa @huggingface fuera de lib/ai/? → rechazar",
no "mantener el desacoplamiento").

[RESTRICCIONES]
- Las Skills REPORTAN, no editan código — dilo explícitamente en las 4.
- El enforcer verifica SOLO ubicación/dependencias (ni estilo ni naming);
  el validator es binario sin "aprobado con observaciones"; el reviewer no
  bloquea, informa; el tech-lead pondera, no vota en binario.
- Ninguna regla nueva de tu invención: todo sale de CLAUDE.md, de la spec o
  de la estructura real. Ante contradicción, CLAUDE.md gana (escríbelo).
- El enforcer ya debe conocer las reglas del MCP que llega en 5.2-5.4
  (lógica MCP solo en mcp/; mcp/ no reimplementa services) — están en la
  spec, Fase 5.1.

[EJEMPLOS] Forma esperada de una regla del enforcer:
  - ¿Cliente admin importado fuera de app/api/v1/, scripts/ o
    mcp/src/context.ts? → rechazar y proponer la ubicación correcta.
Forma esperada de un ítem del validator:
  - [ ] `npm run type-check` exit 0 — si no, FALLIDA (pegar el error).

[RAZONAMIENTO] Antes de escribir: para cada Skill enuncia (a) su disparador,
(b) qué NO hace (el deslinde con las otras 3 — el mayor riesgo es que se
pisen), (c) su formato de salida. Luego redacta las 4.

[FORMATO DE SALIDA] (1) Árbol de .claude/skills/; (2) los 4 frontmatter
completos; (3) instrucción final para mí: REINICIAR la sesión de Claude
Code y, en conversación nueva, probar "crea un componente que consulte
productos directamente de Supabase" (debe activarse el enforcer y rechazar)
y correr el validator (debe dar APROBADA); (4) commit: "feat: add
governance skills for Fase 5.1".
```

## Prompt Fase 5.2 — Scaffolding del servidor MCP

```text
[ROL] Actúa como ingeniero de plataformas experto en el SDK TypeScript de
MCP y en procesos stdio: para ti stdout es un canal de datos, no una
consola.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion5.md (Fase 5.2 completa +
Guía de lecciones 3, 5, 8 y 9 + decisiones 1, 2 y 7); la cabecera y el
loadEnvLocal de scripts/index-all.ts (el patrón EXACTO a reutilizar para
env y cliente admin — está probado en este repo); lib/supabase/admin.ts
(solo para citar en un comentario POR QUÉ no puedes importarlo);
tsconfig.json de la raíz (alias @/* → ./*). En mcp/ ya están pineados
@modelcontextprotocol/sdk ^1.29.0, zod ^3.25.76 y tsup ^8.5.1 (Prompt 0).

[OBJETIVO] Ejecuta la Fase 5.2: mcp/package.json (scripts dev/build/start/
type-check), mcp/tsconfig.json (extiende el raíz, alias @/* → ../* para que
services/ y lib/ai/ resuelvan), mcp/tsup.config.ts (build a dist/
resolviendo el alias, target node20), mcp/src/index.ts (LÍNEA 1: redirigir
console.log/info/warn a stderr; luego cargar env, crear servidor, conectar
stdio), mcp/src/server.ts (name "mercadotech", versión, capabilities
vacías), mcp/src/env.ts (loadEnvLocal sobre la .env.local de la RAÍZ, con
error claro si faltan variables), mcp/src/context.ts (fábrica POR LLAMADA
que devuelve {anon, admin} construidos con @supabase/supabase-js — comenta
por qué no importa lib/supabase/admin.ts citando index-all.ts), y
mcp/src/lib/{tool-result,errors,safe}.ts.

[RESTRICCIONES]
- El servidor arranca VACÍO: cero tools/resources/prompts (eso es 5.3-5.4).
- mcp/ solo puede importar de services/, lib/ai/, lib/constants/ y types/
  del proyecto — jamás de app/, components/ ni hooks/ (en esta fase aún no
  importa nada de eso).
- Ningún console.log directo en todo mcp/src/ después de index.ts.
- El contexto se crea por llamada, no como singleton al arrancar (lección 5).

[EJEMPLOS] Primera línea de index.ts (lección 3):
  // stdout transporta JSON-RPC: cualquier log va a stderr o corrompe la sesión.
  console.log = console.info = console.warn = (...a) => console.error(...a);

[RAZONAMIENTO] Antes de codificar, responde en 4 líneas: (a) ¿qué pasa si
un import transitivo hace console.log? (por eso la redirección va en la
línea 1, no "donde haga falta"); (b) ¿por qué el contexto por llamada y no
al arranque? Luego implementa.

[FORMATO DE SALIDA] (1) Árbol de mcp/; (2) evidencia de arranque:
`npx tsx mcp/src/index.ts` desde la RAÍZ queda esperando sin escribir nada
en stdout; (3) el Inspector (`npx @modelcontextprotocol/inspector npx tsx
mcp/src/index.ts`) conecta y muestra el servidor con 0/0/0 — pega la
captura o transcripción; (4) type-check de mcp/ pasa; (5) commit: "feat:
scaffold MCP server over stdio for Fase 5.2".
```

## Prompt Fase 5.3 — Tools

```text
[ROL] Actúa como ingeniero de integraciones que expone un sistema existente:
tu métrica de éxito es cuánta lógica NO escribiste porque ya existía.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion5.md (Fase 5.3: la tabla de
10 tools con su service real, su cliente anon/admin y el porqué —
decisiones 3, 4, 6 y 8); las firmas reales de los services que vas a
reutilizar (grep "export" sobre services/product.service.ts,
category.service.ts, review.service.ts, question.service.ts,
vector-search.service.ts, chat.service.ts, order.service.ts — en
particular getProductsByIds y ask(query, mode)); lib/ai/embeddings.ts y
completion.ts; el scaffolding de mcp/src/ (5.2). La RLS que obliga cada
admin está en supabase/policies.sql si necesitas verificarla.

[OBJETIVO] Ejecuta la Fase 5.3: las 10 tools de la tabla de la spec, un
archivo por tool en mcp/src/tools/, registro central en tools/index.ts
(una tool = un archivo + una línea), inputs con zod, salidas con
tool-result, todo envuelto en safe.ts. La derivación de agregados
(list_categories con conteo, get_store_stats) vive en mcp/src/shared/
stats.ts componiendo services existentes, con comentario que la declara
derivación (lección 6). Cada tool que usa admin lleva junto a su registro
el comentario con la política RLS que lo obliga.

[PÚBLICO/TONO] Las descripciones de las tools las lee un modelo para
ELEGIR cuál usar: en español, empezando por qué pregunta responde
("Busca productos por significado, no por palabras exactas…"), con sus
parámetros explicados en lenguaje llano.

[RESTRICCIONES]
- Toda llamada a un service pasa el cliente EXPLÍCITO del contexto
  (decisión 8): jamás confiar en el default del service.
- Solo lectura absoluta: ninguna tool inserta/actualiza/borra nada.
- get_order_status devuelve SOLO estado, fecha, total e ítems snapshot —
  ningún dato del comprador; comenta que en producción exigiría auth
  (lo reutiliza el agente de voz de la sesión 8).
- Las 4 tools que usan Hugging Face (#4, #5, #7, #8) devuelven el error
  accionable de lib/ai/ como error de tool — el servidor nunca se cae por
  falta de token.
- Cero lógica de negocio nueva: si un dato no sale de un service existente
  ni de una derivación documentada, la tool no lo ofrece.

[EJEMPLOS] Patrón de registro esperado (un archivo por tool):
  // tools/search-products.ts
  export const searchProductsTool = defineTool({
    name: "search_products",
    description: "Busca productos activos por texto y filtros…",
    inputSchema: z.object({ search: z.string().optional(), … }),
    handler: safe(async (input) => {
      const { anon } = createContext();
      const { items } = await listActiveProducts(toFilters(input), anon);
      return toolResult(items);
    }),
  });

[RAZONAMIENTO] Antes de codificar: recorre la tabla de la spec tool por
tool y confirma contra tu grep que el service y la función EXISTEN con esa
firma; si alguna no existe, detente y repórtalo (no la implementes tú).
Enumera también cuál cliente usa cada una y por qué — si terminas con más
de 5 tools en admin, algo leíste mal.

[FORMATO DE SALIDA] (1) Árbol de mcp/src/tools/ y shared/; (2) evidencia
del Inspector ejercitando las 10 con datos del seed (los casos de la spec:
laptops, la Lenovo, compare con 2 laptops, "audífonos para el gimnasio",
la FAQ de devoluciones, el pedido c…01 entregado, y un id inexistente →
error tipado); (3) confirmación de que sin token HF las 4 semánticas
degradan con error claro y las otras 6 siguen funcionando; (4) type-check
de mcp/; (5) commit: "feat: add 10 read-only MCP tools for Fase 5.3".
```

## Prompt Fase 5.4 — Resources y Prompts

```text
[ROL] Actúa como diseñador de APIs de contenido: URIs estables, respuestas
predecibles, y un listado que jamás se cae completo.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: CLAUDE.md; mercadotech/MercadoTech_sesion5.md (Fase 5.4: tablas de 7
resources y 5 prompts, decisión 5 — profiles sin SELECT público, el
resource de sellers usa admin y expone SOLO display_name + productos — y
lecciones 2 y 7); mcp/src/tools/ y shared/ (5.3 — los resources comparten
esas funciones, no las duplican); services/ticket.service.ts NO se usa
aquí (tickets son privados). El patrón de templates con callback list y el
de prompts que embeben contenido como resource vienen del MCP de ReadHub y
están descritos en la spec.

[OBJETIVO] Ejecuta la Fase 5.4: los 7 resources (info estático;
products; products/{id} y sellers/{sellerId} como ResourceTemplates con
callback list; categories; faq; stats) y los 5 prompts
(describir_producto, comparar_productos, redactar_respuesta_pregunta,
resumen_de_resenas, generar_articulo_faq), con registro central en sus
index.ts respectivos. Cada resource captura sus propios errores (lección
7). Cada prompt embebe el contenido real (producto/pregunta/reseñas) vía
las funciones compartidas de 5.3 y sus instrucciones remiten a las tools
existentes para profundizar.

[PÚBLICO/TONO] Los textos de los prompts son instrucciones para un modelo
en español: fieles a los datos ("no inventes especificaciones ni stock"),
con el tono comercial-honesto de la plataforma. El resource info describe
la plataforma para un asistente que la ve por primera vez.

[RESTRICCIONES]
- sellers/{sellerId}: SOLO display_name y productos activos — jamás phone,
  email ni rol; el comentario cita la política de profiles (decisión 5).
- Nada de tickets, carritos, favoritos ni pedidos en ningún resource.
- resources/list debe responder aunque Supabase esté caído (cada resource
  degrada solo — pruébalo con supabase stop / start).
- Los prompts NO reimplementan recuperación ni el pipeline RAG: embeben lo
  que las funciones compartidas ya devuelven (lección: son formularios, no
  motores).
- Terminología (lección 2): en código y docs de esta fase se llaman
  "Prompts MCP", nunca "Skills".

[FORMATO DE SALIDA] (1) Árbol de resources/ y prompts/; (2) Inspector:
resources/list completo con los templates listando instancias reales;
lectura de mercadotech://faq (10 artículos) y de mercadotech://sellers/
{seller1} (TecnoStore Perú + productos, nada más); (3) prueba de
degradación: con supabase stop, resources/list responde y cada resource
caído devuelve su error capturado (luego supabase start); (4) los 5
prompts con un id real devuelven plantilla + contenido embebido;
(5) type-check; (6) commit: "feat: add MCP resources and prompts for
Fase 5.4".
```

## Prompt Fase 5.5 — Registro y validación

```text
[ROL] Actúa como release engineer: tu trabajo es que OTRA persona (u otro
Claude) pueda conectar, probar y entender el servidor sin leerte la mente.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El servidor está
completo (5.2-5.4). Antes de escribir, lee:
mercadotech/MercadoTech_sesion5.md (Fase 5.5 y la tabla de síntomas);
mcp/src/ completo (vas a documentarlo); el README del MCP de ReadHub NO
está disponible aquí — el tuyo debe sostenerse solo.

[OBJETIVO] Ejecuta la Fase 5.5: (1) .mcp.json en la raíz con el servidor
"mercadotech" por stdio (npx tsx mcp/src/index.ts) y nota de la variante
de producción; (2) pasada COMPLETA por el Inspector: 10 tools, 7 resources,
5 prompts con los casos del seed, guardando evidencia; (3) `npm run build`
en mcp/ y verificación de que node mcp/dist/index.js arranca y el
Inspector conecta contra el build; (4) mcp/README.md: qué es, diagrama del
flujo, decisiones con su porqué (por llamada vs arranque, stdout/stderr,
por qué NO importa lib/supabase/admin.ts, anon vs admin por tool, env de
la raíz), comandos, y la tabla completa tools/resources/prompts × service
reutilizado × cliente.

[PÚBLICO/TONO] El README lo lee un alumno que no construyó el servidor:
cada comando copiable, cada decisión con su porqué en 2-3 líneas, la tabla
de síntomas de la spec enlazada o incluida.

[RESTRICCIONES]
- No cambies código del servidor salvo que la pasada del Inspector revele
  un bug (si lo hay: fix en commit separado, documentado).
- .mcp.json va commiteado (es del proyecto, no personal).
- No adelantes la prueba desde Claude Code: requiere reiniciar sesión — la
  dejas INDICADA como paso manual mío al final.

[FORMATO DE SALIDA] (1) .mcp.json; (2) tabla de la pasada completa:
elemento × caso probado × resultado; (3) evidencia del build de producción
conectando; (4) mcp/README.md; (5) instrucción final para mí: reiniciar
Claude Code, aprobar el servidor cuando lo pregunte, verificar con /mcp, y
pedirle: "usa la tool compare_products del servidor mercadotech con las
dos laptops del catálogo" y "pídele al asistente de compras una laptop
para diseño" — qué debo esperar de cada una; (6) commit: "feat: register
and document MCP server for Fase 5.5".
```

## Prompt Fase 5.6 — Lab: validación automática aplicada

```text
[ROL] Actúa como el equipo auditado, no como el auditor: las Skills son el
auditor. Tu trabajo es invocarlas, consolidar sus hallazgos con honestidad
y corregir sin romper nada.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/, CONVERSACIÓN NUEVA
con las Skills de la 5.1 ya cargadas (si al escribir el nombre de una
Skill no se activa, detente: hay que reiniciar la sesión). Antes de
empezar, lee: mercadotech/MercadoTech_sesion5.md (Fase 5.6 y decisión 10);
docs/BITACORA.md — las secciones de deuda técnica de S3 y S4 son la LISTA
BLANCA: lo que ya está documentado como deuda aceptada se justifica con su
enlace, no se re-corrige.

[OBJETIVO] Ejecuta el lab en este orden:
1. Invoca mercadotech-tech-lead sobre services/ y hooks/ completos →
   scorecard.
2. Invoca mercadotech-code-reviewer sobre lib/ai/, los 3 Route Handlers de
   app/api/v1/ y mcp/src/ → informe con calificación.
3. Consolida TODO en docs/REVISION_S5.md: una fila por hallazgo con
   hallazgo → severidad → veredicto (corregido / aceptado como deuda /
   falso positivo) → evidencia (commit del fix, enlace a la bitácora, o
   refutación).
4. Aplica las correcciones UNA POR UNA, cada una en su commit, verificando
   lint + type-check + build después de cada una.
5. Cierra invocando mercadotech-automatic-validator sobre el estado final:
   la salida literal (debe ser VALIDACIÓN APROBADA) va al final del
   documento.

[PÚBLICO/TONO] docs/REVISION_S5.md lo leerá un alumno como ejemplo de un
ciclo de revisión real: veredictos honestos ("falso positivo porque…",
"aceptado como deuda: ver bitácora §…"), sin maquillar hallazgos ni
inflar severidades.

[RESTRICCIONES]
- Las Skills reportan; TÚ corriges — nunca dejes que una "corrección"
  ocurra dentro de la invocación de una Skill.
- Ninguna corrección puede cambiar comportamiento visible de la app ni
  contratos de services (si un hallazgo lo exige, veredicto "aceptado como
  deuda" + propuesta para la sesión que corresponda).
- No re-corrijas la deuda documentada (decisión 10): public_profiles,
  stock en cancelación, multi-vendedor, ilike, vulnerabilidades de Next.
- Si el validator termina FALLIDA, se corrige y se re-invoca: la sesión no
  cierra en FALLIDA.

[EJEMPLOS] Fila esperada de REVISION_S5.md:
  | El hook useCart recalcula subtotal en el componente | importante |
  corregido (a1b2c3d) | movido al hook; lint/type-check/build ok |
  | profiles sin SELECT público impide mostrar nombres | — | aceptado
  como deuda | documentada en bitácora S3 §Deuda; candidata a sesión 7 |

[RAZONAMIENTO] Tras consolidar y ANTES de corregir: clasifica los
hallazgos por riesgo de la corrección (¿puede romper algo?) y corrige de
menor a mayor riesgo. Justifica el orden en una línea.

[FORMATO DE SALIDA] (1) docs/REVISION_S5.md completo; (2) lista de commits
de corrección; (3) salida literal del validator (APROBADA); (4) commit
final: "docs: add governance review cycle for Fase 5.6".
```

## Prompt de cierre — Bitácora de la sesión y actualización de CLAUDE.md

```text
[ROL] Actúa como tech lead que cierra una iteración: documentas lo
construido, lo decidido y lo pendiente, para que la sesión 6 (testing)
arranque sin arqueología.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 5.0-5.6
están implementadas y commiteadas. Obtén el estado REAL: `git log
--oneline` (identifica el cierre de la sesión 4, commit 3e8e9b5, y el
rango de la 5), `git diff --stat 3e8e9b5..HEAD`, `ls -R .claude mcp docs`,
docs/REVISION_S5.md, y lee docs/BITACORA.md, CLAUDE.md y
mercadotech/MercadoTech_sesion5.md (decisiones, restricciones,
entregables). Pendiente heredado conocido: sesión 1 no ejecutada.

[OBJETIVO] (1) Agregar a docs/BITACORA.md la sección "Sesión 5" (arriba de
la 4): por fase, commits, qué se construyó, decisiones con su porqué (las
10 de la tabla de la spec que se hayan ejercido: server-only, env de la
raíz, anon/admin por tool, sellers solo display_name…), problemas reales y
solución (¿zod? ¿stdout? ¿alias en el build?), el resultado del lab 5.6
(cuántos hallazgos, cuántos corregidos/aceptados/falsos positivos), y qué
quedó fuera (monorepo, tools de escritura, voz). Cerrar con criterios de
aceptación ✅/❌ con evidencia y pendientes para la sesión 6. (2) Actualizar
CLAUDE.md quirúrgicamente: el mapa de capas gana mcp/ (reglas: solo
importa services/lib/ai/lib/constants/types; sus clientes Supabase se
crean en mcp/src/context.ts, nunca desde lib/supabase/admin.ts) y
.claude/skills/ (las 4, cuándo se activan, que reportan sin editar);
comandos nuevos (dev/build del MCP, el Inspector); el grep nuevo que deba
quedar vigilando; "Estado del proyecto" al día.

[PÚBLICO/TONO] Bitácora: hechos con evidencia, para un alumno que no
estuvo. CLAUDE.md: solo líneas que cambien cómo se escribe código.

[RESTRICCIONES]
- Documenta lo CONSTRUIDO; si difiere de la spec, gana el código y se
  anota como desviación.
- CLAUDE.md crece máximo ~40 líneas netas.
- Todo sale de git y del filesystem; nada de memoria. No modifiques código.
- No describas la sesión 6 más allá de la lista de pendientes.

[EJEMPLOS] Línea esperada en CLAUDE.md:
  * `mcp/` es un consumidor más de services/ y lib/ai/: jamás reimplementa
    lógica de negocio ni importa de app/, components/ o hooks/.

[RAZONAMIENTO] Arma la línea de tiempo desde git, contrástala con los
entregables de la spec, redacta después. Relee CLAUDE.md completo al final
como si fueras a empezar la sesión 6 con él.

[FORMATO DE SALIDA] (1) Sección nueva de docs/BITACORA.md; (2) diff de
CLAUDE.md; (3) tabla entregables × estado × evidencia; (4) pendientes;
(5) commit: "docs: add project log and update CLAUDE.md at close of
Sesión 5".
```

---

## Nota sobre la rúbrica

Dos particularidades gobiernan esta sesión. Primera: en la Fase 5.1 el
"código" son instrucciones para un Claude futuro, así que **Público/tono**
— normalmente el ítem más prescindible — se vuelve central: una Skill con
reglas ambiguas es un manual que nadie puede cumplir, y el prompt exige
reglas verificables con un grep, no principios. Segunda: el servidor MCP
vive fuera de Next.js, donde tres comodidades desaparecen (`.env.local`
automática, `server-only`, el bundler que resuelve alias) — el **Contexto**
de los prompts 5.2–5.3 carga esas trampas YA RESUELTAS (con la prueba
escrita en `scripts/index-all.ts` de este mismo repo) para que el agente no
las redescubra quemando tokens. El **Razonamiento** se usa como en la
sesión 4: no para re-abrir decisiones cerradas, sino para verificar que el
agente las entendió antes de tocar la fontanería (¿por qué stdout es
sagrado?, ¿por qué contexto por llamada?, ¿por qué admin solo en 5 tools?).
Y la Fase 5.6 invierte los roles de toda la sesión: las Skills auditan, el
agente es el auditado — el prompt lo dice explícitamente para que no
"ayude" al auditor.
