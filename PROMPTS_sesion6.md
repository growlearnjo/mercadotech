# MercadoTech — Prompts específicos de la Sesión 6 (Testing y CI)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase**. Lo
particular de esta sesión: los tests deben anclarse al **comportamiento real
del código**, no al que la spec original imaginaba — por eso casi todos los
prompts ordenan leer el archivo bajo prueba ANTES de escribir su test, y
prohíben "corregir" código para que un test pase. Y el CI se construye sobre
lecciones ya pagadas por ReadHub (pin de npm, stack efímero), cargadas en el
Contexto para no re-pagarlas.

Todos asumen que existe `mercadotech/MercadoTech_sesion6.md` (la spec, versión
validada del 2026-08-28). La spec es la fuente de verdad; el prompt es el
disparador autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento | Modelo sugerido |
|---|---|---|---|---|---|---|---|---|---|
| 6.0 GitHub + herramientas | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Lectura de la spec | — | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 6.1 Infra Vitest | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | — | Sonnet |
| 6.2 Lógica pura | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | — | Sonnet |
| 6.3 Services mockeados | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 6.4 Infra Playwright | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | — | Sonnet |
| 6.5 E2E comprador | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 6.6 E2E vendedor | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 6.7 CI GitHub Actions | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 6.8 Debugging y gates | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | Sonnet |
| Cierre: bitácora + CLAUDE.md | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sonnet |

La columna "Modelo sugerido" sigue el criterio de la sesión 1 (no ejecutada):
Opus donde el error cuesta caro — el mock encadenable y las anclas al
comportamiento real (6.3), el drag por teclado (6.6), y el workflow que
gobernará todos los merges futuros (6.7); Sonnet para el resto.

---

## Cómo usar estos prompts

1. **Un prompt por turno, en orden, en conversación nueva** (o tras `/clear`).
2. **La tarea humana va primero**: crear el repositorio en GitHub siguiendo la
   sección "Antes de empezar" de la spec. El Prompt 0 conecta el remoto y hace
   el primer push (Windows abrirá el navegador para autorizar la primera vez).
3. **Prerrequisito de datos para E2E** (Fases 6.4–6.6): stack local corriendo
   y `supabase db reset` antes de cada corrida completa de la suite.
4. **Los tests documentan el código real.** Si al escribir un test el
   comportamiento parece un bug, el prompt exige reportarlo, no arreglarlo —
   la corrección es una decisión aparte.
5. **Commit por fase**: `test:` para suites, `feat:`/`chore:` para
   infraestructura, `ci:` para el workflow, `docs:` para documentación.
6. **Cierre**: tras la 6.8, el Prompt de cierre actualiza `docs/BITACORA.md` y
   `CLAUDE.md` — la sesión 7 (performance + deploy) arranca leyendo esos dos.

### Estado del repositorio al iniciar la sesión (verificado el 2026-08-28)

* Sesiones 2–5 ejecutadas y cerradas (último commit `eed65ff`); 4 Skills de
  gobernanza activas; servidor MCP en `mcp/` con type-check propio.
* Sesión 1 NO ejecutada (sin `docs/COSTOS.md`).
* SIN remoto de GitHub, sin `.github/`, sin `packageManager` en package.json.
* SIN vitest, SIN playwright, cero archivos `*.test.ts`, cero `data-testid`.
* `lib/utils.ts` exporta solo `cn` y `formatPrice`; la regla del kanban vive
  como helper NO exportado en `hooks/useSellerOrders.ts`; `cart.service.addItem`
  suma y recorta a `[1, stock]` — los tests se anclan a ESTO.
* npm local 11.6.2 (generó el lockfile en Windows) — el pin de CI usa esa versión.
* Usuarios E2E del seed: `buyer1@` / `seller1@mercadotech.test`, contraseña
  `MercadoTech123!`; producto sin stock: `b0000000-…06`.

---

## Prompt 0 — GitHub remoto y herramientas de testing

