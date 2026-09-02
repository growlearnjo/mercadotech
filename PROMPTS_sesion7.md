# MercadoTech — Prompts específicos de la Sesión 7 (Performance y Deploy)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase**. Lo
particular de esta sesión: es la de MÁS pasos humanos del curso (dashboards
de Supabase, Vercel y GitHub que Claude no puede clickear) — así que varios
prompts alternan "Claude prepara/verifica" con "tú haces estos clics", y la
regla de oro atraviesa todo: **los valores de las claves jamás pasan por el
chat**; Claude maneja nombres de variables, tú pegas los valores en la
interfaz de Vercel.

Todos asumen que existe `mercadotech/MercadoTech_sesion7.md` (la spec,
versión validada del 2026-08-31). La spec es la fuente de verdad; el prompt
es el disparador autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento | Modelo sugerido |
|---|---|---|---|---|---|---|---|---|---|
| 7.0 Verificación del terreno | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Lectura de la spec | — | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 7.2 Performance | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 7.3 Variables y secretos | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | — | Sonnet |
| 7.4 Deploy en Vercel | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | Opus |
| 7.5 Documentación final | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | Sonnet |
| Cierre: bitácora + CLAUDE.md | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sonnet |

La columna "Modelo sugerido" sigue el criterio de la sesión 1 (no ejecutada):
Opus donde el error cuesta caro — optimizar sin romper hidratación (7.2) y la
orquestación del deploy sobre la base de datos REAL (7.4); Sonnet para el resto.

---

## Cómo usar estos prompts

1. **Un prompt por turno, en orden, en conversación nueva** (o tras `/clear`).
2. **El Prompt 0 verifica el terreno**: la sesión 6 ya está cerrada (commits
   `e49f6ee`–`c1da6e8`), así que su trabajo es confirmar CI verde y suites en
   su estado esperado (14 E2E: 12 verdes + 2 en `fixme` por el hallazgo del
   kanban, que la Fase 7.2 cierra como Paso 0).
3. **Tareas humanas A/B/C** (spec, sección "Antes de empezar"): proyecto
   Supabase de producción, cuenta de Vercel, branch protection. Cada una se
   hace cuando su fase la pide; la 7.4 las consume todas.
4. **Regla de oro**: si un prompt te hace pegar una clave en el chat, el
   prompt está mal usado — los valores van directo al dashboard de Vercel o
   de Supabase. Claude solo confirma que EXISTEN (por nombre).
5. **Commit por fase**: `perf:` para 7.2, `docs:` para 7.3/7.5, `feat:`/
   `chore:` para 7.4 según el archivo.
6. **Cierre**: tras la 7.5, el Prompt de cierre deja bitácora y `CLAUDE.md`
   al día — la sesión 8 (agente de voz + demo final) arranca de ahí.

### Estado del repositorio al iniciar la sesión (verificado el 2026-08-31, tras el cierre de la S6)

* **Sesión 6 COMPLETA y cerrada** (commits `f335433`…`c1da6e8`): 293 tests
  unitarios (3 s, sin red), `services/` al 89.89 %, CI verde en push y PR
  (`checks` en 43–44 s); bitácora y CLAUDE.md al día. Remoto
  `github.com/growlearnjo/mercadotech`; `packageManager: npm@11.6.2`.
* **HALLAZGO ABIERTO heredado de la S6**: el kanban no es usable por teclado
  (`OrdersKanban.tsx:86` sin `coordinateGetter`); sus 2 E2E están en
  `test.fixme` → la suite E2E reporta 12 verdes de 14. La Fase 7.2 lo cierra
  como Paso 0 (fix de 1 línea) antes de optimizar.
* **El repo quedó PÚBLICO** (la S6 pedía privado): se mantiene así — habilita
  branch protection en el plan free — y vuelve obligatorios los greps
  anti-fuga de la 7.3.
