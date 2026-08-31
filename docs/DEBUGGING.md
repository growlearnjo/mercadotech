# Debugging en MercadoTech

Guía de guardia. Si tienes un error en pantalla ahora mismo, salta a
[Errores típicos](#errores-típicos-del-stack) y busca tu mensaje literal.

---

## El flujo, en seis pasos

No te saltes ninguno. El orden importa: cada paso hace barato el siguiente.

### 1. Síntoma

Escríbelo en una frase, sin interpretar todavía.

Mal: "el carrito está roto".
Bien: "agregar al carrito no cambia el contador del navbar, y no hay error en
la consola".

### 2. Reproducir

**Un test que falla es la mejor reproducción que existe.** Es repetible, es
rápido y queda como red de seguridad cuando arregles.

```bash
npm run test -- cart.service
```

Si el fallo solo se ve en la app y no en un unitario, es de integración:
escribe (o corre) el E2E del flujo.

```bash
npm run test:e2e -- buyer
```

Antes de una corrida completa de E2E, siempre:

```bash
supabase db reset
```

### 3. Leer los logs — el de verdad, no el que imaginas

| Dónde | Qué se ve | Cómo |
|---|---|---|
| Terminal de `npm run dev` | Errores de servidor, Server Components, middleware | Es la ventana donde arrancaste el dev server |
| Consola del navegador | Errores de cliente, hooks, fetch | F12 → Console |
| Pestaña Network | Estado y cuerpo de las llamadas a `/api/v1/*` | F12 → Network → clic en la petición → Response |
| Postgres / Auth / Storage | Rechazos de RLS, permisos, triggers | `supabase logs db`, `supabase logs auth`, `supabase logs storage` |
| Studio local | Datos reales, para confirmar si la fila existe | http://127.0.0.1:54323 |

**El endpoint de chat** (`app/api/v1/chat`) devuelve el error del proveedor en
el cuerpo de la respuesta: míralo en Network antes de tocar `lib/ai/`.

#### Cómo leer un fallo del CI

1. Abre la pestaña **Actions** del repositorio y entra a la corrida roja.
2. Mira **qué job** falló. Cambia el diagnóstico por completo:
   * **`Lint, tipos y tests unitarios`** — el fallo es del código, no del
     entorno. Reprodúcelo en local tal cual: `npm run type-check`,
     `npm run lint`, `npm run test:coverage`. Si en local pasa y en CI no,
     casi siempre es algo que existe en tu disco y no en el repositorio
     (una carpeta `node_modules` de un subproyecto, un archivo sin commitear).
   * **`E2E con Playwright`** — el fallo puede ser del código o de la
     diferencia dev/producción. Ver el paso 4.
3. Despliega el paso rojo dentro del job: el mensaje literal está ahí.
4. Baja al final de la página de la corrida, sección **Artifacts**:
   * `coverage` (7 días) — se sube SIEMPRE, también si el job falló.
   * `playwright-report` (14 días) — se sube SOLO si los E2E fallaron.
5. Descarga `playwright-report`, descomprímelo y ábrelo:

```bash
npx playwright show-report ruta/al/playwright-report
```

El reporte trae, por cada test rojo, el paso exacto que falló, su
**screenshot** y el **vídeo** de la sesión. Casi nunca hace falta más.

### 4. Una sola hipótesis

Escríbela antes de tocar nada, y en forma comprobable:

> "El contador no cambia porque `useCart` no vuelve a leer tras `addItem`."

Una sola. Cambiar tres cosas a la vez y ver que funciona no te dice cuál era.

**Si el fallo es solo en CI y no en local**, la primera hipótesis casi siempre
es *dev vs build de producción*. Compruébalo antes que nada:

```bash
npm run build && npm run start
```

y corre la suite contra eso.

### 5. El arreglo

El más pequeño que refute o confirme la hipótesis. Si la refuta, vuelve al
paso 4 con otra — no acumules parches.

### 6. El test pasa

Corre el que fallaba, y después la suite entera:

```bash
npm run test
```

Si el arreglo no tenía test, escríbelo ahora: es la única garantía de que el
error no vuelva.

---

## Cómo pedirle debugging a Claude

Claude no ve tu pantalla. Un buen pedido trae **cuatro** cosas:

1. **El síntoma**, en una frase, con lo que esperabas.
2. **Los pasos** para reproducirlo, en orden, empezando por el estado inicial
   (¿hiciste `supabase db reset`? ¿con qué usuario iniciaste sesión?).
3. **El log LITERAL**, copiado y pegado entero. No lo resumas ni lo
   parafrasees: el código de error (`42501`, `PGRST116`, `23503`) suele ser el
   dato que resuelve el caso, y es justo lo que se pierde al resumir.
4. **Qué ya descartaste**, y cómo lo comprobaste.

Y algo igual de importante: **di qué NO quieres que toque**. Sin eso, es fácil
acabar con lógica de producción "arreglada" para que un test pase.

Ejemplo de pedido bueno:

> El E2E `buyer-flow` falla en el paso 5: espera `S/ 4,398.00` en
> `cart-total` y encuentra `S/ 2,199.00`. Corrí `supabase db reset` antes.
> El log dice `Expected string: "S/ 4,398.00" / Received string: "S/ 2,199.00"`.
> Ya descarté que sea el formato, porque el resto del importe coincide. No
> cambies `cart.service.ts`: quiero entender primero si el problema es la
> cantidad que se envía.

---

## Errores típicos del stack

Cada entrada lleva el mensaje **literal** como título, la causa y el primer
comando a correr.

### `new row violates row-level security policy for table "…"`

**Causa.** La política RLS del INSERT/UPDATE no te deja escribir esa fila: el
`user_id` que mandas no es el de tu sesión, o tu rol no corresponde.

**Primer paso** — comprobar con quién estás escribiendo de verdad:

```bash
supabase logs db
```

Busca la sentencia rechazada y compara su `user_id` con el de tu sesión. Las
políticas en lenguaje de negocio están en
[`docs/ARQUITECTURA.md`](ARQUITECTURA.md).

### La consulta devuelve `[]` y no da ningún error

**Causa.** Casi siempre RLS también, pero en LECTURA: una política de SELECT no
lanza error, simplemente no devuelve filas. Cero filas y "no tienes permiso"
se ven idénticos desde el cliente — y es a propósito, para no filtrar qué
existe.

**Primer paso** — confirmar que la fila existe saltándose RLS:

```bash
supabase db reset && echo "abre http://127.0.0.1:54323 y busca la fila"
```

Si en Studio está y en la app no, es RLS. Si no está, es el seed o tu insert.

### `permission denied for table …`

**Causa.** Distinto de RLS: falta el `GRANT` al rol (`anon`, `authenticated`).
RLS filtra filas; el GRANT decide si puedes tocar la tabla siquiera.

**Primer paso:**

```bash
supabase db reset
```

Si el error desaparece, faltaba una migración por aplicar. Si persiste, la
migración que crea la tabla no incluyó su `grant`.

### `JSON object requested, multiple (or no) rows returned` (código `PGRST116`)

**Causa.** Usaste `.single()` donde puede no haber fila. `.single()` exige
exactamente una.

**Primer paso.** Cambia a `.maybeSingle()` y trata el `null` — es lo que hace
el resto de los services del proyecto.

### `duplicate key value violates unique constraint …` (código `23505`)

**Causa.** Chocaste con un `unique`. En este proyecto los habituales son
`(user_id, product_id)` en `cart_items` y `(buyer_id, product_id)` en
`reviews`.

**Primer paso.** No captures el error: lee primero y decide. `addItem` lo
resuelve leyendo la fila existente y sumando.

### `violates foreign key constraint …` (código `23503`)

**Causa.** `order_items.product_id` es `on delete restrict`: un producto que
se vendió alguna vez no se puede borrar.

**Primer paso.** Ninguno: es el comportamiento correcto. `seller.service`
traduce ese código a `ProductHasSalesError`, y la UI sugiere desactivar.

### `HUGGINGFACEHUB_API_TOKEN no está configurada.`

**Causa.** Falta la variable en `.env.local`. El CI **no** la necesita: los
E2E no afirman respuestas de IA.

**Primer paso:**

```bash
cp .env.example .env.local
```

y pega tu token de tipo *Read*. Reinicia el dev server: Next lee el `.env` al
arrancar.

### `model not supported` / `no provider available`

**Causa.** El modelo gratuito de Hugging Face rotó. Pasa sin aviso, y ya le
pasó a este curso con `zephyr-7b-beta`, `Qwen2.5-7B-Instruct` y
`Mistral-7B-Instruct-v0.3`.

**Primer paso.** No toques código: cambia SOLO la variable de entorno.

```bash
echo "HUGGINGFACE_CHAT_MODEL=<otro-modelo>" >> .env.local
```

### `expected 384 dimensions, not N`

**Causa.** El modelo de embeddings que estás usando produce un vector de otro
tamaño que el de la columna `knowledge_embeddings.embedding vector(384)`.

**Primer paso.** Volver al modelo de 384 dimensiones. Cambiar de dimensión
exige una migración (`ALTER COLUMN … TYPE vector(N)`), recrear el índice y la
función `match_knowledge`, y **reindexar todo**:

```bash
npx tsx scripts/index-all.ts
```

La tabla completa de síntomas de la capa de IA — con los casos de prueba y la
calibración del umbral — vive en [`docs/RAG.md`](RAG.md), sección "Tabla de
síntomas y diagnóstico". No se duplica aquí.

### `npm ci can only install packages when your package.json and package-lock.json are in sync… Missing <paquete> from lock file`

**Causa.** El npm del runner es más nuevo que el que generó el lockfile y
resuelve distinto las dependencias **opcionales** por plataforma. El lockfile
de este repo se generó en Windows con npm 11.6.2.

**Primer paso.** Comprobar que el pin del workflow y `packageManager` de
`package.json` siguen coincidiendo:

```bash
grep -n "packageManager" package.json && grep -n "NPM_VERSION" .github/workflows/ci.yml
```

Si actualizas npm en tu máquina y regeneras el lockfile, **tienes que
actualizar los dos sitios a la vez**.

### El cliente MCP no arranca, o corta la conexión sin explicación

**Causa.** Algo escribió en **stdout**, que es por donde viaja el JSON-RPC. Un
solo `console.log` lo corrompe.

**Primer paso:**

```bash
grep -rn "console\.log(" mcp/src
```

Debe devolver vacío. Para depurar dentro del MCP se usa `console.error`
(stderr), nunca `console.log`. Ver [`mcp/README.md`](../mcp/README.md).

### `Cannot find module 'tsup'` al correr `npm run type-check`

**Causa.** Se está type-chequeando `mcp/` desde la raíz sin que
`mcp/node_modules` exista. `mcp/` es un proyecto Node aparte y está excluido
del `tsconfig.json` de la raíz justo por esto.

**Primer paso:**

```bash
cd mcp && npm ci && npm run type-check
```

### Playwright: `Timeout … exceeded` esperando el `webServer`

**Causa.** `next build` tarda más que el margen del config, o el puerto 3000
está ocupado por otro dev server.

**Primer paso:**

```bash
npm run build && npm run start
```

Si eso tarda más de tres minutos, sube `webServer.timeout` en
`playwright.config.ts`. Si el puerto está ocupado, cierra el otro servidor:
en local Playwright REUTILIZA el que encuentre, y puede estar corriendo código
viejo.

### E2E rojos con "0 rows", login fallido, o un pedido que no aparece

**Causa.** Falta `supabase db reset`. Los specs crean pedidos y productos
reales; sin reset, la segunda corrida arrastra los datos de la primera.

**Primer paso:**

```bash
supabase db reset
```

Es parte del contrato de los E2E, no una recomendación.

### Un test unitario solo pasa con Docker encendido

**Causa.** Un mock no cubre alguna llamada y el `createClient()` por defecto se
coló: el service está hablando con la base de datos de verdad.

**Primer paso** — cazarlo apagando el stack:

```bash
supabase stop && npm run test
```

La suite unitaria **completa** debe pasar así. Si algo falla, ahí está el
cliente que no se inyectó.

---

## El ciclo de cierre

Al terminar cualquier feature, el orden es siempre el mismo:

1. **`mercadotech-code-reviewer`** — informe /10 por severidad. Informa, no
   bloquea.
2. **Correcciones**, humano-supervisadas. Las cuatro Skills reportan; ninguna
   edita código.
3. **`mercadotech-automatic-validator`** — el gate binario, que desde la
   sesión 6 **corre los tests**. Un test rojo = VALIDACIÓN FALLIDA.

Tras cambiar una Skill hay que **reiniciar la sesión de Claude Code** para que
se recargue.