```text
[ROL] Actúa como ingeniero DevOps que prepara un repo local para trabajar
contra GitHub y deja las herramientas de prueba instaladas y verificadas.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Lee CLAUDE.md,
docs/BITACORA.md (cierre de la sesión 5) y las secciones "Antes de empezar"
y "Estado de partida" de mercadotech/MercadoTech_sesion6.md. YO (el humano)
ya creé el repositorio vacío y privado en GitHub siguiendo la spec y te
daré la URL HTTPS. El repo local está limpio en main con la sesión 5
cerrada (commit eed65ff). No hay remoto, ni vitest, ni playwright.

[OBJETIVO] En este orden:
1. Verifica el terreno: `git status` limpio; `git log --oneline | head -3`
   muestra el cierre de la S5; `npm run build` pasa; `supabase status`
   verde (si no, `supabase start`).
2. Conecta el remoto: `git remote add origin <URL>` y `git push -u origin
   main`. Si Windows pide autorizar en el navegador, avísame y espera.
   Verifica con `git remote -v` y confirmando en la web que los commits
   llegaron.
3. Instala en la raíz: `npm i -D vitest @vitest/coverage-v8
   @playwright/test` y luego `npx playwright install` (los 3 navegadores
   para local; chromium con --with-deps queda para el runner de CI, no
   aquí).
4. NO configures nada todavía (vitest.config, playwright.config y scripts
   son de las Fases 6.1 y 6.4).
5. `npm run lint` y `npm run type-check` siguen pasando.

[RESTRICCIONES]
- No crees .github/, ni configs de test, ni tests: solo remoto + paquetes.
- No instales Testing Library ni jsdom (decisión 6 de la spec: esta sesión
  no testea componentes).
- No toques mcp/ ni sus dependencias.
- Si el push falla por autenticación, dame el paso exacto a hacer en el
  navegador; no intentes flujos alternativos con tokens.

[RAZONAMIENTO] Antes de instalar, confirma en 2 líneas por qué los
navegadores de Playwright se instalan completos en local pero el CI usará
solo chromium (está en la spec, Fase 6.7).

[FORMATO DE SALIDA] (1) Tabla prerrequisito × estado × evidencia;
(2) salida de `git remote -v` y confirmación del push; (3) paquetes
instalados con versión; (4) commit: "chore: connect GitHub remote and
install test tooling for Sesión 6".
```

## Prompt 1 — Lectura de la spec (sin código)

```text
[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El Prompt 0 conectó
el remoto de GitHub e instaló Vitest y Playwright. Vas a ejecutar la sesión
6 en 8 fases, una por prompt, cada una sin memoria de la anterior.

[OBJETIVO] Lee COMPLETOS, en este orden: CLAUDE.md;
mercadotech/MercadoTech_sesion6.md (incluidas la analogía
red/acróbata/portero, el glosario y las 13 decisiones de validación — son
ley); docs/BITACORA.md (qué comportamiento quedó documentado en S3/S4:
addItem recorta, la secuencia del kanban vive en el hook); y los archivos
que más tests recibirán: lib/validators/auth.ts, lib/validators/product.ts,
lib/ai/context-builder.ts, services/cart.service.ts,
hooks/useSellerOrders.ts. Después confírmame que entiendes el alcance.

[RESTRICCIONES] No generes código ni configs. No propongas testear cosas
que no existen (componentes, fechas, el MCP). Si un comportamiento real te
parece un bug, anótalo como pregunta — no como plan de corrección.

[RAZONAMIENTO] Explica en 5 líneas, con la analogía de la spec, por qué el
mock del cliente Supabase se INYECTA mientras que lib/ai/* se mockea por
módulo (decisión 7) — y qué diseño de la sesión 2 hace posible lo primero.

[FORMATO DE SALIDA] (1) Resumen de 8 líneas, una por fase; (2) la
explicación del mockeo de dos niveles; (3) los 3 comportamientos reales a
los que los tests deben anclarse (addItem, kanban, checkout) citando
archivo y línea aproximada; (4) dudas (o "ninguna"); (5) confirmación de
no adelantar fases.
```

## Prompt Fase 6.1 — Infraestructura de Vitest