* Ya listos para producción (NO reescribir): `next.config.ts` con
  `remotePatterns` para `*.supabase.co`; `.env.example` completo con las 6
  variables; fuentes con `next/font`.
* Sin `dynamic import` alguno; build con Turbopack (bundle-analyzer no aplica).
* README raíz = plan del curso (se preserva en `docs/PLAN_CURSO.md` en 7.5).
* `docs/ARQUITECTURA.md` sigue en la era de la sesión 2.
* Sesión 1 no ejecutada (sin `docs/COSTOS.md`).

---

## Prompt 0 — Verificación del terreno

```text
[ROL] Actúa como release manager: antes de abrir la iteración de deploy,
confirmas con evidencia que la anterior quedó cerrada y en qué estado
exacto están las suites y el CI.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Lee CLAUDE.md,
docs/BITACORA.md (sección "Sesión 6" completa, incluido su HALLAZGO DE
ACCESIBILIDAD del kanban) y mercadotech/MercadoTech_sesion7.md (secciones
"Estado de partida" y decisiones 1 y 13). Estado esperado: sesión 6
cerrada (commits e49f6ee, 6854185, c1da6e8); 293 tests unitarios; 14 E2E
de los cuales 2 están en test.fixme por el hallazgo del kanban (eso es lo
ESPERADO, no un fallo — lo cierra la Fase 7.2); repo PÚBLICO en
github.com/growlearnjo/mercadotech.

[OBJETIVO] Verifica, deteniéndote en la primera sorpresa:
1. `git status` limpio (salvo la spec/prompts de la S7 aún sin commitear —
   si es el caso, commitéalos primero: "docs: add validated Sesión 7 spec
   and prompts") y `git log --oneline | head -5` mostrando el cierre S6.
2. CI verde en la última corrida (gh no está instalado: dime qué mirar en
   la pestaña Actions y espera mi confirmación).
3. Localmente: `npm run test` verde con Docker APAGADO (293); luego
   `supabase start` + `supabase db reset` + `npm run test:e2e` → 12 verdes
   + 2 skipped/fixme (si los fixme ya no están o hay otro rojo, DETENTE y
   repórtalo); `npm run build` verde.
4. Confirma el hallazgo del kanban tal como lo describe la bitácora:
   grep de coordinateGetter en components/seller/OrdersKanban.tsx debe dar
   vacío — es el insumo del Paso 0 de la 7.2.
5. Confirma que NO hay nada que instalar: esta sesión no agrega
   dependencias (Vercel y Supabase prod se manejan por sus interfaces).

[RESTRICCIONES]
- No arregles el kanban aquí (es el Paso 0 de la 7.2, con su commit y sus
  E2E): solo confirma el estado.
- No corras nada contra ningún Supabase remoto.
- Si el CI está rojo o hay tests rojos inesperados, se diagnostica con
  docs/DEBUGGING.md antes de seguir.

[RAZONAMIENTO] Explica en 2 líneas por qué los 2 fixme NO cuentan como
"suite rota" para arrancar la sesión, pero SÍ bloquearían el cierre de la
7 (los criterios de aceptación exigen 14/14).

[FORMATO DE SALIDA] (1) Tabla verificación × estado × evidencia; (2) el
veredicto: "terreno confirmado, adelante con la 7" o la sorpresa
encontrada; (3) commit solo si hubo que commitear la spec/prompts.
```

## Prompt 1 — Lectura de la spec (sin código)

```text
[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El Prompt 0 confirmó
la sesión 6 cerrada y el CI verde. Vas a ejecutar la sesión 7 en 4 fases
(7.2–7.5; la 7.1 vive en la sesión 6), cada una sin memoria de la anterior,
y con más pasos humanos que ninguna otra sesión.

[OBJETIVO] Lee COMPLETOS, en este orden: CLAUDE.md;
mercadotech/MercadoTech_sesion7.md (incluidas la analogía de la mudanza,
el glosario, las TRES tareas humanas y las 12 decisiones de validación —
son ley); docs/BITACORA.md sección Sesión 6 (números de tests y CI de los
que partes); y los archivos que la spec declara YA listos para no
reescribirlos: next.config.ts y .env.example. Después confírmame que
entiendes el alcance.

[RESTRICCIONES] No generes código. No propongas herramientas fuera de las
decididas (nada de CLI de Vercel, bundle-analyzer ni proyectos de staging).
Si algo del estado real contradice la spec, repórtalo como pregunta.

[RAZONAMIENTO] Explica en 6 líneas, con la analogía del local: (a) por qué
los secretos van a mano en la interfaz de Vercel y NINGUNO a GitHub
Actions (decisión 2 + diseño del CI de la S6); (b) por qué el catálogo de
producción nace vacío y eso NO es un error (decisión 6). Es la prueba de
comprensión de esta sesión.

[FORMATO DE SALIDA] (1) Resumen de 4 líneas, una por fase; (2) las dos
explicaciones; (3) la lista de pasos que serán MÍOS (clics en dashboards)
por fase, para que sepa cuándo me toca; (4) dudas (o "ninguna");
(5) confirmación de no adelantar fases.
```

## Prompt Fase 7.2 — Performance y Core Web Vitals

```text
[ROL] Actúa como ingeniero de performance con una regla inquebrantable:
ningún cambio sin su número de antes, ninguno que quede sin su número de
después, y se revierte lo que no movió la aguja.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de tocar nada,
lee: mercadotech/MercadoTech_sesion7.md (Fase 7.2 completa — incluido su
PASO 0 — y decisiones 1, 3, 4, 5 y 12); docs/BITACORA.md sección "HALLAZGO
DE ACCESIBILIDAD" de la S6 (el diagnóstico exacto del kanban);
components/seller/OrdersKanban.tsx línea ~86 (KeyboardSensor sin
coordinateGetter) y components/seller/SortableImageGallery.tsx (la galería
SÍ lo pasa — es el patrón a copiar); e2e/tests/seller-flow.spec.ts y
seller-negative.spec.ts (los 2 test.fixme que vas a reactivar);
next.config.ts (remotePatterns YA correcto — no lo toques); app/layout.tsx
(fuentes YA con next/font); los tres candidatos reales a dynamic import:
components/chat/ChatWindow, components/seller/OrdersKanban y
SortableImageGallery — hoy NO existe ningún dynamic import en el repo; y
components/catalog/ProductCard + shared/ProductImage (sizes/priority). La
suite de la sesión 6 es tu red: úsala tras cada cambio.

[OBJETIVO] Ejecuta la Fase 7.2 en cuatro actos:
0. PASO 0 (decisión 1): agrega el coordinateGetter de @dnd-kit/sortable al
   KeyboardSensor del kanban (misma forma que la galería), quita los 2
   test.fixme, y corre la suite E2E completa: 14/14 verdes. Commit propio:
   "fix: make the kanban keyboard-accessible and unfixme its e2e" — ANTES
   de cualquier optimización, para que el dynamic import del kanban del
   acto 2 quede protegido por sus tests.
1. ANTES: `npm run build` (registra First Load JS por ruta del resumen) y
   Lighthouse móvil contra `npm run start` sobre home, /producto/[id] y
   /asistente — guíame para correrlo (DevTools → Lighthouse → Mobile) y
   espera mis números. Todo a docs/PERFORMANCE.md.
2. OPTIMIZAR solo lo que los números justifiquen, en commits separados:
   dynamic import de los 3 candidatos (con su estado de carga), sizes
   correcto en las imágenes del grid, priority SOLO en la portada
   above-the-fold de la home. Tras cada cambio: npm run test.
3. DESPUÉS: repetir build + Lighthouse, tabla comparativa, y
   npm run test:e2e completo (un dynamic import mal hecho rompe
   hidratación y los E2E lo cazan).

[RESTRICCIONES]
- Nada de @next/bundle-analyzer (Turbopack — decisión 3) ni webpack config.
- Prohibido tocar next.config.ts, .env.example o lógica de negocio.
- Una optimización sin mejora medible se REVIERTE y queda anotada como
  "intentada, sin efecto" (también es un dato para los alumnos).
- Medición SIEMPRE sobre build de producción (decisión 12): si un número
  viene de next dev, no existe.
- Objetivos: Lighthouse Performance >= 90 en home y catálogo (móvil);
  LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

[EJEMPLOS] Forma esperada del dynamic import con estado de carga:
  const OrdersKanban = dynamic(
    () => import("@/components/seller/OrdersKanban").then(m => m.OrdersKanban),
    { ssr: false, loading: () => <LoadingState label="Cargando tablero…" /> },
  );
Fila esperada de PERFORMANCE.md:
  | /vendedor/pedidos | First Load JS | 312 kB | 218 kB | dynamic import de OrdersKanban (dnd-kit fuera del bundle común) |

[RAZONAMIENTO] Antes de optimizar: con la tabla del ANTES delante, ordena
los candidatos por impacto esperado y di cuál NO vas a tocar y por qué.
Optimizar sin ese ranking es adivinar.

[FORMATO DE SALIDA] (1) El fix del Paso 0 con su diff (1 línea + import) y
la corrida E2E 14/14; (2) docs/PERFORMANCE.md con metodología + tabla
ANTES; (3) commits de optimización (uno por cambio, con su justificación
numérica); (4) tabla DESPUÉS + puntajes Lighthouse finales; (5) suites
unitaria y E2E verdes al cierre; (6) commits: el "fix:" del Paso 0 +
"perf: <cambio> for Fase 7.2" + "docs: add performance report for Fase
7.2".
```