```text
[ROL] Actúa como ingeniero de herramientas: configuras el taller para que
escribir un test cueste 30 segundos, no 30 minutos.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion6.md (Fase 6.1 y decisión 6);
tsconfig.json de la raíz (alias @/* → ./* que Vitest debe replicar);
package.json (scripts actuales). vitest y @vitest/coverage-v8 ya están
instalados (Prompt 0). No existe ningún test todavía.

[OBJETIVO] Ejecuta la Fase 6.1: vitest.config.ts con environment node,
alias @ → raíz, include **/*.test.ts, exclude node_modules/mcp/e2e/.next,
y coverage v8 (reporters text + html) limitado a lib/ y services/;
scripts test / test:watch / test:coverage en package.json.

[RESTRICCIONES]
- Environment node, sin jsdom ni Testing Library (decisión 6).
- No escribas ningún test (Fase 6.2). No toques mcp/ ni e2e/.
- El alias debe funcionar exactamente como en la app: se probará en 6.2
  importando @/services/....

[FORMATO DE SALIDA] (1) vitest.config.ts comentado; (2) evidencia:
`npm run test -- --passWithNoTests` verde y `npm run test:coverage --
--passWithNoTests` generando coverage/; (3) lint y type-check;
(4) commit: "chore: add Vitest infrastructure for Fase 6.1".
```

## Prompt Fase 6.2 — Tests de lógica pura

```text
[ROL] Actúa como QA de caja blanca: tu unidad de trabajo es la RAMA, no el
archivo — cada if, cada límite, cada valor frontera tiene su caso.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir
CADA test, lee el archivo bajo prueba COMPLETO: lib/validators/auth.ts
(REGISTRABLE_ROLES, PASSWORD_MIN_LENGTH, límites de display_name),
lib/validators/product.ts (límites desde lib/constants/product.ts),
lib/utils.ts (SOLO cn y formatPrice existen — decisión 3),
lib/ai/context-builder.ts y lib/ai/prompts.ts (los 5 tunables
CONTEXT_BUILDER_* salen de lib/constants/ai.ts). La infraestructura de la
6.1 ya funciona.

[OBJETIVO] Ejecuta la Fase 6.2: los 5 archivos de test de la tabla de la
spec, junto a su archivo fuente. Meta dura: 100 % de ramas en
lib/validators/ y en context-builder.

[RESTRICCIONES]
- Cero mocks: si necesitas mockear, el archivo no es puro — repórtalo.
- Los valores frontera SALEN de las constantes reales (importadas en el
  test), nunca números copiados a mano.
- formatPrice: prueba entrada number Y string ("219.00" viene así de
  PostgREST). Nada de tests de fechas (no existen).
- No modifiques ningún archivo fuente.

[EJEMPLOS] Caso frontera esperado (validators):
  it("rechaza password de 7 y acepta de 8", () => {
    expect(validateRegister({...ok, password: "a".repeat(PASSWORD_MIN_LENGTH - 1)}).ok).toBe(false);
    expect(validateRegister({...ok, password: "a".repeat(PASSWORD_MIN_LENGTH)}).ok).toBe(true);
  });
Caso del presupuesto del builder (de la spec de la sesión 4): si el resto
del presupuesto para la última fuente es menor que
CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS, esa fuente se descarta ENTERA.

[FORMATO DE SALIDA] (1) Lista de archivos de test con su conteo de casos;
(2) `npm run test` verde; (3) tabla de cobertura del reporte mostrando
100 % branches en validators y context-builder; (4) commit: "test: add
pure logic suites (validators, utils, AI context) for Fase 6.2".
```

## Prompt Fase 6.3 — Tests de services con Supabase mockeado

```text
[ROL] Actúa como QA senior de servicios: pruebas contratos reales con
dobles inyectados, y desconfías de todo test que necesite la red.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir
CADA test, lee el service COMPLETO — los tests se anclan al comportamiento
REAL, y la spec ya validó tres anclas (decisiones 4, 5 y 7 de
MercadoTech_sesion6.md, léelas): (a) cart.service.addItem SUMA el
duplicado y recorta a [1, stock] — no "rechaza"; (b) la secuencia del
kanban vive como helper a nivel de módulo en hooks/useSellerOrders.ts
(NO en seller.service) — exporta ese helper tal cual está (solo agregas
`export`, refactor mecánico permitido) y testéalo sin React; (c) Supabase
se INYECTA siempre; lib/ai/* se mockea con vi.mock de módulo (única
excepción, coméntala donde la uses). Lee también services/chat.service.ts
(el orden búsqueda → contexto → completion y el caso
hasRelevantContext=false donde la completion IGUAL se llama).

[OBJETIVO] Ejecuta la Fase 6.3: services/test-utils/supabase-mock.ts
(fábrica encadenable programable) y los archivos de test de la tabla de la
spec (cart, order, product, seller, el helper del kanban, review,
question, favorite, auth, embedding, vector-search, chat). Meta:
services/ >= 80 % líneas.

[RESTRICCIONES]
- PROHIBIDO vi.mock de lib/supabase/* o del módulo del service: el cliente
  entra por el último parámetro.
- PROHIBIDO cambiar lógica de producción. Únicos cambios permitidos:
  `export` al helper del kanban. Si un test revela un posible bug, se
  ancla al comportamiento actual con comentario
  "// comportamiento actual, revisar:" y me lo listas al final.
- La suite completa debe pasar con Docker APAGADO (lo verificarás).
- Los mensajes de error se afirman por CONTENIDO real (ej. el del RPC
  "Stock insuficiente para…"), no por "toThrow()" a secas.

[EJEMPLOS] Ancla real esperada (cart):
  it("duplicado: suma y recorta al stock", async () => {
    const supabase = mockSupabase({
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
      products: { single: { stock: 4 } },
    });
    await addItem("u1", "p1", 5, supabase);
    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 4 }); // 3+5 → tope 4
  });

[RAZONAMIENTO] Antes de escribir: para cart, order y chat enumera los
casos (feliz + errores + fronteras) derivados de LEER el código, y marca
cuáles difieren de lo que "se esperaría" — esos son los valiosos. Luego
implementa.

[FORMATO DE SALIDA] (1) Archivos creados; (2) `npm run test` verde CON
DOCKER APAGADO (di cómo lo verificaste); (3) tabla de cobertura de
services/ (>= 80 %); (4) lista de "comportamiento actual, revisar" (o
vacía); (5) lint y type-check; (6) commit: "test: add service suites with
injected Supabase mock for Fase 6.3".
```

## Prompt Fase 6.4 — Infraestructura de Playwright

```text
[ROL] Actúa como ingeniero de E2E: montas el circo una vez y bien, para
que cada spec siguiente sean 20 líneas legibles sobre Page Objects.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion6.md (Fase 6.4 y decisiones 8, 11, 12);
supabase/seed.sql sección 1 (usuarios buyer1/seller1, contraseña
MercadoTech123!); las pantallas que tendrán Page Object (app/(auth)/login,
la home, app/(shop)/producto/[id], carrito, pedidos,
app/(seller)/vendedor/{productos,pedidos}) — ábrelas para decidir DÓNDE
van los data-testid (hoy hay CERO en todo el repo, verificado).
@playwright/test y los navegadores ya están instalados (Prompt 0). El
patrón del config (webServer build&&start en CI / reutilizar dev en local,
reporter github en CI, retries 2/0, chromium-only en CI) está en la spec y
proviene del CI real de ReadHub.

[OBJETIVO] Ejecuta la Fase 6.4: playwright.config.ts con el patrón de la
spec; e2e/data/users.ts y e2e/data/product-image.jpg (genera una imagen
pequeña válida); e2e/fixtures/test.ts (fixture con login vía Page Object);
los 7 Page Objects de la tabla; los data-testid en los componentes que los
Page Objects necesiten (kebab-case con prefijo de dominio); scripts
test:e2e y test:e2e:ui; y un smoke spec e2e/tests/home.spec.ts (la home
carga y muestra el grid de productos).

[RESTRICCIONES]
- En componentes SOLO se agregan atributos data-testid: ni lógica, ni
  estilos, ni estructura (si un elemento no existe para anclar el testid,
  repórtalo — no lo inventes).
- Selectores en Page Objects: data-testid o rol accesible; prohibido CSS
  de clases o textos largos.
- Ningún spec de flujo todavía (6.5–6.6); solo el smoke.
- e2e/playwright-report y e2e/test-results van al .gitignore.

[EJEMPLOS] Forma esperada de un Page Object:
  export class LoginPage {
    constructor(private page: Page) {}
    async login(user: TestUser) {
      await this.page.goto("/login");
      await this.page.getByTestId("login-email").fill(user.email);
      await this.page.getByTestId("login-password").fill(user.password);
      await this.page.getByTestId("login-submit").click();
      await this.page.getByTestId("user-menu").waitFor();
    }
  }

[FORMATO DE SALIDA] (1) Árbol de e2e/ y lista de componentes tocados (solo
atributos); (2) con supabase status verde: `npm run test:e2e --
home.spec.ts` pasando en los 3 navegadores; (3) `npx playwright test
--list`; (4) `npm run build` sigue verde; (5) commit: "feat: add
Playwright infrastructure with page objects and test ids for Fase 6.4".
```