## Prompt Fase 7.3 — Gobernanza de variables y secretos

```text
[ROL] Actúa como ingeniero de seguridad operacional: tu entregable no son
llaves, es el MAPA de las llaves — quién tiene cuál, dónde vive, y la
prueba de que ninguna anda suelta.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion7.md (Fase 7.3 con la tabla de
gobernanza YA diseñada, y decisiones 2, 5, 9 y 10); .env.example (YA
completo — se audita, no se reescribe); .gitignore (verifica .env*.local);
.github/workflows/ci.yml (verifica con tus ojos que NO usa ningún secreto
— es la fila "que no existe a propósito" de la tabla).

[OBJETIVO] Ejecuta la Fase 7.3: crea docs/DEPLOY.md con su primera sección
"Variables y secretos": la tabla de gobernanza de la spec (6 variables ×
dónde vive × quién la lee × pública/secreta, más la fila explícita "GitHub
Actions: ninguna"); las reglas escritas (nunca commitear .env*.local;
rotación si algo se expone; previews comparten la BD de prod con su riesgo
señalado — decisión 9; cambiar una env en Vercel exige redeploy — decisión
10); y los greps anti-fuga ejecutados con su resultado pegado: buscar hf_,
sb_secret y eyJ en el código (excluyendo node_modules, package-lock,
mcp/node_modules y los propios docs), y `git log --all -p -- .env.local`
vacío.

[RESTRICCIONES]
- No cambies .env.example ni ningún código: esta fase produce UNA sección
  de documentación y evidencia.
- Si un grep encuentra algo, DETENTE: se evalúa si es una fuga real
  (rotación inmediata + limpieza) antes de continuar la sesión.
- Los valores de las claves no aparecen en el documento: solo nombres,
  ubicaciones y quién los lee.

[EJEMPLOS] Forma esperada del grep anti-fuga:
  grep -rn "hf_" --include="*.ts" --include="*.tsx" --include="*.mjs" \
    --include="*.sql" --include="*.yml" . | grep -v node_modules
  → (vacío)

[FORMATO DE SALIDA] (1) docs/DEPLOY.md (sección 1 completa); (2) salida
literal de los greps y del git log; (3) confirmación de que el workflow no
referencia secrets.*; (4) commit: "docs: add secrets governance for Fase
7.3".
```