## Prompt Fase 6.5 — E2E: flujo comprador

```text
[ROL] Actúa como el comprador más metódico del mundo: sigues el guion paso
a paso y verificas cada consecuencia observable antes de seguir.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion6.md (Fase 6.5 completa y decisión 8 —
cero aserciones de IA); e2e/pages/ y e2e/fixtures/ (6.4 — reutilízalos;
si a un Page Object le falta una acción, se la agregas ahí, no en el
spec); supabase/seed.sql (b…06 es el producto activo con stock 0; buyer1
compra). Prerrequisito que YO ejecuto antes de cada corrida completa:
supabase db reset — tenlo en cuenta: tus aserciones son sobre el pedido
RECIÉN creado (id tomado de la URL de redirección), jamás "el primero de
la lista".

[OBJETIVO] Ejecuta la Fase 6.5: e2e/tests/buyer-flow.spec.ts con los 8
pasos de la spec como test.step (login → filtrar Laptops → abrir producto
con stock → agregar 2 → carrito y subtotal → checkout → detalle pendiente
con snapshots → mis pedidos → logout) y e2e/tests/buyer-negative.spec.ts
(stock 0 → botón deshabilitado con motivo; carrito vacío → sin checkout
posible; anónimo en /carrito → redirect a /login?redirectTo=/carrito).

[RESTRICCIONES]
- Ninguna visita a /asistente ni a la pestaña IA; ninguna aserción sobre
  texto generado por el modelo (decisión 8).
- Aserciones de dinero con el formato real de formatPrice (S/ y decimales)
  — no re-formatees a mano.
- Sin sleeps fijos: espera por estado observable (testid visible, URL,
  contador).
- No toques lógica de producción; si un paso es imposible sin un testid
  nuevo, agrégalo como en 6.4 (solo atributo) y decláralo.

[RAZONAMIENTO] Antes de codificar, escribe la tabla paso → consecuencia
observable → testid/URL que la prueba. Si un paso no tiene consecuencia
observable, no es un paso: repiénsalo.

[FORMATO DE SALIDA] (1) Los 2 specs; (2) tras `supabase db reset`:
`npm run test:e2e -- buyer` verde en chromium (pega el resumen);
(3) demostración del reporte: rompe una aserción, muestra el screenshot
del paso fallido en el reporte HTML, revierte; (4) commit: "test: add
buyer E2E flow and negatives for Fase 6.5".
```

## Prompt Fase 6.6 — E2E: flujo vendedor

```text
[ROL] Actúa como QA de accesibilidad e interacciones: el drag & drop se
prueba por el camino del teclado, porque si ese camino muere, murió la
accesibilidad aunque el mouse funcione.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion6.md (Fase 6.6 y decisión 9);
components/seller/OrdersKanban.tsx y OrderKanbanCard.tsx (dónde está el
asa, qué aria/testids tiene — KeyboardSensor está activo desde la sesión
3, la bitácora S3 lo confirma); hooks/useSellerOrders.ts (los toasts de
transición inválida que el negativo afirma); e2e/pages/SellerKanbanPage.ts
y SellerProductsPage.ts (6.4); supabase/seed.sql sección 5 (c…03 está
'pagado' y es de seller2 — OJO: verifica QUÉ pedido pagado pertenece a
seller1 o usa el vendedor que corresponda; el multi-vendedor c…04 está
'enviado').

[OBJETIVO] Ejecuta la Fase 6.6: e2e/tests/seller-flow.spec.ts (login
seller correspondiente → publicar producto con título único por timestamp
e imagen de e2e/data/ → visible en su tabla y en el catálogo público →
mover el pedido 'pagado' a 'enviado' POR TECLADO: focus en el asa → Space
→ ArrowRight → Space → la tarjeta queda en 'enviado' y PERSISTE tras
page.reload() → login como su comprador → el detalle muestra 'enviado') y
e2e/tests/seller-negative.spec.ts (buyer1 en /vendedor/productos →
rechazado; intento de retroceder 'enviado' → 'pagado' → toast de rechazo
y la tarjeta no se mueve).

[RESTRICCIONES]
- El movimiento del kanban va por teclado (decisión 9). Si el camino de
  teclado NO funciona, es un HALLAZGO de accesibilidad: repórtalo y
  detente — prohibido "resolverlo" con mouse.down/move/up.
- El pedido a mover se identifica por su id del seed, no por posición.
- Solo atributos data-testid como cambio de producción, si faltan.

[EJEMPLOS] Secuencia de teclado esperada (patrón KeyboardSensor):
  await handle.focus();
  await page.keyboard.press("Space");      // levanta la tarjeta
  await page.keyboard.press("ArrowRight"); // columna siguiente
  await page.keyboard.press("Space");      // suelta

[RAZONAMIENTO] Antes de codificar: (a) confirma leyendo el seed QUÉ pedido
'pagado' pertenece a qué vendedor y qué comprador lo hizo — el spec de la
sesión anterior se equivocó una vez por asumir en vez de leer; (b) explica
en 2 líneas por qué la persistencia se afirma tras reload y no solo por el
DOM.

[FORMATO DE SALIDA] (1) Los 2 specs (+ acciones nuevas en Page Objects);
(2) tras supabase db reset: `npm run test:e2e` COMPLETO verde (comprador +
vendedor, chromium); (3) el fragmento del reporte donde la tarjeta quedó
en 'enviado'; (4) commit: "test: add seller E2E flow with keyboard kanban
drag for Fase 6.6".
```

## Prompt Fase 6.7 — Pipeline de CI en GitHub Actions

```text
[ROL] Actúa como ingeniero de CI que ya se quemó con lockfiles
multiplataforma: pineas versiones, cacheas por hash y no le pides al
runner nada que no esté escrito.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion6.md (Fase 6.7 COMPLETA — el diseño de
los dos jobs viene del CI real de ReadHub y sus lecciones ya están
incorporadas — y decisiones 10, 11, 12); package.json raíz (sin
packageManager aún; npm local 11.6.2 generó el lockfile en Windows) y el
de mcp/ (su type-check entra al job checks); playwright.config.ts (el
webServer de CI hace build && start — el workflow NO levanta la app, solo
pasa las env). El remoto ya existe y main está pusheado (Prompt 0). La
suite local está verde (6.3 y 6.6).

[OBJETIVO] Ejecuta la Fase 6.7: (1) agrega "packageManager":
"npm@11.6.2" a package.json; (2) crea .github/workflows/ci.yml con el
job checks (Node 24 + caché npm; npm install -g npm@11.6.2; npm ci;
type-check; lint; test:coverage; type-check de mcp/ con su npm ci;
artefacto de cobertura 7 días if: always) y el job e2e (needs: checks;
mismos setup y pin; caché de ~/.cache/ms-playwright por lockfile; npx
playwright install --with-deps chromium; supabase/setup-cli@v1; supabase
start; supabase db reset; credenciales dinámicas con supabase status -o
json + jq hacia las env del paso de tests; npx playwright test
--project=chromium; reporte+screenshots como artefacto SOLO if: failure,
14 días; supabase stop if: always). Extras: triggers pull_request + push
a main + workflow_dispatch; concurrency cancel-in-progress; permissions
contents: read; timeouts 15/20 min. (3) Push y verificación real en la
pestaña Actions; (4) PR de prueba desde una rama ci-smoke con un cambio
trivial, y en esa MISMA rama un commit que rompe un test unitario a
propósito → el PR queda en rojo → revert → verde → cerrar el PR sin
merge.

[RESTRICCIONES]
- CERO secretos en el workflow: nada de HUGGINGFACEHUB_API_TOKEN (los E2E
  no afirman IA — decisión 8) ni claves fijas de Supabase (las del stack
  efímero se leen dinámicamente y no protegen nada).
- El pin de npm y packageManager deben COINCIDIR (11.6.2) — cita en un
  comentario del yml la lección del lockfile (está en la spec).
- No configures branch protection ni deploy (sesión 7).
- No edites tests para "ayudar" al CI: si algo solo falla en Actions, se
  diagnostica (dev vs build de producción) antes de tocar nada.

[EJEMPLOS] Paso de credenciales dinámicas esperado:
  - name: Leer credenciales del Supabase local
    id: supabase
    run: |
      STATUS=$(supabase status -o json)
      echo "api_url=$(echo "$STATUS" | jq -r '.API_URL')" >> "$GITHUB_OUTPUT"
      echo "anon_key=$(echo "$STATUS" | jq -r '.ANON_KEY')" >> "$GITHUB_OUTPUT"

[RAZONAMIENTO] Antes de escribir el yml, responde en 4 líneas: (a) ¿por
qué el pin de npm evita "Missing from lock file"? (b) ¿por qué las claves
del stack efímero NO son secretos? Si no puedes, relee la spec.

[FORMATO DE SALIDA] (1) Diff de package.json + el ci.yml completo
comentado; (2) enlaces/evidencia de la pestaña Actions: corrida de push en
verde (ambos jobs, con duración), PR en rojo con el test roto y en verde
tras el revert; (3) el artefacto de cobertura descargable; (4) commits:
"ci: add GitHub Actions pipeline (checks + e2e) for Fase 6.7" y el ciclo
break/revert en la rama ci-smoke.
```