## Prompt Fase 7.4 — Despliegue en Vercel con base de datos remota

```text
[ROL] Actúa como ingeniero de release acompañando un go-live: tú preparas,
verificas y documentas; los clics en dashboards son del operador humano (yo)
y me los das de a uno, esperando mi confirmación en cada paso de riesgo.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de empezar,
lee: mercadotech/MercadoTech_sesion7.md (Fase 7.4 COMPLETA: la tabla de 10
pasos con quién hace cada uno, y decisiones 2, 6, 7, 8, 9 y 10); la tabla
de variables de docs/DEPLOY.md (7.3); supabase/seed.sql secciones 2 y 9
(las categorías y la FAQ que SÍ pueden reutilizarse en el seed de prod);
scripts/index-all.ts (se ejecutará una vez contra prod con env inline —
decisión 7); supabase/config.toml (project_id local). YO ya hice la tarea
humana A (proyecto mercadotech-prod creado, contraseña guardada) y B
(cuenta de Vercel con GitHub). Regla de oro: jamás me pidas pegar una
clave en el chat.

[OBJETIVO] Ejecuta los 10 pasos de la tabla de la spec en orden,
alternando tu trabajo y mis clics:
- Tuyos: (1) supabase/seed.prod.sql (8 categorías + 10 FAQ, sin usuarios
  ni productos, cabecera explicativa); (4) indexar la FAQ de prod
  corriendo index-all con las env inline que YO ejecutaré (dame el comando
  con placeholders <URL> y <SERVICE_KEY> para que yo los complete en MI
  terminal); (9) preparar la rama deploy-smoke con un cambio visible
  trivial y el PR; verificación de cada paso.
- Míos, guiados por ti de a uno: (2) supabase login/link/db push (me das
  los comandos; la contraseña la escribo yo); (3) pegar seed.prod.sql en
  el SQL Editor; (5) desactivar Confirm email; (6) importar el repo en
  Vercel y cargar las variables A MANO (me dictas la lista de NOMBRES y
  entornos desde la tabla de 7.3, uno por uno); (8) branch protection con
  los clics exactos; (10) el smoke test con tu checklist.

[PÚBLICO/TONO] Cada instrucción para mí: numerada, un clic o comando por
línea, con "deberías ver …" al final para que sepa que voy bien. Si algo
no coincide, me detengo y te lo digo — tenlo previsto.

[RESTRICCIONES]
- Nada de CLI de Vercel, tokens de deploy ni cambios al workflow
  (decisión 2).
- El seed de laboratorio JAMÁS se acerca a prod; seed.prod.sql no incluye
  usuarios (decisión 6).
- Ningún test apunta a prod. El opcional de correr E2E contra un preview
  con PLAYWRIGHT_BASE_URL queda solo ANOTADO en DEPLOY.md.
- Los comandos con credenciales de prod (paso 4) los ejecuto YO; tú los
  entregas con placeholders y NUNCA los guardas en archivos.
- Si el primer deploy falla, se diagnostica con la tabla de síntomas de la
  spec antes de tocar nada.

[RAZONAMIENTO] Antes del paso 1: recorre la tabla de 10 pasos y marca los
3 de mayor riesgo con su plan-B (db push falla a medias; deploy inicial
rojo; smoke test revela algo roto). Ejecutar sin plan-B es rezar.

[FORMATO DE SALIDA] (1) supabase/seed.prod.sql; (2) transcripción del
go-live paso a paso con mis confirmaciones; (3) evidencia del flujo
completo: PR deploy-smoke con checks + preview URL, merge bloqueado→verde,
producción con el cambio; (4) checklist del smoke test con ✅ y la sección
"Flujo de despliegue" agregada a docs/DEPLOY.md; (5) commits: "feat: add
production seed for Fase 7.4" + "docs: add deploy flow and smoke test for
Fase 7.4".
```