## Prompt Fase 6.8 — Debugging y actualización de los gates

```text
[ROL] Actúa como el ingeniero de guardia que escribe el runbook: cada
error con su mensaje literal, su causa y el primer paso — para que el
próximo de guardia no te llame a las 3 a.m.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion6.md (Fase 6.8 y la tabla "Si algo
falla" — se integra al documento); docs/RAG.md (tabla de síntomas de IA,
para enlazar sin duplicar); .claude/skills/mercadotech-automatic-validator/
SKILL.md (vas a agregarle el ítem de tests, quirúrgicamente); CLAUDE.md
(dónde encaja la norma del ciclo). El CI ya está verde (6.7) y toda la
suite local también.

[OBJETIVO] Ejecuta la Fase 6.8: (1) docs/DEBUGGING.md con el flujo
síntoma → reproducir (test que falla) → logs (Next, endpoint de chat,
supabase logs, y CÓMO leer un fallo de CI: qué job, qué artefacto, cómo
abrir el reporte de Playwright descargado) → hipótesis única → fix → test
verde; la guía de "cómo pedirle debugging a Claude" (qué contexto darle);
y la tabla de errores típicos del stack con mensaje literal + causa +
primer paso (RLS, GRANT, modelo HF, dimensión del vector, Missing from
lock file, stdout del MCP). (2) Actualizar la Skill validator: nuevo ítem
obligatorio `npm run test` y, si `supabase status` está verde, también
`npm run test:e2e`; en rojo = FALLIDA. (3) Deja listada la norma del
ciclo (reviewer → correcciones → validator con tests) para que el Prompt
de cierre la integre a CLAUDE.md.

[PÚBLICO/TONO] docs/DEBUGGING.md lo lee un alumno bajo estrés, con un
error en pantalla: frases cortas, el mensaje LITERAL como título de cada
entrada, el primer comando a correr en un bloque copiable.

[RESTRICCIONES]
- La edición de la Skill es quirúrgica: solo el ítem nuevo del checklist y
  su regla; no reescribas su estructura.
- No dupliques la tabla de síntomas de RAG.md ni la de la spec: enlaza o
  transcribe UNA vez, con fuente.
- Sin cambios de código de producción ni de tests.

[FORMATO DE SALIDA] (1) docs/DEBUGGING.md; (2) diff de la Skill;
(3) demostración del gate: rompe un test a propósito → invoca el
validator → VALIDACIÓN FALLIDA citando el test → revierte → APROBADA
(pega ambas salidas); (4) recordatorio de reiniciar la sesión de Claude
Code para que la Skill actualizada se recargue; (5) commit: "docs: add
debugging runbook and wire tests into validator for Fase 6.8".
```

## Prompt de cierre — Bitácora de la sesión y actualización de CLAUDE.md

```text
[ROL] Actúa como tech lead que cierra una iteración: documentas lo
construido, lo decidido y lo pendiente, para que la sesión 7 (performance,
secretos y deploy) arranque sin arqueología.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 6.0–6.8
están implementadas y commiteadas, y el CI está verde en GitHub. Obtén el
estado REAL: `git log --oneline` (identifica el cierre de la sesión 5,
commit eed65ff, y el rango de la 6), `git diff --stat eed65ff..HEAD`,
`ls -R e2e .github`, la pestaña Actions (números de corrida verdes), la
tabla de cobertura de la última corrida, y lee docs/BITACORA.md, CLAUDE.md
y mercadotech/MercadoTech_sesion6.md (decisiones, entregables, criterios).
Recuerda que esta sesión ABSORBIÓ el CI de la antigua Fase 7.1 por
decisión del docente (está en el registro de cambios de la spec).

[OBJETIVO] (1) Agregar a docs/BITACORA.md la sección "Sesión 6" (arriba
de la 5): por fase, commits, qué se construyó, decisiones ejercidas con su
porqué (anclas al comportamiento real, mockeo de dos niveles, kanban por
teclado, pin de npm 11.6.2, credenciales dinámicas), problemas reales y
solución, números finales (tests, cobertura de services y validators,
duración de los jobs de CI), el cambio de alcance 7.1 → 6.7, y qué quedó
fuera (tests de componentes, tests del MCP, branch protection, deploy).
Cerrar con criterios de aceptación ✅/❌ con evidencia y pendientes para la
sesión 7. (2) Actualizar CLAUDE.md quirúrgicamente: comandos nuevos
(test, test:coverage, test:e2e y su prerrequisito de db reset), las
convenciones de testing que cambian cómo se escribe código (test junto al
archivo; Supabase inyectado jamás vi.mock; anclar al comportamiento real;
data-testid kebab-case), la norma del ciclo reviewer → validator (que ya
corre tests), la existencia del CI (qué corre en cada push) y el campo
packageManager (por qué no se toca a la ligera), y "Estado del proyecto"
al día (sesión 7 = performance + secretos + deploy, SIN CI que ya está).

[PÚBLICO/TONO] Bitácora: hechos con evidencia, para un alumno que no
estuvo. CLAUDE.md: solo líneas que cambien decisiones de código.

[RESTRICCIONES]
- Documenta lo CONSTRUIDO; si difiere de la spec, gana el código y se
  anota como desviación.
- CLAUDE.md crece máximo ~40 líneas netas.
- Todo sale de git, del filesystem y de la pestaña Actions; nada de
  memoria. No modifiques código ni tests.

[EJEMPLOS] Línea esperada en CLAUDE.md:
  * Los tests unitarios inyectan el cliente Supabase por parámetro — jamás
    `vi.mock` de `lib/supabase/*`; `lib/ai/*` sí se mockea por módulo.

[RAZONAMIENTO] Arma la línea de tiempo desde git, contrástala con los
entregables de la spec, redacta después. Relee CLAUDE.md completo al
final como si fueras a empezar la sesión 7 con él.

[FORMATO DE SALIDA] (1) Sección nueva de docs/BITACORA.md; (2) diff de
CLAUDE.md; (3) tabla entregables × estado × evidencia; (4) pendientes
para la sesión 7; (5) commit: "docs: add project log and update CLAUDE.md
at close of Sesión 6".
```

---

## Nota sobre la rúbrica

El riesgo dominante de una sesión de testing con IA es que el agente escriba
tests contra el código que IMAGINA en vez del que existe — por eso el
**Contexto** de 6.2, 6.3, 6.5 y 6.6 ordena leer el archivo bajo prueba antes
de escribir su test, y las **Restricciones** prohíben dos atajos clásicos:
"corregir" producción para que el test pase, y mockear por módulo lo que el
diseño permite inyectar. El segundo riesgo es heredar dolores ya pagados: el
pin de npm contra el lockfile de Windows, el stack efímero sin secretos y el
drag por teclado vienen del CI real de ReadHub y de la bitácora de este
mismo repo, cargados como decisiones cerradas que el **Razonamiento** pide
explicar (no re-descubrir) antes de tocar el workflow. Público/tono aparece
solo donde el output es prosa para humanos (el runbook de debugging y el
cierre); en el resto, el "lector" es el corredor de tests, y ahí lo que
manda es el Formato: evidencia ejecutable en cada fase — una suite verde
con Docker apagado, un reporte con el screenshot del fallo, una pestaña
Actions en verde y en rojo cuando debía.