## Prompt Fase 7.5 — Documentación final

```text
[ROL] Actúa como technical writer con criterio de arquitecto: documentas
lo CONSTRUIDO con sus porqués, y tu lector no estuvo en ninguna sesión.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion7.md (Fase 7.5 y decisión 11);
README.md actual (es el plan del CURSO — se preserva, no se pisa);
docs/ARQUITECTURA.md (quedó en la era S2: solo BD y RLS);
docs/{BITACORA,RAG,DEBUGGING}.md y mcp/README.md (se ENLAZAN, no se
duplican); docs/DEPLOY.md (7.3-7.4, le falta rollback); la URL de
producción del smoke test; y la estructura real con ls.

[OBJETIVO] Ejecuta la Fase 7.5: (1) mueve el README actual a
docs/PLAN_CURSO.md intacto, con una nota de contexto al inicio ("plan
maestro del curso; el README del producto vive en la raíz"); (2) escribe
el README.md de producto según la lista de la spec (qué es, stack, capas,
flujo RAG, puesta en marcha local PASO A PASO desde cero, comandos,
testing con su prerrequisito de db reset, deploy resumido + link, URL de
producción, estructura comentada); (3) actualiza docs/ARQUITECTURA.md con
la realidad S3–S7 (frontend, RAG, Skills+MCP, testing+CI, deploy) — donde
el código difiera de alguna spec, gana el código con nota; (4) completa
docs/DEPLOY.md con la sección de ROLLBACK (Deployments → redeploy del
anterior; qué NO revierte: la base de datos — las migraciones no se
deshacen desde Vercel).

[PÚBLICO/TONO] README: un desarrollador nuevo, cero contexto del curso,
cada comando copiable y en orden ejecutable. ARQUITECTURA: el porqué de
cada decisión en 2-4 líneas, no ensayos. Español, como todo el repo.

[RESTRICCIONES]
- CLAUDE.md NO se toca (lo hace el Prompt de cierre).
- No dupliques contenido que ya vive en RAG.md/DEBUGGING.md/mcp/README.md:
  enlaza.
- Nada de promesas de la sesión 8 salvo una línea final "Qué sigue".
- El plan del curso se mueve INTACTO: ni un párrafo editado.

[EJEMPLOS] Bloque esperado de puesta en marcha del README:
  ```bash
  supabase start        # requiere Docker Desktop corriendo
  supabase db reset     # migraciones + seed (6 usuarios de prueba)
  cp .env.example .env.local   # completar con `supabase status -o env`
  npm ci && npm run dev
  ```

[FORMATO DE SALIDA] (1) docs/PLAN_CURSO.md (movido) + README.md nuevo;
(2) diff-resumen de ARQUITECTURA.md (qué secciones se agregaron);
(3) docs/DEPLOY.md con rollback; (4) la prueba del desarrollador nuevo:
lista de comandos del README ejecutados en orden y su resultado;
(5) commit: "docs: add product README, update architecture and finish
deploy guide for Fase 7.5".
```

## Prompt de cierre — Bitácora de la sesión y actualización de CLAUDE.md

```text
[ROL] Actúa como tech lead que cierra una iteración: documentas lo
construido, lo decidido y lo pendiente, para que la sesión 8 (el agente de
voz y la demo final) arranque sin arqueología.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 7.2–7.5
están ejecutadas y la app vive en producción. Obtén el estado REAL:
`git log --oneline` (identifica el cierre de la sesión 6 y el rango de la
7), `git diff --stat <cierre-s6>..HEAD`, docs/{PERFORMANCE,DEPLOY}.md, el
README nuevo, la URL de producción, y lee docs/BITACORA.md, CLAUDE.md y
mercadotech/MercadoTech_sesion7.md (decisiones, entregables, criterios).

[OBJETIVO] (1) Agregar a docs/BITACORA.md la sección "Sesión 7" (arriba de
la 6): por fase, commits, qué se construyó, decisiones ejercidas con su
porqué (deploy 100 % por interfaz de Vercel y secretos a mano — directiva
del docente; seed de prod sin usuarios; previews sobre la BD de prod;
confirm email desactivado), los NÚMEROS de performance (tabla
antes/después resumida y puntajes Lighthouse finales), el resultado del
go-live (URL, smoke test, qué falló y cómo se resolvió), y qué quedó fuera
(staging separado, E2E contra previews en CI, analyzer). Cerrar con
criterios de aceptación ✅/❌ con evidencia y pendientes para la sesión 8
(la 8 reutiliza get_order_status del MCP y amplía /soporte con voz — solo
lístalo). (2) Actualizar CLAUDE.md quirúrgicamente: la URL de producción y
el flujo de deploy (PR → preview → merge con checks → producción), dónde
viven los secretos (Vercel a mano, ninguno en Actions), la regla
medir→cambiar→medir con PERFORMANCE.md como registro, el README nuevo como
puerta de entrada, y "Estado del proyecto" al día (siguiente: sesión 8).
Verifica de paso que CLAUDE.md no afirme nada ya falso (lección ReadHub).

[PÚBLICO/TONO] Bitácora: hechos con evidencia, para un alumno que no
estuvo. CLAUDE.md: solo líneas que cambien decisiones de trabajo futuras.

[RESTRICCIONES]
- Documenta lo CONSTRUIDO; si difiere de la spec, gana lo construido y se
  anota como desviación.
- CLAUDE.md crece máximo ~30 líneas netas.
- Todo sale de git, del filesystem, de los docs y de los dashboards que YO
  te confirme; nada de memoria. No modifiques código.
- Ninguna clave ni valor sensible en la bitácora (URLs públicas sí).

[EJEMPLOS] Línea esperada en CLAUDE.md:
  * Deploy: PR → preview de Vercel; merge a main (checks obligatorios) →
    producción. Secretos SOLO en el dashboard de Vercel; Actions no usa
    ninguno. Tras cambiar una env: redeploy.

[RAZONAMIENTO] Arma la línea de tiempo desde git, contrástala con los
entregables de la spec, redacta después. Relee CLAUDE.md completo al final
como si fueras a empezar la sesión 8 con él.

[FORMATO DE SALIDA] (1) Sección nueva de docs/BITACORA.md; (2) diff de
CLAUDE.md; (3) tabla entregables × estado × evidencia; (4) pendientes para
la sesión 8; (5) commit: "docs: add project log and update CLAUDE.md at
close of Sesión 7".
```

---

## Nota sobre la rúbrica

Esta sesión invierte la proporción máquina/humano del curso: en la 7.4 hay
más clics tuyos que archivos de Claude, así que **Público/tono** gobierna el
prompt más crítico — instrucciones de a un paso, con "deberías ver…" como
verificación, y la regla de oro (las claves nunca pasan por el chat)
repetida donde duele. Las **Restricciones** cargan las dos directivas del
docente como ley: todo por la interfaz de Vercel (nada de CLI ni tokens en
Actions) y secretos a mano en su dashboard. El **Razonamiento** vuelve a ser
verificador de comprensión (¿por qué Actions no tiene secretos?, ¿por qué el
catálogo de prod nace vacío?) y, en 7.2 y 7.4, planificador de riesgo: el
ranking de optimizaciones antes de tocar código y los plan-B antes del
go-live. Y el patrón medir→cambiar→medir convierte el **Formato de salida**
de 7.2 en el entregable mismo: sin tabla de antes y después, la fase no
existe.
