# Bitácora de MercadoTech

Registro acumulativo del proyecto, la sesión más reciente primero. Cada
entrada dice qué se construyó, qué se decidió y por qué, con qué se tropezó y
qué se dejó fuera a propósito.

---

# Sesión 8 — Agente de voz, demo y cierre del curso (2026-09-02)

La sesión que convierte el asistente de soporte en un agente: escucha, entiende
qué le piden, usa herramientas reales de la plataforma y responde hablando —
pidiendo permiso antes de actuar. Y antes de eso, ejecuta el go-live que la
sesión 7 dejó escrito.

**Volumen:** `git diff --stat 5d83f24..HEAD` → 33 archivos, +4 229 / −208 (sin
contar el commit de cierre).

**Titular:** el go-live **sí se ejecutó** y la tienda está publicada en
https://mercadotech.vercel.app. La sesión costó cinco correcciones tras el
primer paso por el validador, y las tres últimas enseñan más que el código que
las provocó.

---

## Fase 8.0 — El go-live, por fin (commits `d0382ee`, `9ba718c`, `a2106b4`)

Ejecutar `docs/DEPLOY.md` §2 tal como estaba escrito. La guía funcionó, pero el
primer despliegue real destapó **cuatro cosas que ninguna prueba local podía
ver**, todas ya incorporadas a la tabla de síntomas:

### 1. Una migración rota que llevaba semanas en verde

`supabase db push` falló con `42704: type "vector" does not exist` en la última
migración. La causa: un `grant` que nombraba el tipo como `vector` a secas
cuando pgvector se instala en el esquema `extensions`. Ese esquema está en el
`search_path` del stack **local** pero no en el de Supabase **hosted**, así que
el SQL pasaba en local y reventaba en producción.

26 migraciones "verdes" y una rota, invisible hasta el primer despliegue. La
migración hermana ya lo escribía bien (`extensions.vector`) desde la sesión 4:
la corrección fue alinear una línea con su vecina.

**Se editó la migración en vez de parchearla con otra nueva**, y la razón
importa: nunca llegó a aplicarse en ningún remoto —Postgres revierte el archivo
entero— y dejarla rota haría fallar el primer `db push` de cualquier proyecto
futuro.

### 2. Tres intentos perdidos por el formato de las claves

Supabase cambió su sistema de claves y los proyectos nuevos traen las *legacy*
(los JWT `eyJ…`) desactivadas. Pegar una da `401
UNAUTHORIZED_INVALID_API_KEY`, y el mensaje **no menciona en ningún momento**
que el problema sea el formato. Las buenas son `sb_publishable_…` y
`sb_secret_…`.

Queda en `DEPLOY.md` §1.1.b, con el `curl` que verifica una clave en dos
segundos — antes de gastar un ciclo de build entero.

### 3. Marcar como *Sensitive* una variable `NEXT_PUBLIC_`

Vercel entrega las variables sensibles **solo en tiempo de ejecución**, y las
`NEXT_PUBLIC_*` se necesitan **durante el build**. Al marcarlas se le pidieron
dos cosas incompatibles y ganó la de seguridad: quedaron vacías y la página
murió con `Application error: a client-side exception has occurred`.

Se confirmó con evidencia dura: buscando la URL del proyecto dentro de los
chunks servidos. No aparecía en ninguno.

### 4. Los valores de local pegados en producción

Con las variables ya cargadas, la web desplegada pedía sus datos a
`http://127.0.0.1:54321` — la máquina **del visitante**. Síntoma: `CORS error`
en todo, 0 bytes, en milisegundos.

Lo desconcertante fue el mensaje en pantalla: *"Revisa tu conexión e inténtalo
de nuevo"*, texto fijo del `ErrorState` que aparece ante cualquier fallo. La
consola decía "CORS" y tampoco era eso. **Lo resolvió mirar la Request URL en
la pestaña Network**: siempre preguntar a dónde va la petición, no solo qué
error devolvió.

### Lo que sí salió como estaba escrito

* PR #2 (`deploy-smoke`) con los dos checks marcados **Required**, preview con
  URL propia, merge que actualizó producción con el cambio del pie de página.
* Branch protection activa. Con un matiz aprendido: **"Require approvals"
  desmarcado**, porque GitHub no permite aprobar tus propios PR y con un solo
  colaborador dejaría todo bloqueado para siempre.
* Smoke test completo, ocho ✅, incluido `/soporte` citando la FAQ.

### Extra no planeado: catálogo de demostración

Producción nace vacía por diseño, pero una demo con el catálogo vacío no luce.
`supabase/demo-catalog.sql` siembra 20 productos entre las 8 categorías, y
`scripts/upload-catalog-images.mjs` sube sus fotos a Storage.

**No es una migración y no debe moverse a `migrations/`**: son datos que
dependen de un usuario que solo existe en producción; como migración reventaría
por clave foránea en cada `supabase db reset` y dejaría el CI en rojo
permanente. Resuelve el vendedor **por correo**, así que no lleva datos
personales escritos en un repositorio público.

---

## Fase 8.1 — La capa de voz (commit `c35fe43`)

Los oídos y la boca, sin cerebro: `lib/voice/` con las interfaces y su
implementación sobre la Web Speech API, `lib/constants/voice.ts` y
`hooks/useVoice.ts` con la máquina de estados.

**La interfaz no es ceremonia:** enchufar mañana Whisper o ElevenLabs es
escribir un archivo en esa carpeta con el mismo contrato. Ni la pantalla ni el
agente se enteran.

**Los cinco modos son UN estado y no cinco booleanos** porque son excluyentes:
si el asistente habla no puede estar escuchando, o se oiría a sí mismo.

### Dos cosas que solo aparecieron probando lo que sale mal

Se probó denegar el permiso del micrófono, y con eso salieron dos defectos que
el camino feliz jamás habría mostrado:

1. **La promesa se colgaba para siempre.** Con el permiso denegado el navegador
   dispara `onend` **inmediatamente**, antes de que nadie llame a `stop()`. Ese
   evento se perdía y el `stop()` posterior esperaba algo que ya había pasado:
   ni error, ni texto, ni nada — la interfaz congelada en "procesando". Lo
   resuelve una marca (`sesionTerminada`) que permite responder aunque el
   evento ya ocurriera.
2. **El error llegaba tarde.** Los fallos de permiso ocurren *antes* de que el
   micrófono se abra, así que el proveedor gana un `onError`: avisa cuando el
   error ocurre en vez de guardarlo hasta que alguien pregunte. Sin eso, la
   pantalla anunciaba una escucha que no existía.

**Decisión de interacción:** el micrófono es un **interruptor** (una pulsación
graba, otra envía) y no un mantener-pulsado. Dictar una consulta de soporte
lleva su tiempo —hay que pensar qué pedido era— y el dedo se suelta a media
palabra.

---

## Fase 8.2 — El orquestador (commit `989dc5f`)

El cerebro, **100 % texto**. La frase va como cabecera del archivo y el código
la cumple: *el agente no sabe que existe la voz*. Por eso el mismo orquestador
serviría para WhatsApp sin tocarlo.

Cada turno: resuelve una confirmación pendiente si la hay → clasifica la
intención entre cinco etiquetas cerradas → ejecuta la herramienta → redacta
corto. Sus herramientas **no son código nuevo**: llaman a `order.service`,
`chat.service` y `ticket.service`, así que hereda gratis la RLS.

### El problema de los UUID

La spec original pedía "extraer el número de pedido del texto". Los ids son
UUID de 36 caracteres: **nadie dicta `c0000000-0000-…`**. Se evaluaron cuatro
caminos y se eligió resolver **por contexto**: "mi último pedido" → el más
reciente; "el de la laptop" → coincidencia por producto; ante duda, enumera con
fecha, producto y estado — datos que se pueden escuchar.

El identificador es un problema del sistema, no del usuario. Trasladárselo sería
diseñar al revés. *(La alternativa de darles códigos cortos y legibles quedó en
el roadmap: es lo que hacen las tiendas reales.)*

### Decisiones que costaría caro cambiar

* **La confirmación viaja al cliente y vuelve** (`pending`) en vez de guardarse
  en el servidor: tiene que sobrevivir entre dos peticiones HTTP y no merece una
  tabla de sesiones con su expiración. No abre un agujero: quién puede crear el
  ticket lo siguen decidiendo la sesión y la RLS.
* **Confirmar se detecta con palabras, no preguntándole al modelo.** Es una
  decisión con efectos y no debe depender de que un modelo probabilístico esté
  de buen humor. Ante la duda, no se crea nada: volver a preguntar molesta,
  crear un reclamo que nadie pidió es peor.
* **`fuera_de_alcance` responde con texto fijo**, sin pasar por el modelo:
  dejarlo redactar abre la puerta a que intente responder igualmente.

### Un bug que solo el test podía ver

```js
/\búltim/.test("mi último pedido")   // false
```

En JavaScript `\b` marca la frontera entre `\w` y no-`\w`, y **`\w` no incluye
las vocales acentuadas**. La expresión nunca coincidía, y *"¿en qué estado está
mi último pedido?"* caía en la rama de ambigüedad. Ahora todo se normaliza sin
tildes, lo que además cubre a quien escribe sin ellas — en un chat, la mayoría.

---

## Fase 8.3 — El centro de soporte con voz (commit `ab95faa`)

`/soporte` con micrófono, transcripción en vivo, respuestas habladas y paridad
total con el teclado.

**La página es el único sitio donde la voz y el agente se encuentran**, y es
deliberado: `useVoice` no sabe que existe un agente y `useSupportAgent` no sabe
que existe un micrófono. Se componen en la página —regla del proyecto desde la
sesión 3— y por eso la voz servirá para otra cosa sin arrastrar al agente.

`ChatWindow` gana dos props opcionales en vez de duplicarse: dos copias de un
chat se desincronizan a la primera corrección, y `/asistente` sigue idéntico.

**Dos violaciones de capas heredadas, corregidas de paso** (las detectaron los
propios greps del `CLAUDE.md`): `ChatHistoryEntry` vivía en `hooks/useChat` y lo
importaban dos componentes, y `VoiceState` iba camino de repetir el error. Los
dos se mudaron a `types/`, el terreno neutral donde componentes y hooks pueden
encontrarse.

---

## Fase 8.4 — Calidad: cinco correcciones tras el validador

Tests del orquestador (12) y de los tickets (8), E2E del soporte en modo texto
(4), los greps de gobernanza y el validador.

**El validador dio FALLIDA en la primera pasada.** Los cinco hallazgos:

| # | Qué | Tipo |
|---|---|---|
| 1-2 | Dos tunables hardcodeados en el orquestador (`60`/`57` del asunto, `80` del recorte) | Regla del proyecto |
| 3 | Los E2E del agente fallaban con la base recién reseteada | **Prerrequisito** que faltaba |
| 4 | "Mis tickets" no se actualizaba tras crear uno | **Bug real** |
| 5 | El test de la FAQ era **intermitente** | Test mal escrito |

### El 3: un prerrequisito, no un fallo de código

`supabase db reset` reconstruye las tablas y siembra la FAQ, pero **no genera
sus embeddings** —eso cuesta llamadas al proveedor de IA y no cabe en un
`.sql`—. Sin `npx tsx scripts/index-all.ts`, la búsqueda no encuentra nada y el
agente responde, con toda corrección, que no halló información. El test se ponía
rojo por datos que faltaban. Es el mismo desajuste que `npm run db:images`
resuelve para las fotos, y ya está documentado en el spec y en `CLAUDE.md`.

*(De camino apareció que `.env.local` tenía una `SUPABASE_SERVICE_ROLE_KEY` que
no era la del stack local — se coló la de producción durante el go-live. Por eso
el indexado fallaba con `permission denied`: Supabase la rechazaba y el script
caía al rol `anon`.)*

### El 4: el bug que ningún test unitario podía ver

El agente creaba el ticket, respondía "listo, lo registré", y la lista de abajo
seguía igual. **Las dos piezas funcionaban por separado** —crear un ticket y
listar tickets estaban probados—; lo que fallaba era la **coordinación** entre
ambas. `useMyTickets` cargaba al montar y nadie la volvía a pedir.

Es exactamente para lo que existen los E2E, y justifica su coste.

### El 5: el peor de los cinco, aunque parezca el más tonto

El test de la FAQ afirmaba que la respuesta trae fuentes citadas. Pero eso
depende de superar un **umbral de similitud**, que varía según cómo el modelo
vectorice la pregunta: el mismo test pasaba y fallaba sin cambiar una línea.

**Un test que falla al azar es peor que no tener test**: entrena a ignorar el
rojo, y el día que se ponga rojo por un bug de verdad se descartará igual. Y
además saltaba una regla que el proyecto ya tenía desde la sesión 6 —*los E2E no
afirman respuestas de IA*—. Ahora afirma lo que sí es determinista: que el turno
llegó y no reventó. Las fuentes siguen cubiertas en los tests unitarios, donde
el modelo es un doble.

**Segunda pasada del validador: APROBADA.** 313 unitarios, 17 E2E, lint, tipos,
build y type-check del MCP en verde.

---

## Fase 8.5 — Demo y roadmap

* **`docs/DEMO.md`** — guion de 10 minutos con datos exactos. Su pieza más
  astuta: en el minuto 2 el comprador hace una compra real, y **ese** es el
  pedido que el agente consulta en el minuto 7. Incluye plan B escrito para los
  tres modos de fallar en vivo (micrófono, modelo, internet) y la checklist
  manual de la voz.
  **Aviso incorporado:** los 20 productos de producción **no están indexados**
  —se sembraron después del reindexado—, así que reindexar es el primer paso
  antes de cualquier demo.
* **`docs/ROADMAP.md`** — diez entradas con esfuerzo estimado, abriendo con la
  deuda ya medida del catálogo client-side.

---

## Decisiones ejercidas

| # | Decisión | Por qué |
|---|---|---|
| 1 | **El agente no sabe que existe la voz** | Recibe texto, devuelve texto. Permite reutilizarlo en WhatsApp o móvil sin tocarlo, y hace que los E2E de texto cubran el mismo camino que recorrería dictando |
| 2 | **Consultar es directo; escribir se pregunta** | Leer un pedido no compromete a nadie. Abrir un reclamo sí, y un agente que actúa sin permiso es peor que no tener agente |
| 3 | **Pedidos por contexto, nunca por UUID** | Nadie dicta 36 caracteres. El identificador es problema del sistema |
| 4 | **La voz no se automatiza en el CI** | No hay micrófono en un runner y `SpeechRecognition` no existe headless. Simularla verificaría nuestro propio simulador |
| 5 | **Micrófono como interruptor**, no mantener pulsado | Dictar una consulta lleva tiempo y el dedo se suelta a media frase |
| 6 | **Solo se responde en voz si se preguntó por voz** | Quien escribe no espera que la pantalla le conteste en voz alta |
| 7 | **`/dev/voz` se conserva** — desviación de la spec | La spec pedía borrarla en la 8.4. Se decidió mantenerla como banco de pruebas. **Consecuencia asumida:** no está bajo `(shop)`, así que no exige sesión y queda accesible en producción. Anotada en el roadmap |

---

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Hablar y obtener el estado real de un pedido, sin dictar id | ✅ | Probado en Chrome sobre el stack local |
| El reclamo por voz exige y respeta la confirmación | ✅ | E2E `support-agent.spec.ts` en modo texto + prueba manual |
| En Firefox la página funciona 100 % por teclado | ✅ | Probado: el botón se deshabilita y lo explica |
| Ciclo de calidad completo en verde | ✅ | 313 unitarios · 17 E2E · lint · tipos · build · MCP · validador APROBADA |
| Producción actualizada con el agente | ⏳ | Pendiente del merge de este PR |
| Demo ejecutable sin improvisar | ✅ escrita · ⏳ ensayo | `docs/DEMO.md`; el ensayo cronometrado queda para el operador |

---

## Retrospectiva del curso

Ocho sesiones planeadas, siete ejecutadas (la 1 nunca se corrió, y por eso no
existe `docs/COSTOS.md`: **no se fabricó un registro de gasto retroactivo**).

**Lo que mejor envejeció:** la decisión de la sesión 2 de que todo service
reciba el cliente Supabase por parámetro. Parecía un detalle de estilo; acabó
permitiendo 313 tests unitarios que corren en 3 segundos **sin Docker**, y que
el agente de la sesión 8 reutilizara los services sin tocarlos.

**Lo que más caro salió:** confiar en que lo verde en local está bien. Tres
sesiones seguidas lo desmintieron — el lockfile que rompía `npm ci` en Linux
(S6), la migración con el tipo sin calificar (S8), y las tres formas de medir
mal el rendimiento (S7). **La lección común: local y producción no son el mismo
sitio, y solo se descubre cruzando la frontera.**

**Lo que no se hizo y estuvo bien no hacer:** pagos reales, un catálogo servido
desde el servidor, y borrar el hallazgo de accesibilidad del kanban en vez de
arreglarlo. Los tres están medidos o documentados, que es lo que los convierte
en deuda gestionada y no en deuda olvidada.

**El número que más dice del proyecto:** de las cinco correcciones de la Fase
8.4, **tres no las encontró nadie leyendo código**. Las encontraron un test que
falló, un validador que no acepta matices y una prueba manual de lo que sale
mal.

---

# Sesión 7 — Performance, secretos y despliegue (2026-09-02)

La mudanza del taller al local comercial. La tienda ya funcionaba y tenía red
de seguridad (sesión 6); esta sesión salda la deuda de accesibilidad que quedó
abierta, mide la performance de verdad, escribe dónde vive cada llave y deja
preparado el go-live a Vercel.

**Volumen:** `git diff --stat c1da6e8..HEAD` → 19 archivos, +2 565 / −275.
**Rango:** `fa0d9ac` … `cc569e9` (más la rama `deploy-smoke`, sin publicar).

**Titular incómodo y honesto:** de los dos objetivos numéricos de performance
se cumplió uno (CLS) y no el otro (Lighthouse ≥ 90). La causa no es una
optimización que falte, sino de dónde vienen los datos — está medida, explicada
y anotada como la deuda técnica principal del proyecto. Y **el go-live quedó
preparado pero no ejecutado**: depende de dashboards que solo puede operar una
persona.

---

## Paso 0 de la 7.2 — El hallazgo del kanban, cerrado (commit `27fcf97`)

La sesión 6 cerró con el kanban de pedidos inutilizable por teclado y sus 2
tests E2E en `test.fixme`. La spec de la 7 lo daba por un arreglo de **una
línea**: pasarle al `KeyboardSensor` el mismo `coordinateGetter` que ya usaba la
galería de imágenes.

**No lo era, y descubrir por qué fue el trabajo real.** Aplicado el cambio, los
tests seguían rojos y la tarjeta no se movía **ni un pixel** — antes al menos se
movía 25 px. Leyendo el código de `@dnd-kit/sortable` aparece la razón:

```js
const activeDroppable = droppableContainers.get(active.id);
if (newNode && newRect && activeDroppable && newDroppable) { … }
```

`sortableKeyboardCoordinates` exige que el elemento **arrastrado** esté también
registrado como **droppable**, y eso solo lo hace `useSortable`. En la galería
las imágenes son sortables; en el kanban las tarjetas son `useDraggable` y los
droppables son las columnas. Ese `get` devolvía siempre `undefined`, así que el
getter devolvía `undefined` y no había movimiento.

La confirmación vino de instrumentar la región `aria-live` de dnd-kit, que narra
el arrastre: tras `ArrowRight` seguía anunciando *"was moved over droppable area
pagado"*, la columna de origen.

**Solución:** un `coordinateGetter` propio en `OrdersKanban` que ordena las
columnas habilitadas por su borde izquierdo, ubica la tarjeta y salta a la
contigua — una pulsación, una columna. Permite `ArrowLeft` aunque el flujo de
estados no admita retrocesos: rechazar es trabajo del hook, que avisa con un
toast; si lo bloqueara el teclado, quien navega con teclado no recibiría
explicación alguna.

**Y el test también necesitaba trabajo.** Con el getter puesto, seguía rojo:
dnd-kit resuelve la columna de destino **en el frame siguiente** a la flecha, y
el `Space` de soltar que Playwright dispara en el mismo milisegundo caía sobre
la columna de origen. Una persona nunca teclea tan rápido. `moveByKeyboard`
espera ahora a que **cambie el anuncio aria-live** — estado observable, no un
`waitForTimeout`.

**Desviación de la spec, deliberada:** la spec pedía "14/14 E2E" y el resultado
es **13/13**. El test que faltaba era el que *documentaba el defecto* —afirmaba
que una flecha NO cambia de columna—, y el propio comentario de la sesión 6
mandaba borrarlo el día del arreglo: hoy afirma lo contrario de lo correcto.
Trece verdes y ningún `fixme`.

---

## Fase 7.2 — Performance: medir, cambiar, medir (commits `b2fc206`, `f943ca9`, `4416d9a`)

### Lo que se ganó

| Cambio | Medición |
|---|---|
| Esqueleto de catálogo en el Suspense de la home | **CLS 0.118 → 0** ✅ (objetivo < 0.1) |
| `dynamic import` de la galería de imágenes | `/vendedor/publicar` y `/editar`: **308 kB → 287 kB** cada una |
| `priority` en las 4 primeras imágenes del grid | Quita el `loading="lazy"` del elemento LCP; su Load Time baja de 138 a 72 ms |

### Lo que se revirtió, con su número

La regla de la fase —lo que no mueve la aguja se revierte y queda anotado—
descartó tres cosas: el `dynamic import` de `ChatWindow` (solo −6 kB, a cambio
de cargar en cascada el contenido principal de la ruta), el esqueleto en
`/categoria/[slug]` (CLS idéntico; y al mover `React.use(params)` dentro del
límite de Suspense **la ruta quedó colgada en el esqueleto para siempre**) y el
de `/buscar` (sin medición que lo respaldara). El `dynamic import` de
`OrdersKanban` ni se escribió: el kanban **es** el contenido de su ruta.

### Tres formas de medir mal, todas cometidas antes de acertar

Esto es lo más útil que deja la fase, y está detallado en
[`PERFORMANCE.md`](PERFORMANCE.md) §2:

1. **Servidor viejo con build nuevo.** `next start` sigue sirviendo el build que
   leyó al arrancar. Daba **94** en la home — 22 puntos por encima de lo real.
   Se detectó comparando la hora de arranque del proceso con la de
   `.next/BUILD_ID`; ahora el script de medición aborta si el servidor es
   anterior al build.
2. **Caché fría del optimizador de imágenes.** La primera petición a
   `/_next/image` obliga a Next a optimizar cada imagen: 68 en la primera
   corrida y 73 en la tercera, sin tocar nada. Se añadió una corrida de
   calentamiento que se descarta.
3. **Medir una redirección.** `/asistente` exige sesión y Lighthouse acababa
   midiendo `/login`. Produjo un falso "68 → 84 tras optimizar" que era la
   varianza de `/login` consigo mismo. Se detecta leyendo `finalDisplayedUrl`.

La varianza entre corridas idénticas llegó a **21 puntos**. Todos los números
del informe son la **mediana de 3 corridas** tras un calentamiento.

### Por qué no se alcanza Lighthouse ≥ 90

Un `curl` lo resume: `curl -s localhost:3001/ | grep -c product-card` → **0**.
El HTML inicial no trae ni una tarjeta. Las páginas son Client Components que
piden los datos tras hidratar, así que la secuencia real es descargar ~300 kB de
JavaScript → hidratar → `fetch` a Supabase → recién entonces existe la imagen.
Eso son **3.9 s de "Load Delay"** en el LCP, el 73 % del total, y ninguna
optimización de imagen puede tocarlo.

Arreglarlo significa servir el catálogo desde **Server Components**, lo que
cambia la regla `hooks → services` que rige el proyecto desde la sesión 3. No se
hizo **a propósito**: la sesión prohíbe features y cambios de alcance, y alterar
el contrato de capas a mitad de un go-live es justo el riesgo que esta sesión
existe para evitar. Queda como la deuda técnica principal, medida y documentada.

---

## Fase 7.3 — Gobernanza de secretos (commit `de23817`)

`docs/DEPLOY.md` §1: la tabla de las 6 variables (dónde vive cada una, quién la
lee, pública o secreta), las reglas de operación, y **la fila que no existe a
propósito**: GitHub Actions no recibe ninguna variable ni ningún secreto. No es
un olvido — el CI de la sesión 6 levanta su propio Supabase efímero y no afirma
respuestas de IA, así que no necesita credenciales. Un CI sin secretos no puede
filtrarlos, y en un repositorio público eso importa el doble.

Los cuatro greps anti-fuga (`hf_`, `sb_secret`, `eyJ`, y `.env.local` en todo el
historial de git) **dieron vacío**, con su salida pegada en el documento.

---

## Fase 7.4 — Despliegue: preparado, no ejecutado (commits `a9ee8f4`, `b45970d`)

### Lo que sí quedó hecho

**`supabase/seed.prod.sql`**: 8 categorías (sin ellas nadie puede publicar,
porque el formulario exige categoría) y los 10 artículos de FAQ, que siempre
fueron contenido real. **Sin usuarios** —los del laboratorio tienen contraseñas
publicadas en este repositorio— y **sin productos**: un marketplace nace vacío, y
ver la home con su `EmptyState` es el estado correcto de una tienda recién
abierta, no un fallo del despliegue.

Verificado de verdad, no a ojo: ejecutado contra el Postgres local dentro de una
transacción revertida → 8 categorías, 10 artículos publicados, 0 productos.

**`docs/DEPLOY.md` §2**: la guía operativa completa, paso a paso y con un
"deberías ver" en cada uno — `db push`, seed, indexado de la FAQ, confirmación
de email, importación en Vercel con las variables por entorno, branch protection
con los dos checks obligatorios, la demostración del flujo y la checklist del
smoke test. Con los tres pasos de riesgo y su plan B por delante.

**Rama `deploy-smoke`** (commit `571e10c`, **sin publicar**): el cambio visible y
trivial en el pie que sirve para comprobar de un vistazo que el flujo PR →
preview → merge → producción funciona.

### Lo que NO se ejecutó, y por qué

Los pasos 2 a 10 de la fase son **clics en dashboards**: crear el proyecto
Supabase de producción, `supabase login`, conectar Vercel, pegar las claves,
configurar la protección de rama, correr el smoke test. Nada de eso es
automatizable desde aquí, y los valores de las claves no pueden pasar por el
chat — es la regla de oro de la sesión.

**Consecuencia:** no hay URL de producción, ni branch protection activa, ni
smoke test corrido. Los entregables 1 y 4 de la sesión quedan **pendientes de la
sesión humana**, con todo lo necesario ya escrito para ejecutarlos de un tirón.

---

## Fase 7.5 — Documentación (commit `cc569e9`)

* **`README.md`** ahora es el del **producto**, no el del curso: qué es
  MercadoTech, stack, puesta en marcha desde cero con cada comando copiable y en
  orden ejecutable, usuarios de prueba, capas, flujo del RAG, testing con su
  prerrequisito de `db reset`, deploy resumido y estructura comentada. Se
  verificó archivo por archivo que **cada ruta y cada documento que enlaza
  existe**.
* **`docs/PLAN_CURSO.md`**: el README anterior, movido **intacto** con una nota
  de contexto.
* **`docs/ARQUITECTURA.md`**: seguía en la era de la sesión 2 y afirmaba cosas ya
  falsas — *"components/, hooks/, services/ vacíos"*, *"no hay pantallas de
  login"*, *"ningún archivo importa admin.ts"*, *"no existe `app/api/v1/`"*. Se
  corrigieron esas líneas y se sumaron cinco secciones con lo construido
  después: frontend (S3), RAG (S4), Skills y MCP (S5), testing y CI (S6),
  despliegue y performance (S7).

---

## Decisiones ejercidas

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Deploy 100 % por la interfaz de Vercel**, secretos a mano en su dashboard | Directiva del docente. Se eliminó la opción de CLI/Actions: sin tokens de deploy, sin jobs de despliegue en el workflow, ningún secreto en GitHub Actions |
| 2 | **Seed de producción sin usuarios ni productos** | Los usuarios de laboratorio tienen contraseñas públicas en el repositorio; y un marketplace lo llenan sus vendedores |
| 3 | **Los previews comparten la base de datos de producción** | Un solo proyecto Supabase por alumno en el plan gratuito. Riesgo real y asumido: un preview escribe sobre datos reales. Documentado, con el staging separado como mejora |
| 4 | **Confirmación de email desactivada en producción** | Supabase hosted la trae activa y este proyecto no tiene proveedor de correo configurado: sin desactivarla, nadie podría registrarse. Decisión de laboratorio, no de producto |
| 5 | **El repositorio se mantiene público** | Habilita branch protection en el plan gratuito. A cambio, los greps anti-fuga pasan de higiene a obligación |
| 6 | **13/13 E2E en vez de 14/14** | El test que faltaba documentaba el defecto ya corregido (ver Paso 0) |
| 7 | **No se pagó la deuda de Server Components** | Cambiar el contrato de capas a mitad de un go-live es el riesgo que esta sesión existe para evitar. Medido y anotado para quien lo tome |

---

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| El hallazgo del kanban cerrado, sin `fixme` | ✅ | commit `27fcf97`; 13/13 en chromium, el navegador del CI |
| PR de prueba con CI + preview, merge bloqueado en rojo y permitido en verde | ⏳ **pendiente** | rama `deploy-smoke` lista sin publicar; requiere Vercel y branch protection (pasos humanos) |
| La URL de producción pasa el smoke test | ⏳ **pendiente** | checklist escrita en `DEPLOY.md` §2.9; no hay URL todavía |
| Lighthouse ≥ 90 en home y catálogo | ❌ **no alcanzado** | 72 y 62. Causa medida y explicada: `PERFORMANCE.md` §7 |
| CLS < 0.1 | ✅ en la home (0.118 → 0) · ❌ en catálogo y producto (0.118) | `PERFORMANCE.md` §4.1 y §5 |
| Un desarrollador nuevo levanta el proyecto solo con el README | ✅ | cada ruta, documento y comando verificados contra el repositorio |
| `lint`, `type-check`, `test` y `build` verdes | ✅ | 293 unitarios en 3 s; build verde; type-check del MCP también |

---

## Qué quedó fuera, a propósito

* **Proyecto de staging separado.** Los previews seguirán tocando la base de
  producción hasta que exista.
* **E2E contra previews en el CI.** Queda como herramienta manual documentada:
  los specs crean pedidos y productos de verdad.
* **`@next/bundle-analyzer`.** El build usa Turbopack; el peso se lee del
  resumen de `next build`.
* **Server Components para el catálogo.** La deuda medida de §7.2.
* **Todo lo de voz.** Es la sesión 8.

## Para la sesión 8

1. **Ejecutar el go-live pendiente**: `DEPLOY.md` §2, de principio a fin, y
   anotar en él la URL y los resultados del smoke test. Completar también la
   línea "Producción" del `README.md`.
2. El agente de voz amplía `/soporte` sobre el mismo RAG y reutiliza la tool
   `get_order_status` del servidor MCP.
3. Deuda abierta y medida: catálogo desde el servidor (LCP y CLS), el CLS de
   `/categoria/[slug]` y `/producto/[id]`, y el proyecto de staging.

---

# Sesión 6 — Testing y CI con GitHub Actions (2026-08-31)

MercadoTech no gana ninguna pantalla en esta sesión. Gana una **red de
seguridad y un portero**: 293 tests unitarios que corren en 3 segundos sin
tocar la red, 14 tests E2E que recorren la tienda en un navegador real contra
el Supabase local, y un pipeline de GitHub Actions que ejecuta todo en cada
push y cada pull request. Aquí es donde la inyección del cliente Supabase
decidida en la sesión 2 paga su dividendo: los services se prueban sin base de
datos.

**Volumen:** `git diff --stat eed65ff..HEAD` → 71 archivos, +8 586 / −210.

**Cambio de alcance:** esta sesión ABSORBIÓ el pipeline de CI que el plan
maestro tenía como Fase 7.1 (decisión del docente, 2026-08-28). La sesión 7
conserva performance, secretos, despliegue en Vercel y documentación final.

## Prompt 0 — Remoto de GitHub y herramientas (commits `dda2d07`, `d6bce64`)

El repositorio pasó de ser solo local a tener remoto:
`https://github.com/growlearnjo/mercadotech`. Instalados `vitest@4.1.11`,
`@vitest/coverage-v8@4.1.11` y `@playwright/test@1.62.1`, más los 3
navegadores en local (chromium, firefox 153, webkit 26.5). Sin configuración
todavía: eso es 6.1 y 6.4.

**Problema real.** El primer `git push` falló con `403 Permission to
growlearnjo/mercadotech.git denied to cosmostories`: Git Credential Manager
tenía guardada la credencial de otra cuenta de GitHub. **Solución:** borrar la
entrada con `git credential reject` y dejar que el navegador reautorice. No se
intentó ningún flujo alternativo con tokens.

**Segundo problema.** `npm run lint` empezó a reportar 19 557 problemas:
ESLint estaba recorriendo `.claude/worktrees/`, un worktree efímero de Claude
Code que es una copia completa del repo con su propio `node_modules`. El glob
`node_modules/**` de la config solo cubre el de la raíz. **Solución:**
`.claude/worktrees/**` a los `ignores`.

## Fase 6.1 — Infraestructura de Vitest (commit `f335433`)

`vitest.config.mts` con environment `node` (sin jsdom ni Testing Library:
esta sesión no testea componentes), alias `@` → raíz igual que el tsconfig,
`include: **/*.test.ts`, exclude de `node_modules`/`mcp`/`e2e`/`.next`/
`.claude`, y coverage v8 (`text` + `html`) limitada a `lib/` y `services/`.
Scripts `test`, `test:watch` y `test:coverage`.

**Desviación de la spec.** El archivo es `.mts`, no `.ts`. Como `.ts`, Vite lo
carga como CommonJS (la raíz no declara `"type": "module"`) y avisa de que su
sintaxis ESM será un error en una versión futura. `.mts` es ESM sin
ambigüedad y Vitest lo descubre solo.

## Fase 6.2 — Tests de lógica pura (commit `fee0a5a`)

80 casos sobre `lib/validators/auth.ts`, `lib/validators/product.ts`,
`lib/utils.ts`, `lib/ai/context-builder.ts` y `lib/ai/prompts.ts`. Cero mocks
(ningún archivo resultó impuro) y cero números escritos a mano: los valores
frontera se importan de las constantes reales, así que si
`PASSWORD_MIN_LENGTH` sube a 10 los tests siguen probando "uno menos / justo
el mínimo" sin tocarse.

**Cobertura: 100 % de statements, ramas, funciones y líneas** en esos cinco
archivos (103/103, 69/69, 15/15, 93/93).

**Hallazgo que cambió la Fase 6.5.** `formatPrice` no devuelve `"S/ 0.00"`:
devuelve `"S/"` + U+00A0 + `"0.00"`. Intl separa el símbolo del monto con un
**espacio duro**. Los tests fallaron con `expected 'S/ 0.00' to be 'S/ 0.00'`,
dos cadenas idénticas a la vista. Queda anclado con un test explícito
(`.not.toBe("S/ 0.00")`) y una constante `NBSP` escrita como escape, no como
carácter invisible. Consecuencia: las aserciones de dinero de los E2E salen de
`formatPrice`, nunca se teclean.

## Fase 6.3 — Services con Supabase mockeado (commit `6c39be9`)

`services/test-utils/supabase-mock.ts`: fábrica encadenable y "thenable" que
imita `from().select().eq().maybeSingle()`, `rpc()`,
`storage.from().getPublicUrl()` y `auth.*`. Se programa por tabla y por método
terminal, y APUNTA todo lo que le piden (`inserts`, `updates`, `upserts`,
`deletes`, `filters`, `calls`, `rpcCalls`, `authCalls`) para poder afirmarlo.

213 casos nuevos sobre cart, order, product, seller, el helper del kanban,
review, question, favorite, auth, embedding, vector-search y chat.

**Cobertura de `services/`: 89.89 % de líneas** (267/297), 89 % de statements,
84.76 % de ramas — sobre la meta de 80 %. Los tres services sin tocar
(`category`, `indexing-trigger`, `ticket`, 0 %) no figuran en la tabla de la
spec.

**Mockeo de dos niveles, ejercido.** El cliente Supabase se INYECTA por el
último parámetro en los 12 archivos; `vi.mock` aparece exactamente en tres
(`embedding`, `vector-search`, `chat`) y solo sobre `lib/ai/*`, con el porqué
escrito arriba de cada uno: esos services importan el proveedor de IA directo
por diseño de la sesión 4, así que no hay puerta que abrir y hay que
sustituir el módulo entero.

**Verificado sin red, de verdad:** `supabase stop` → `Test-NetConnection
127.0.0.1:54321` = `False`, `docker ps -q` = 0 contenedores → `npm run test`
= 293/293. Ningún test necesitó la base de datos.

**Único cambio de producción:** `export` a `validateTransition` en
`hooks/useSellerOrders.ts` (decisión 4), sin tocar su lógica.

### Comportamiento actual, revisar

Dos hallazgos anclados tal cual, no corregidos:

1. **`cart.service.addItem` con stock 0 acepta 1 unidad.**
   `Math.max(1, Math.min(desired, 0))` da 1: el piso gana al tope. El carrito
   acepta algo que el checkout va a rechazar. La UI lo tapa deshabilitando el
   botón (cubierto por el E2E negativo de la 6.5).
2. **`validateTransition("cancelado", "cancelado")` devuelve `{ ok: true }`.**
   La rama `from === to` va antes de la de `cancelado`. Inalcanzable desde la
   UI: soltar una tarjeta en su propia columna no dispara ningún cambio.

## Fase 6.4 — Infraestructura de Playwright (commit `f6a5e9b`)

`playwright.config.ts` con el patrón de ReadHub, `e2e/data/{users.ts,
product-image.jpg}`, fixture con los 7 Page Objects y `loginAs`, y el smoke
`home.spec.ts`. Scripts `test:e2e` y `test:e2e:ui`.

21 componentes tocados **solo con atributos `data-testid`** (kebab-case con
prefijo de dominio): ni lógica, ni estilos, ni estructura. Antes había cero en
todo el repo.

**Dato del seed que corrige un supuesto.** El único pedido en `pagado` es
`c…03`, y es de **seller2 (GamerZone Lima)**, comprado por **buyer2** — no de
seller1. Leído del seed, no asumido: el spec de la 6.6 con seller1 habría
corrido contra una columna vacía y pasado sin probar nada.

**Tres ajustes que el entorno obligó:**
- Timeout de test a 60 s: `next dev` compila cada ruta al primer pedido y con
  los 3 navegadores golpeando a la vez la home se pasaba de los 30 s.
- `import.meta.url` → `__dirname` en `SellerProductsPage.ts`: Playwright carga
  estos `.ts` como CommonJS y `import.meta` ahí es error de sintaxis.
- `react-hooks/rules-of-hooks` apagada solo en `e2e/`: la fixture recibe una
  función `use()` que la regla confunde con un hook fuera de componente.

## Fase 6.5 — E2E del comprador (commit `8b09ba9`)

`buyer-flow.spec.ts` con los 8 pasos como `test.step` (login → filtrar
Laptops → abrir producto con stock → agregar 2 → carrito y subtotal →
checkout → detalle "Pendiente" con snapshots → mis pedidos → logout), más un
paso extra que comprueba que el RPC vació el carrito en la misma transacción.
`buyer-negative.spec.ts` cubre stock 0, carrito vacío, anónimo en `/carrito` y
el detalle de producto como ruta pública.

El pedido se identifica por el id que devuelve la URL de redirección, jamás
por posición en la lista.

**Detalle de la UI real que el spec no anticipaba:** con el carrito vacío la
app no pinta el resumen con el botón deshabilitado — pinta un `EmptyState` y
el botón NO existe. El test afirma la ausencia, que es lo que la app hace.

**Demostración del reporte:** rompiendo `toHaveText("Sin stock por ahora.")`,
el reporte HTML guardó `test-failed-1.png` con el detalle del Monitor Samsung
Odyssey, su aviso de stock y el botón en gris. Revertido.

## Fase 6.6 — E2E del vendedor (commit `4a06500`)

`seller-flow.spec.ts` publica un producto con imagen (título único por
timestamp) y lo verifica en la tabla del vendedor y en el catálogo público.
`seller-negative.spec.ts` cubre la expulsión del comprador del panel y la
columna `cancelado` de solo lectura.

**Comportamiento real distinto del esperado:** publicar NO vuelve al listado,
redirige a `/vendedor/productos/<id>/editar` — las imágenes necesitan el
`product_id` para respetar la política del bucket.

**Los workers de Playwright pasan a 1 siempre, no solo en CI.** La suite
comparte UNA base de datos local y en paralelo los specs se pisaban (3 tests
en timeout); además el dev server se satura compilando rutas bajo demanda.

### HALLAZGO DE ACCESIBILIDAD — el kanban no es usable por teclado

`components/seller/OrdersKanban.tsx` registra el `KeyboardSensor` de dnd-kit
pero **no le pasa un `coordinateGetter`**. El getter por defecto desplaza la
tarjeta **25 px por pulsación de flecha**, sin ninguna noción de columnas. Las
columnas miden `min-w-60` (240 px) más 12 px de separación, así que una
pulsación de `ArrowRight` la suelta sobre su propia columna, y dnd-kit lo
anuncia literalmente en su live region:

```
Draggable item c0000000-…-03 was dropped over droppable area pagado
```

Comprobado empíricamente: con **14 pulsaciones seguidas** (≈350 px) la tarjeta
cruza y el cambio persiste. Ningún usuario de teclado va a descubrir eso.

Es un defecto y no una limitación del test: el otro drag & drop del proyecto,
`SortableImageGallery`, SÍ pasa `coordinateGetter: sortableKeyboardCoordinates`
(línea 143). La galería es accesible por teclado; el kanban no. La diferencia
es una línea.

**Qué se hizo.** La decisión 9 prohíbe resolverlo con `mouse.down/move/up`
—enmascararía justo lo que el test existe para detectar— y corregir
`OrdersKanban.tsx` es cambio de producción, fuera del alcance de una fase de
testing. Así que: los dos tests que dependen de ese camino quedan en
`test.fixme` escritos completos y con el arreglo documentado, y se agregó uno
que documenta el defecto actual y **se pondrá rojo el día que se corrija**,
que es cuando hay que borrarlo y habilitar los otros dos. La regla de negocio
que el negativo iba a cubrir (no retroceder de `enviado` a `pagado`) sí está
probada, sin navegador, en `hooks/useSellerOrders.test.ts`.

## Fase 6.7 — Pipeline de CI (commits `28ad785`, `7e5a1b1`)

`.github/workflows/ci.yml` con dos jobs encadenados y **cero secretos**:

* **`checks`** (15 min, sin Docker): Node 24 con caché npm, pin de
  `npm@11.6.2`, `npm ci`, type-check, lint, `test:coverage`, type-check del
  MCP con su propio `npm ci`, y la cobertura como artefacto 7 días con
  `if: always()`.
* **`e2e`** (`needs: checks`, 20 min): mismo setup, caché de
  `~/.cache/ms-playwright` por hash del lockfile, chromium con `--with-deps`,
  `supabase/setup-cli@v1` + `start` + `db reset`, credenciales del stack
  efímero leídas con `supabase status -o json` + `jq`,
  `playwright test --project=chromium`, reporte y screenshots como artefacto
  SOLO `if: failure()` con 14 días, y `supabase stop` con `if: always()`.

`packageManager: "npm@11.6.2"` en `package.json`, coincidiendo con el pin del
workflow. Triggers `pull_request` + `push` a main + `workflow_dispatch`,
`concurrency` con `cancel-in-progress` y `permissions: contents: read`.

**Problema real: la primera corrida murió en 38 segundos.** El `type-check` de
la raíz arrastraba `mcp/tsup.config.ts` —116 archivos de `mcp/` entraban al
programa de TypeScript— y en el runner falla con `Cannot find module 'tsup'`,
porque `mcp/node_modules` todavía no está instalado en ese paso. En local
pasaba solo por accidente: esas dependencias ya estaban en disco. **Solución:**
excluir `mcp` del `tsconfig.json` de la raíz, que es lo que decía la
arquitectura desde la sesión 5 — `mcp/` es un proyecto Node aparte con su
propio type-check, y el CI lo ejecuta en su carpeta.

**Evidencia en la pestaña Actions:**

| Corrida | Disparador | Resultado | Duración |
|---|---|---|---|
| CI #1 (`28ad785`) | push a main | ❌ `type-check` con `Cannot find module 'tsup'` | 38 s |
| CI #2 (`7e5a1b1`) | push a main | ✅ Success · `checks` 43 s + `e2e` 4 m 02 s · `2 skipped, 12 passed (44.0s)` · artefacto `coverage` 125 KB | 4 m 53 s |
| CI #3 (`e49f6ee`) | push a main | ✅ | 4 m 17 s |
| CI #4 (PR #1 abierto) | pull_request | ✅ | 4 m 11 s |
| CI #6 (PR #1, test roto) | pull_request | ❌ `Lint, tipos y tests unitarios failed in 41s`; `e2e` ni se lanzó (`needs: checks`) | 52 s |
| CI #7 (PR #1, revert) | pull_request | ✅ Success · `checks succeeded in 44s` + `e2e` | 4 m 35 s |

El ciclo del PR de prueba se hizo en la rama `ci-smoke` (PR #1): cambio
trivial → verde → commit que rompe `lib/validators/auth.test.ts` a propósito →
rojo → `git revert` → verde. **Sin merge.**

## Fase 6.8 — Debugging y gates (commit `e49f6ee`)

`docs/DEBUGGING.md`: el flujo síntoma → reproducir (un test que falla es la
mejor reproducción) → leer los logs de verdad (terminal de `next dev`,
consola, pestaña Network, `supabase logs`, Studio, y cómo leer un fallo de CI:
qué job, qué artefacto descargar, cómo abrir el reporte de Playwright) →
hipótesis única → fix → test verde. Más la guía de qué contexto darle a Claude
para pedirle debugging (síntoma, pasos, log LITERAL, qué se descartó, y qué NO
tocar), y 14 errores típicos con el mensaje literal como título, su causa y el
primer comando. La tabla de síntomas de IA se enlaza a `docs/RAG.md`, no se
duplica.

La Skill `mercadotech-automatic-validator` pasó de marcar `npm run test` como
`N/A (sesión 6)` a exigirlo: **un test rojo = VALIDACIÓN FALLIDA**. Y
`npm run test:e2e` entra como condicional a que `supabase status` esté verde.
Edición quirúrgica: solo ese ítem del checklist.

**Gate demostrado.** Con `lib/utils.test.ts:33` roto a propósito, el validator
devolvió **VALIDACIÓN FALLIDA** citando la aserción literal
(`expected 'S/ 219.00' to be 'S/ 999.99'`) con todo lo demás en verde;
revertido, **VALIDACIÓN APROBADA** con 293 unitarios y 12 E2E.

## Números finales

| Métrica | Valor |
|---|---|
| Tests unitarios | **293**, en 17 archivos, **3.05 s** |
| Tests E2E | **14** (12 pasan, 2 en `fixme` por el hallazgo del kanban), **2.3 min** en local |
| Cobertura validators + context-builder | **100 %** de ramas (63/63) |
| Cobertura `services/` | **89.89 %** de líneas (meta: 80 %) |
| Job `checks` en CI | 43–44 s |
| Job `e2e` en CI | 4 m 02 s |
| Corrida completa de CI | 4 m 11 s – 4 m 53 s |

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| `npm run test` verde con Docker APAGADO, con la cobertura objetivo | ✅ | `supabase stop`, puerto 54321 cerrado, 0 contenedores → 293/293. Validators 100 % ramas, services 89.89 % líneas |
| `npm run test:e2e` verde contra Supabase local con el seed | ✅ | tras `db reset`: 12 passed, 2 skipped (2.3 min) |
| El kanban cubierto por E2E vía teclado | ❌ | **Bloqueado por el hallazgo de accesibilidad.** Los specs están escritos y en `test.fixme`; la regla de transición sí está cubierta sin navegador |
| Un push y un PR muestran ambos jobs verdes; un test roto los pone en rojo | ✅ | CI #2 y #3 (push), #4 y #7 (PR) verdes; #6 rojo con el test roto |
| La Skill validator ejecuta los tests como parte del gate | ✅ | FALLIDA con el test roto, APROBADA tras revertir |
| `npm run lint`, `npm run type-check` y `npm run build` pasan | ✅ | los tres en verde en local y en CI |

## Qué quedó fuera, a propósito

* **Tests de componentes React** (decisión 6): no se instalaron jsdom ni
  Testing Library. Se instala solo lo que se usa.
* **Tests del servidor MCP**: solo su `type-check` entra al CI.
* **Protección de rama** (checks obligatorios para hacer merge): sesión 7.
* **Despliegue**: sesión 7.
* **Cualquier aserción sobre respuestas de IA** (decisión 8): sin token en CI,
  el error controlado inline es comportamiento válido, y afirmar texto
  generado por un modelo haría la suite intermitente por diseño.
* Los services `category`, `indexing-trigger` y `ticket` quedan sin tests: no
  están en la tabla de la spec y son de 10–20 líneas.

## Pendientes para la sesión 7

1. **Corregir el kanban por teclado**: pasar un `coordinateGetter` a
   `KeyboardSensor` en `OrdersKanban.tsx`, borrar el test que documenta el
   defecto y quitar los dos `test.fixme`. Es una línea de producción y
   devuelve la accesibilidad del drag más frágil del proyecto.
2. **Protección de rama** en GitHub: exigir `checks` y `e2e` en verde para
   poder hacer merge a `main`. Hoy el portero avisa pero no bloquea.
3. **Decidir sobre los dos "comportamiento actual, revisar"** de la 6.3:
   `addItem` con stock 0 y `validateTransition` con `cancelado → cancelado`.
4. **Visibilidad del repositorio**: quedó **Public**; la spec pedía Private
   por ser material de curso.
5. Cerrar el PR #1 y borrar la rama `ci-smoke` cuando ya no haga falta la
   evidencia.

---

# Sesión 5 — Custom Skills y protocolo MCP (2026-08-28)

MercadoTech no gana ninguna pantalla en esta sesión. Gana **dos cosas para las
máquinas que trabajan con la tienda**: cuatro Skills que hacen cumplir la
arquitectura del proyecto dentro de Claude Code, y un servidor MCP que expone
la plataforma en solo lectura a cualquier cliente del protocolo, reutilizando
los services de las sesiones 3 y 4 sin duplicar una línea de negocio.

**Volumen:** `git diff --stat 3e8e9b5..HEAD` → 47 archivos, +6 239 / −119.

## Prompt 0 — Verificación y dependencias (commits `601dfba`, `5b0f794`)

Repo verde de partida: `lint`, `type-check` y `build` en exit 0, stack local
arriba y `knowledge_embeddings` con sus 24 fichas. `mcp/` nace con su propio
`package.json` y las versiones **pineadas** que exige la lección 4 de la spec:
`@modelcontextprotocol/sdk ^1.29.0` (resolvió a 1.30.0), `zod ^3.25.76` y
`tsup ^8.5.1` — el SDK 1.x no es compatible con zod 4.

Desviación menor del estado de partida: `.claude/skills/` **ya existía** con
skills personales del usuario (no del proyecto). Las cuatro de gobernanza se
agregaron junto a ellas; solo las del proyecto se commitearon.

Hallazgo del Inspector: además de la UI web, tiene modo `--cli`. Toda la
verificación de la sesión quedó así reproducible en comandos, no en capturas.

## Fase 5.1 — Skills de gobernanza (commit `c0441dc`)

Cuatro `SKILL.md` en `.claude/skills/`, commiteados desde el primer día
(lección 1: en ReadHub quedaron sin versionar y se perdieron del historial).
El riesgo real de esta fase era que se pisaran entre sí, así que cada una se
escribió contra el deslinde de las otras tres:

| Skill | Cuándo actúa | Salida | Qué NO hace |
|---|---|---|---|
| `mercadotech-architecture-enforcer` | ANTES de crear o mover un archivo | PERMITIDO / RECHAZADO + ubicación correcta | no juzga estilo ni naming |
| `mercadotech-code-reviewer` | DESPUÉS de escribir | informe /10 por severidad | no bloquea, no corre lint |
| `mercadotech-automatic-validator` | al cerrar una fase | APROBADA / FALLIDA | no explica, no pondera |
| `mercadotech-tech-lead` | ante decisiones de diseño | scorecard ponderado | no es binario, no va archivo por archivo |

Las cuatro dicen explícitamente que **reportan, no editan código**, y las
cuatro cierran con "ante contradicción, gana `CLAUDE.md`". Cada regla es
verificable con un grep o una lectura, nunca un principio abstracto.

**Decisión 9 de la spec, refutada en la práctica:** la spec daba por hecho que
hacía falta reiniciar la sesión para que Claude Code descubriera las Skills.
En esta ejecución el harness las detectó **en caliente**, una a una, según se
iban escribiendo, y el laboratorio de la 5.6 pudo correrse en la misma
conversación. Queda anotado como comportamiento observado, no como garantía:
si una Skill no se activa al nombrarla, reiniciar sigue siendo el remedio.

## Fase 5.2 — Scaffolding del servidor (commit `a67b829`)

El mostrador vacío pero conectando. Toda la fontanería delicada resuelta de
una vez, con `src/lib/{tool-result,errors,safe}.ts` y `src/context.ts`.

**Desviación deliberada de la spec, y es importante.** La spec pedía la
redirección de `console.log` *literalmente en la línea 1 de `index.ts`*. Eso
**no funciona en ESM**: los `import` se hoistean y se evalúan antes que
cualquier sentencia del cuerpo del módulo, así que una dependencia que loguee
al importarse ya habría corrompido stdout. Se resolvió con
`src/lib/stdout-guard.ts` importado como **primer módulo** — los imports sí se
evalúan en orden. Cumple la intención de la lección 3; el porqué quedó escrito
en el propio archivo.

Se reutilizó tal cual el patrón de `scripts/index-all.ts` para el entorno
(`loadEnvLocal` sobre la `.env.local` de la RAÍZ, una sola fuente de secretos)
y para el cliente admin propio: `lib/supabase/admin.ts` trae
`import "server-only"`, que lanza bajo Node/tsx puro.

Se agregó `mcp/scripts/rpc.mjs`, un cliente JSON-RPC mínimo que hace el
handshake y ejecuta métodos en orden. **Aborta si detecta que algo ensució
stdout**, así que la pureza del canal se verifica sola en cada corrida.

## Fase 5.3 — Diez tools (commits `70fb01a`, `b5bd3a4`)

Un archivo por tool, registro central en `tools/index.ts`, inputs con zod,
salidas por `tool-result` y todo envuelto en `safe.ts`. Cinco corren con
`anon` y cinco necesitan `admin`, cada una con el comentario de la política
RLS que lo obliga escrito al lado.

Las derivaciones viven en `mcp/src/shared/` y están declaradas como tales
(lección 6): `stats.ts` (categorías con conteo, agregados, top de vendidos),
`product-detail.ts` (la forma única de "detalle", compartida por la tool, el
resource y un prompt) y `faq.ts`. **Cero services nuevos en el proyecto web.**

### El problema real de la sesión: `service_role` no es acceso total

Al ejercitar las tools, cuatro fallaron con `42501 permission denied`. La
causa no estaba en el MCP sino en un supuesto equivocado del esquema:

> **Bypasear RLS no es lo mismo que tener privilegios de tabla.** `service_role`
> ignora las políticas, pero Postgres sigue exigiendo el `GRANT`.

Hasta la sesión 4 el único consumidor era la web, que corre como
`authenticated` — el rol al que el esquema sí le había dado todo. El servidor
MCP es el **primer consumidor del proyecto que corre como `service_role`**, y
por eso nadie lo había visto. `supabase/policies.sql` solo le concedía cuatro
tablas.

Arreglarlo exigía una migración, y la sesión 5 tenía prohibido tocar la base
de datos. Se planteó la disyuntiva y **se aprobó explícitamente la desviación**
antes de aplicarla: la migración
`20260828200750_grant_service_role_mcp_reads.sql` concede **solo SELECT** sobre
`orders`, `order_items`, `product_images`, `reviews` y `profiles`, más EXECUTE
sobre `match_knowledge`. Nada de escritura: el servidor es de solo lectura.
`product_images` y `reviews` ya eran públicas para anon, así que ahí solo se
alineó `service_role` con lo que cualquier visitante ya podía leer; `profiles`
no es pública y se concede exclusivamente para el resource de vendedores, que
proyecta `display_name` y nada más.

Efecto colateral del `db reset`: se vacían `knowledge_embeddings` y los
archivos de Storage. Hubo que volver a correr `npx tsx scripts/index-all.ts` y
`npm run db:images`.

### Otras desviaciones, por el esquema real

La spec asumía columnas que **no existen**: `products.model`, `products.specs`
y `reviews.title`. Las tools se ajustaron a los campos reales (la ficha técnica
vive dentro de `description`), con el porqué comentado en el código.

## Fase 5.4 — Siete resources y cinco Prompts MCP (commit `832283c`)

Los dos templates (`products/{id}`, `sellers/{sellerId}`) implementan el
callback `list`, así que sus instancias reales aparecen en `resources/list`:
12 productos y 2 vendedores además de los 5 estáticos.

La prueba que más valía la pena: **con `supabase stop`, `resources/list` sigue
respondiendo**. `info` entrega su contenido completo (es estático a propósito,
justamente para eso) y cada resource caído devuelve su error capturado en
lugar de tumbar el listado entero (lección 7).

Los cinco prompts son **formularios, no motores**: obtienen el contenido por
las mismas funciones compartidas de la 5.3 y remiten a las tools existentes
para profundizar. Ninguno reimplementa recuperación ni el pipeline RAG. La
terminología se cuidó en código y documentación (lección 2): son "Prompts
MCP", nunca "Skills".

## Fase 5.5 — Registro y documentación (commit `791c4a7`)

`.mcp.json` en la raíz y `mcp/README.md` completo: arquitectura, las 10
decisiones con su porqué, las tablas de tools/resources/prompts con su service
reutilizado y su cliente, y la tabla de síntomas.

El build de producción se validó de verdad: `node mcp/dist/index.js` responde
idéntico al fuente (`rpc.mjs` acepta `MCP_TARGET=dist` para ejercitarlo).

**Verificación con el Inspector, con una salvedad honesta:** el Inspector se
usó en modo `--cli`, no con su interfaz web. Toda la evidencia de esta sesión
salió de JSON-RPC sobre stdio — misma superficie que ejercita la UI, y con la
ventaja de quedar reproducible en un comando.

## Fase 5.6 — Laboratorio de validación (commits `965a5b0`, `648bed0`, `804ba88`, `31fb253`)

Las Skills auditando el código real. Detalle completo en
[`docs/REVISION_S5.md`](REVISION_S5.md).

**11 hallazgos: 5 corregidos, 5 aceptados como deuda con su justificación, 1
falso positivo refutado.** Los tres corregidos en esta fase, de menor a mayor
riesgo:

1. **ESLint analizaba `mcp/dist/`**, el bundle de tsup: 59 errores de código
   generado. La primera pasada del validator dio **FALLIDA** por esto, se
   corrigió y se re-invocó — el ciclo funcionando como debe.
2. **Los cuatro greps de arquitectura de `CLAUDE.md` daban falsos positivos**:
   matcheaban los *comentarios* que explican por qué un archivo NO importa
   algo. Anclados a `^import`. Un gate con falsos positivos deja de leerse.
3. **Los tres Route Handlers perdían el diagnóstico de todo error de
   Supabase.** `err instanceof Error` es **false** para un PostgrestError
   (objeto plano `{message, code, details, hint}`) y los services lo relanzan
   tal cual: cualquier fallo de base de datos llegaba al usuario como "Error
   desconocido…". El servidor MCP se golpeó con lo mismo primero; la revisión
   lo encontró arrastrado desde la sesión 4. Ahora `lib/api-response.ts` expone
   `errorMessage()` y conserva hasta la sugerencia literal de Postgres.

Scorecard del tech-lead: **8.45/10**. Code review: **8.5/10**.

Vale la pena dejarlo escrito: **la arquitectura pasó su prueba de fuego sin
saberlo.** Un consumidor completamente nuevo, fuera de Next, se conectó a los
15 services sin reescribir una línea de negocio. Eso solo funciona porque la
sesión 3 decidió que el cliente Supabase fuera inyectable y siempre el último
parámetro.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| El Inspector lista y ejecuta las 10 tools sin errores con datos del seed | ✅ | Modo `--cli` + `rpc.mjs`. `search_products {"search":"laptop"}` → 3 productos; `compare_products` con las 2 laptops → rango S/1899–2199; `get_order_status c0000000-…01` → entregado con 2 ítems snapshot |
| `ask_assistant` con la misma calidad que la UI web | ✅ | `{"query":"¿cómo devuelvo un producto?","mode":"soporte"}` → cita `[1]`, el artículo de devoluciones, con los 7 días calendario correctos |
| Con Supabase detenido, `resources/list` sigue respondiendo | ✅ | `info` completo; `faq` con su error capturado; el listado nunca se cae |
| Ninguna tool/resource expone teléfono, email ni nombre de comprador | ✅ | Revisión manual de salidas + ítem B1 del validator. Salidas proyectadas campo por campo, nunca la fila completa |
| El validator termina en APROBADA sobre el estado final | ✅ | `docs/REVISION_S5.md`, sección final |
| `type-check` de la raíz Y de `mcp/`; el build de `mcp/` arranca | ✅ | Ambos exit 0; `node mcp/dist/index.js` conecta y responde |
| Búsqueda semántica de la misma calidad que la pestaña IA | ✅ | "audífonos para el gimnasio" → Logitech G435 primero (0.4211) |

## Deuda técnica y limitaciones conocidas

1. **`get_order_status` no exige autenticación.** Cualquiera con el id del
   pedido lo consulta. Aceptable porque el servidor corre local contra el seed
   del curso; **en producción no bastaría**. Está advertido en el código y en
   el README. La sesión 8 lo reutiliza para el agente de voz.
2. **`mercadotech://faq` es una derivación, no un service.** No existe un
   "listar FAQ publicada" en la web. Si nace una pantalla de FAQ, ese archivo
   debe pasar a llamar al service nuevo.
3. **`tool.handler as never`** en el registro central: único punto del servidor
   donde se apaga el compilador. Los tipos reales los garantiza cada archivo.
4. **`listAllActiveProducts` pagina en cliente** para calcular agregados.
   Trivial con 16 productos; a escala pide una vista SQL.
5. **Vulnerabilidad low en `esbuild`** (transitiva de `tsup`). `npm audit fix`
   movería la versión que la spec obliga a pinear.
6. **`useProductForm.ts` con 302 líneas** orquestando 4 services. Refactor
   propuesto para después de que existan tests.
7. **Heredada, y ahora la que más pesa:** sin tests automatizados. Esta sesión
   agregó ~1.500 líneas en `mcp/` verificadas solo a mano.

## Qué quedó fuera, a propósito

* **Monorepo** (npm workspaces + Turborepo, como ReadHub). La nota de la spec
  lo deja opcional: `mcp/` importando por alias es suficiente para el
  laboratorio, y el tech-lead no vio razón para pagar la complejidad hoy.
* **Tools de escritura.** El servidor es de solo lectura, sin excepciones.
* **Agente de voz** (sesión 8) y **tests automatizados** (sesión 6).
* **Vista `public_profiles`.** Resolvería la deuda de `profiles` para web y MCP
  a la vez, pero pertenece a la sesión 7.

## Pendientes

**Heredado de la sesión 1 (no ejecutada):** siguen sin existir
`docs/COSTOS.md` ni `docs/PROMPTS.md`. No bloquea nada.

**Para la sesión 6 (testing):** Vitest y Playwright. Prioridades que deja esta
sesión: cubrir `mcp/src/shared/` (las derivaciones son el código más frágil del
servidor, porque componen a mano), el nuevo `errorMessage()` de
`lib/api-response.ts`, y `useProductForm` antes de refactorizarlo.

---

# Sesión 4 — RAG con Hugging Face (2026-08-26)

MercadoTech gana búsqueda semántica y dos asistentes conversacionales
(compras y soporte) sobre la infraestructura de las sesiones 2-3: pgvector,
una tabla nueva de embeddings, indexación automática, y los primeros Route
Handlers del proyecto (`app/api/v1/`, vacíos a propósito desde la sesión 2).

**Volumen:** `git diff --shortstat ae43c50..HEAD` → 52 archivos,
+3 302 / −14.

## Prompt 0 — Verificación y provisión de IA (commit `9f5a394`)

**Construido:** verificación de la sesión 3 (todos los prerrequisitos ✅),
stack local reconstruido, `HUGGINGFACEHUB_API_TOKEN` en `.env.local`
(nunca commiteado; ver decisión abajo), `.env.example` con las 3 variables
de IA sin valores, `@huggingface/inference` y `tsx` instalados, smoke test
real contra la API (embedding de 384, completion coherente).

**Decisión — el token se reutilizó del proyecto ReadHub del mismo alumno**,
por instrucción explícita del usuario, en vez de generar uno nuevo (tarea
que la spec reserva al humano). Se copió únicamente la variable de Hugging
Face; las credenciales de Supabase del `.env.local` de MercadoTech
quedaron intactas (son de su propio stack local, no las de ReadHub).

**Problema — Docker Desktop no estaba corriendo.** Mismo síntoma que en la
sesión 3: se resolvió arrancándolo y con `supabase start`.

## Fase 4.1 — Infraestructura vectorial (commit `876a5a1`)

**Construido:** 4 migraciones nuevas — `enable_pgvector`,
`create_knowledge_embeddings` (tabla + índice HNSW `vector_cosine_ops`),
`create_match_knowledge` (RPC), `knowledge_embeddings_rls` — más
`schema.sql`/`policies.sql` actualizados y `types/database.ts` regenerado.

**Decisión — una tabla discriminada por `source_type`, no dos gemelas.**
Permite un solo RPC y una sola búsqueda para ambas fuentes (productos y
FAQ); el precio es que `source_id` no lleva FK dura (apunta a dos tablas
distintas), documentado en la propia migración: al borrar la fuente, la
ficha queda huérfana hasta que algo la limpie (Fase 4.3).

**Decisión — `match_knowledge` es `SECURITY INVOKER`, no `DEFINER`** (a
diferencia de `create_order_from_cart`, sesión 2). `create_order_from_cart`
necesita saltarse RLS porque `authenticated` no tiene INSERT directo en
`orders`; `match_knowledge` solo LEE `knowledge_embeddings`, y la política
de esa tabla (SELECT solo `authenticated`, decisión 1 de la spec: la IA
exige sesión) es exactamente el control de acceso que se quiere aplicar —
no hay nada que saltarse.

## Fase 4.2 — Capa de IA y servicio de embeddings (commit `505e66a`)

**Construido:** `lib/constants/ai.ts` (13 tunables comentados),
`lib/ai/embeddings.ts`, `lib/ai/completion.ts`, `lib/ai/prompts.ts`,
`services/embedding.service.ts`.

**Decisión — el modelo de chat se lee de `HUGGINGFACE_CHAT_MODEL`, con
`HUGGINGFACE_CHAT_MODEL_DEFAULT` como fallback en código.** Ambos
verificados contra la API real en el Prompt 0. Mismo patrón para el modelo
de embeddings.

**Decisión — embeddings vía SDK, chat vía `fetch`.** Hugging Face no
expone `feature-extraction` en su router OpenAI-compatible (documentado);
el router de chat sí es estable para `fetch` directo. Es el único archivo
del proyecto que usa un SDK en vez de `fetch`, justificado por el propio
proveedor, no por preferencia.

## Fase 4.3 — Indexación automática (commit `042bc32`)

**Construido:** `lib/api-response.ts`, `app/api/v1/reindex/route.ts`
(primer Route Handler del proyecto), `services/indexing-trigger.service.ts`
(fire-and-forget), `scripts/index-all.ts`, y `useProductForm`/
`useSellerProducts` ampliados para disparar el trigger tras crear, editar,
activar/ocultar o eliminar un producto.

**Problema — `service_role` no tenía GRANT sobre `products`,
`support_articles`, `categories` ni `knowledge_embeddings`.** Este proyecto
nunca otorga privilegios por default (sin `ALTER DEFAULT PRIVILEGES`); cada
rol recibe exactamente lo que sus políticas necesitan, tabla por tabla
(convención de la sesión 2). Hasta esta sesión ningún código usaba el
cliente admin contra tablas de dominio, así que el hueco nunca se
manifestó — apareció como `permission denied for table products` (42501)
al correr `index-all.ts`. Se agregó una migración nueva
(`grant_service_role_knowledge_access`) con los GRANTs exactos que faltaban.
Misma lección de la sesión 2: RLS/GRANT sin GRANT explícito = error opaco,
esta vez para el rol que bypasea RLS.

**Evidencia:** `npx tsx scripts/index-all.ts` → 14 productos + 10 artículos
= 24 fichas. Publicar un producto de prueba como `seller1` → fila 25;
editar su título → sigue en 25 (upsert, `content` actualizado); publicar
con el token renombrado → la publicación funciona igual, con
`console.warn` en la consola del navegador (best-effort real, no solo en
el papel); eliminar el producto → su ficha huérfana se limpia sola.

## Fase 4.4 — Búsqueda semántica en el catálogo (commit `6308949`)

**Construido:** `services/vector-search.service.ts`,
`app/api/v1/search/semantic/route.ts`, `hooks/useSemanticSearch.ts`,
pestaña "Resultados con IA" en `/buscar` (reutiliza `ProductGrid`/
`ProductCard` con un prop opcional `similarity` para el badge — sin
duplicar el card), y `getProductsByIds` nuevo en `product.service.ts` para
hidratar los resultados contra el catálogo ACTUAL.

**Evidencia (con sesión):** "audífonos para el gimnasio" → pestaña exacta
0 productos, pestaña IA lista Audífonos Logitech G435 primero (42% match).
"algo para conectar mi casa a internet" → aparece el router TP-Link.
Anónimo → pestaña IA muestra el aviso de login con
`redirectTo=%2Fbuscar%3Fq%3D...`; pestaña exacta sigue funcionando igual.
"autos usados" → `EmptyState` con sugerencia de reformular.

## Fase 4.5 — Constructor de contexto (commit `1132637`)

**Construido:** `lib/ai/context-builder.ts`, función pura (selección por
similitud/largo mínimo + presupuesto de caracteres con truncado-o-descarte).

**Evidencia:** demostración en frío con 8 fuentes sintéticas (sin red):
descarta correctamente las 2 bajo threshold y la de contenido mínimo,
trunca la fuente "gigante" para llenar exactamente el presupuesto, y un
caso adicional confirma el descarte completo (no un truncado a medias)
cuando el remanente es menor que `MIN_TRUNCATED_SOURCE_CHARS`. `grep`
confirma cero imports de `fetch`/Supabase/React.

## Fase 4.6 — Servicio conversacional y endpoint (commit `2fa6bfa`)

**Construido:** `types/chat.ts`, `services/chat.service.ts` (orquesta
búsqueda → contexto → completion, sin reimplementar ninguna), y
`app/api/v1/chat/route.ts` con el log estructurado por consulta.

**Decisión — `ChatSource` se enriquece con precio/imagen ACTUALES del
producto** (vía `getProductsByIds`, la misma hidratación de 4.4) para que
la mini-card de fuentes de la Fase 4.7 tenga algo que mostrar — el título
citado en la respuesta viene congelado del momento de la indexación, pero
precio e imagen no tiene sentido que lo estén.

**Evidencia:** 3 `curl` con cookie de sesión real — compras cita 5 fuentes
con respuesta coherente; soporte cita el artículo de devoluciones exacto;
"¿venden autos usados?" ya mostraba la primera señal del problema de
calibración que se resolvió en la 4.8. 401 sin cookie, 422 con `mode`
inválido, logs estructurados con el formato exacto de la spec.

## Fase 4.7 — Interfaz del asistente (commit `5ffdc2c`)

**Construido:** `hooks/useChat.ts`, `services/ticket.service.ts`
(`listMine`) + `hooks/useMyTickets.ts`, `components/chat/*` (puros: solo
props, sin conocer el endpoint ni `lib/ai/`), `TicketStatusBadge`, páginas
`/asistente` y `/soporte` (+ "Mis tickets"), `UserMenu`/`MobileNav` y el
middleware ampliados con los dos prefijos nuevos.

**Evidencia:** flujo completo en el navegador — "laptop liviana para la
universidad" en `/asistente` cita 2 productos reales, clic en una fuente
abre el producto correcto; "¿cómo devuelvo un producto?" en `/soporte` cita
el artículo correcto; "¿venden autos usados?" en modo soporte sugiere crear
un ticket; `buyer1` y `buyer3` ven cada uno sus propios tickets del seed;
anónimo en `/asistente` → `/login?redirectTo=%2Fasistente`; servidor sin
token → mensaje de error inline ("No pude procesar tu consulta, intenta de
nuevo"), resto de la app sin afectar. `npm run build` de producción pasa.

## Fase 4.8 — Calibración, observabilidad y casos de prueba (commit `d960477`)

**Construido:** `docs/RAG.md` con los 6 casos ejecutados y su evidencia, la
tabla de calibración, y la tabla de síntomas ampliada.

**Decisión — threshold 0.3 → 0.38, con datos reales.** Con 0.3, las 10
consultas de calibración (los 6 casos + 2 legítimas + 2 absurdas)
recuperaban ficha "relevante" sin excepción — el piso de ruido del modelo
de embeddings en español ronda 0.3-0.35, no 0.1-0.2 como asumía el
comentario original. 0.38 corta las consultas absurdas de tipo `producto`
sin romper el caso canónico "audífonos para el gimnasio" (su mejor match,
0.421, sigue arriba). **Limitación documentada, no resuelta:** el modo
`soporte` sigue dejando pasar ruido (los artículos de FAQ comparten
vocabulario y su similitud de base es más alta) — subir lo suficiente para
filtrarlo rompería el caso canónico de `producto`. Mitigado en la práctica
porque `SUPPORT_SYSTEM_INSTRUCTIONS` ya le pide al modelo admitir cuando el
contexto no sirve, y lo cumple.

**Problema — cuota mensual de Hugging Face agotada a mitad de la
calibración** (HTTP 402 del proveedor de *chat*, cuota separada de la de
embeddings). No es una falla del código: `lib/ai/completion.ts` ya lo
reporta con un mensaje accionable. La calibración de similitud se completó
igual consultando `match_knowledge` directamente (solo embeddings, cuota
intacta) en vez de `/api/v1/chat` — no afecta la validez de los datos, es
justo la pieza que el threshold gobierna.

---

## Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| Los 6 casos de prueba pasan y quedan documentados | ✅ | `docs/RAG.md` |
| Sin token, el resto de la app funciona y el chat/búsqueda IA fallan con error controlado | ✅ | Fase 4.7: mensaje inline, resto de la app intacto |
| Anónimo: catálogo y búsqueda exacta intactos; IA pide sesión | ✅ | Fases 4.4 y 4.7 |
| `grep "@huggingface"` fuera de `lib/ai/` → vacío | ✅ | verificado en 4.2 |
| `grep "lib/supabase/admin"` fuera de Route Handlers/`scripts/` → vacío | ✅ | verificado en 4.3 |
| `lint` / `type-check` / `build` | ✅ | los tres exit 0, build de producción completo |

## Deuda técnica y limitaciones conocidas

1. **Threshold único para ambas fuentes.** `producto` y `articulo_soporte`
   tienen distribuciones de similitud distintas (la FAQ comparte más
   vocabulario); un solo `VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD`
   global no puede optimizar ambas a la vez. Ver `docs/RAG.md`,
   "Calibración".
2. **`source_id` sin FK dura** en `knowledge_embeddings` (decisión de
   diseño, no un olvido) — fichas huérfanas posibles, limpiadas por el
   trigger best-effort y descartadas al hidratar, nunca por integridad
   referencial de Postgres.
3. **Sin streaming.** El chat espera la respuesta completa; no está en el
   alcance de la sesión.
4. **Crear tickets desde el chat no existe todavía.** `ticket.service.ts`
   solo lista (`listMine`); llega con el agente de la sesión 8.
5. **Historial de chat solo en memoria.** No persiste entre recargas ni
   entre pestañas (decisión de alcance de la spec).
6. **Heredada de la sesión 3:** sin tests automatizados de frontend
   (Vitest/Playwright llegan en la sesión 6).

## Pendientes

**Heredado de la sesión 1 (no ejecutada):** siguen sin existir
`docs/COSTOS.md` ni `docs/PROMPTS.md`. No bloquea nada.

**Sesión 2 (Fases 2.6/2.7):** ya estaban completas desde la sesión 3
(commits `feccd12` y `fb419eb`) — no quedaba nada pendiente ahí.

**Para la sesión 5:** ver `MercadoTech_sesion5.md`. Esta bitácora no
adelanta su contenido.

---

# Sesión 3 — UI Inteligente y Frontend Multimodal (2026-08-24)

MVP funcional completo del marketplace sobre la infraestructura de la sesión 2:
14 rutas, autenticación con roles, catálogo con filtros, ficha de producto con
Q&A y reseñas, carrito con checkout simulado y panel del vendedor con dos
interacciones drag & drop.

**Volumen:** `git diff --stat fb419eb..HEAD` → 131 archivos, +13 739 / −475.

## Prompt 0 — Provisión del entorno (commit `5b9f08d`)

**Construido:** stack Supabase local operativo, `.env.local` verificado contra
`supabase status -o env`, 16 componentes shadcn, `lucide-react` + `@dnd-kit/*`,
script `db:types`.

**Problema 1:** Docker Desktop no estaba corriendo y, al arrancarlo, el stack
quedó a medias (9 servicios sanos, `edge_runtime` en `Exited (255)`). Se
resolvió con `supabase stop` → `supabase start`, que es la limpieza que la
propia spec anticipaba.

**Problema 2:** `shadcn add` terminó en ✔ pero **no instaló los peers** del
estilo `base-nova`: dejó un `node_modules/@base-ui` vacío y `type-check`
fallaba con 14 errores `TS2307`. Se instalaron a mano `@base-ui/react` y
`class-variance-authority`.

**Problema 3:** `npm run lint` daba 154 errores provenientes de
`supabase/.temp/start-secrets/…`, un bundle minificado que genera el CLI. Está
en `.gitignore`, pero ESLint 9 flat config no lo lee; se añadió
`supabase/.temp/**` a los `ignores`.

**Fuera de alcance:** actualizar el CLI de Supabase (2.111 → 2.115) y las 3
vulnerabilidades high de `postcss`/`sharp`, transitivas de `next@15.5.23`,
cuyo arreglo exige Next 16 (breaking).

## Fase 3.1 — Tipos, sistema visual y componentes base (commit `33b1654`)

**Construido:** `types/database.ts` generado + 5 archivos de tipos de dominio,
tokens de tema claro/oscuro, `images.remotePatterns`, `formatPrice`, y los 8
componentes de `components/shared/`.

**Decisión — la paleta salió del mockup, no de la imaginación.** El PDF
`diseño_visual_platform.pdf` es un mockup rasterizado (2 páginas, sin texto
extraíble). Se extrajeron sus 19 imágenes embebidas y se **muestrearon los
colores por píxel**: primario `#1868E8`, navy de cabecera `#081838`, verde de
envío `#0FA06B`, óxido de descuento `#B04820`, fondo `#F8F8F9`. Convertidos a
OKLCH, que es el espacio que ya usaban los tokens de shadcn.

**Decisión — la spec manda en contenido, el mockup en forma.** El mockup está
marcado como "NODO." y usa `$` con dirección de CDMX. Se conservó la marca
*MercadoTech* y la moneda `S/` con `es-PE`, que es lo que fija la spec; del
mockup se tomaron disposición y color.

**Problema 1 — todo el sitio renderizaba en Times New Roman.** `@theme inline`
traía `--font-sans: var(--font-sans)`, una autorreferencia cíclica que
invalida la variable; además `layout.tsx` define `--font-geist-sans` sobre
`<body>` mientras la fuente se aplicaba en `<html>`. Se apuntó la variable a
la real y se movió `font-sans` a `body`.

**Problema 2 — contraste por debajo de AA.** El verde del mockup es *texto*
verde sobre blanco; usado como relleno de badge con texto blanco daba 3.22:1
(AA exige 4.5:1 a 12 px). Se oscureció `--success` de L .624 a .530 → 4.61:1,
y `--muted-foreground` de L .551 a .530 → 4.73:1 sobre `--muted`.

**Problema 3 — `ConditionBadge` se quedaba anclado al color del tema
anterior.** Aislado por búsqueda binaria sobre las 31 clases del `Badge`: el
culpable es `transition-all`, que al animar un `background-color` derivado de
una variable CSS deja el valor computado congelado en Chrome. Se añadió
`transition-none` en el componente propio, sin tocar `components/ui/badge.tsx`.

**Fuera de alcance:** estrellas en ámbar — el mockup muestra la calificación en
el azul de marca y se respetó.

## Fase 3.2 — Layouts, navegación y mapa de rutas (commit `27ee27b`)

**Construido:** layout raíz real (`lang="es"`, metadata, `<Toaster />`), los
tres layouts de grupo, 9 componentes de `components/layout/` y las 14 rutas
del mapa como placeholders.

**Decisión — navbar de tres pisos**, como el mockup: banda navy fina
(decorativa), barra blanca con marca + buscador ancho + cuenta/carrito, y fila
de categorías. La banda usa un par de tokens propio (`--band` /
`--band-foreground`) en vez de un color literal.

**Decisión — `components/layout/Brand.tsx`**, que no estaba en la tabla de la
spec: el wordmark aparece en tres sitios (navbar, cabecera del vendedor,
layout de auth) y triplicar el marcado garantizaba desincronización.

**Problema:** tras borrar `app/page.tsx` (colisionaba con `(shop)/page.tsx` en
`/`), `type-check` falló por un `.next/types/validator.ts` obsoleto. Se
resolvió con `rm -rf .next`.

**Fuera de alcance:** "Soporte" no aparece en el menú; su ruta llega en la
sesión 4.

## Fase 3.3 — Autenticación (commit `3d25934`)

**Construido:** migración `20260824194558_handle_new_user_metadata.sql`,
`lib/validators/auth.ts`, `services/auth.service.ts`, `hooks/useAuth.ts`,
`LoginForm`/`RegisterForm`, `/login` y `/register`, y el guard de sesión en
`lib/supabase/middleware.ts`.

**Decisión — el rol se fija en el trigger de alta.** Sin la migración,
registrarse como vendedor era imposible: `handle_new_user` omitía `role` (caía
al default `buyer`) y corregirlo después con un `UPDATE` lo bloquea
`protect_profile_role`. El único instante posible es el `INSERT` del trigger,
que corre `SECURITY DEFINER`. El `role` se filtra con lista blanca de dos
valores: `'admin'` manipulado degrada a `buyer`, verificado contra la API.

**Decisión — `/producto` NO se protege.** El detalle es público por spec;
protegerlo expulsaría a `/login` a quien llega desde un enlace compartido y
contradiría las políticas RLS, que ya permiten leer productos activos de forma
anónima.

**Problema:** el guard de rol del panel parpadeaba antes de cargar el profile
→ se muestra `LoadingState` mientras `initializing` es true, y solo entonces
se decide.

**Fuera de alcance:** confirmación de correo (en local `enable_confirmations =
false`; el código contempla el caso `session === null`) y recuperación de
contraseña.

## Fase 3.4 — Catálogo de productos (commit `637d521`)

**Construido:** `lib/constants/catalog.ts`, tres services
(`storage`, `category`, `product`), `useCategories` y `useProducts`, cuatro
componentes de `components/catalog/` y las páginas `/`, `/categoria/[slug]` y
`/buscar`.

**Decisión — filtros en la URL.** El estado se puede compartir por enlace,
sobrevive a F5 y el botón atrás deshace un filtro en vez de sacarte del
catálogo.

**Decisión — `categories!inner` en el select.** `category_id` es NOT NULL, así
que el inner join nunca descarta filas y permite filtrar por slug en la MISMA
consulta, sin un viaje extra para resolver slug → id.

**Problema 1 — el rango de precio borraba los demás filtros.** `commitPrice`
llamaba a `onChange` dos veces seguidas y ambas partían del mismo snapshot de
`searchParams`: el segundo `router.push` pisaba al primero. Se cambió el
contrato de `setFilter(clave, valor)` a **`setFilters(parcial)`**, que escribe
todo en una sola pasada. Solo apareció al teclear con teclado real.

**Problema 2 — violación de capas.** `CatalogView` importaba `useProducts`.
Ahora es puro y cada página conecta el hook; el tipo `CatalogFilters` se movió
de `hooks/useProducts` a `lib/constants/catalog.ts`.

**Problema 3 — tres errores de Base UI en consola**, heredados de 3.2/3.3:
`Button`/`SheetClose`/`DropdownMenuItem` renderizando `<a>` sin
`nativeButton={false}`, y una excepción no capturada
(`MenuGroupContext is missing`) por un `DropdownMenuLabel` fuera de
`DropdownMenuGroup`.

**Fuera de alcance:** búsqueda semántica. El `ilike` sobre `title`/`brand` es
provisional y está marcado como tal en el código.

## Fase 3.5 — Detalle, preguntas, reseñas y favoritos (commit `781607d`)

**Construido:** `question`/`review`/`favorite` services, `registerView`, cinco
hooks, cinco componentes de `components/product/`, `/producto/[id]` y
`/favoritos`.

**Decisión — sin nombres de otros usuarios.** `profiles` solo es legible por
su dueño o un admin, así que las preguntas muestran "Usuario" y las reseñas
"Comprador verificado". Mostrar nombres exigiría una vista `public_profiles`
(migración nueva), fuera de alcance.

**Decisión — `canReview` es defensa en profundidad.** La RLS ya cruza
`order_id` con un pedido `entregado` del comprador; el hook comprueba lo mismo
antes para no ofrecer un formulario que va a fallar.

**Fuera de alcance:** el botón "Agregar al carrito" quedó cableado a un
callback provisional, que la 3.6 sustituyó.

## Fase 3.6 — Carrito, checkout simulado y pedidos (commit `12270c6`)

**Construido:** `lib/constants/orders.ts`, `cart` y `order` services, `useCart`
y `useOrders`, componentes de `components/cart/` y `components/orders/`, y las
páginas `/carrito`, `/pedidos` y `/pedidos/[id]`.

**Decisión — el carrito no guarda precios.** Guarda producto + cantidad; el
precio que vale es el actual, y solo se congela como snapshot dentro del RPC.
Así nadie "reserva" un precio viejo dejando el carrito abierto.

**Decisión — el error del RPC se propaga tal cual.** El mensaje de Postgres ya
nombra el producto que falló (`Stock insuficiente para "X": disponible 0,
solicitado 1`, verificado); reescribirlo perdería esa información.

**Problema — el contador del navbar no se actualizaba al agregar.** Cada
`useCart()` creaba su propio estado, así que el layout no se enteraba de lo
que hacía la ficha de producto. Se convirtió `useCart` en un store a nivel de
módulo con `useSyncExternalStore`: mismo API del hook, todos los consumidores
sincronizados, sin envolver la app en un provider.

**Fuera de alcance (decisión 11):** cancelar un pedido **no repone stock** — no
hay trigger para ello. El diálogo de confirmación lo advierte.

## Fase 3.7 — Panel del vendedor con drag & drop (commit `85b9fe3`)

**Construido:** `lib/constants/product.ts`, `lib/validators/product.ts`,
`seller.service`, ampliación de `storage.service`, tres hooks, seis
componentes de `components/seller/` y las cuatro páginas del panel.

**Decisión — alta en dos pasos (decisión 12).** El path de Storage incluye el
`product_id`, así que en modo alta no se puede subir nada antes de crear el
producto: el reorden es local (`URL.createObjectURL`) y todo se sube tras el
`createProduct`. En modo edición cada cambio se persiste al momento.

**Decisión — las transiciones del kanban viven en el hook.** La RLS permite al
vendedor poner `pagado`/`enviado`/`entregado` pero **no valida el orden**
(aceptaría `entregado → pagado`). `useSellerOrders` rechaza cualquier salto
que no sea un paso adelante en `ORDER_STATUS_FLOW`.

**Decisión — la columna "Cancelado" es de solo lectura.** La RLS no deja al
vendedor cancelar; sus tarjetas no se arrastran y la columna no acepta drops.

**Problema — violación de capas.** `OrdersKanban` y `OrderKanbanCard`
importaban el tipo `SellerOrder` desde `services/`. Se movió a
`types/order.ts`.

**Fuera de alcance:** en un pedido multi-vendedor, mover la tarjeta cambia el
estado del pedido COMPLETO, porque el estado vive en `orders` y no en
`order_items`. Resolverlo exige cambio de esquema. Está comentado en el
service.

### Imágenes de muestra (mismo commit)

El seed crea las 35 filas de `product_images` pero **no los archivos**, así que
el catálogo se veía entero con placeholders. Se añadió
`scripts/seed-images.mjs` (`npm run db:images`), que descarga imágenes de
**Lorem Picsum** —fotos de Unsplash bajo licencia que permite este uso— y las
sube a Storage. Son fotos genéricas, no del producto real: las fotos de
producto de una tienda están protegidas por copyright.

Dos tropiezos: `service_role` no tiene GRANT de `SELECT` sobre
`public.product_images` (los GRANTs de la 2.3 son para anon/authenticated), así
que las rutas se leen de un manifiesto generado con psql en vez de por REST; y
picsum devuelve 404 si el `seed` lleva barras, incluso codificadas, por lo que
se usa un hash SHA-1 corto de la ruta (determinista: reejecutar da la misma
imagen).

## Fase 3.8 — Responsive, accesibilidad y estados (commit `c3a196a`)

**Construido:** `docs/SESION3_CHECKLIST.md` con la tabla por pantalla, las
mediciones de contraste y la evidencia de los dos greps de capas.

**Corregido para que los greps dieran vacío:** `useAuth` importaba
`lib/supabase/client` para suscribirse a `onAuthStateChange` → la suscripción
se movió a `auth.service.ts`, que ahora expone `onAuthStateChange(callback)`.

**Limpieza:** `app/dev/ui/page.tsx` eliminado; sin placeholders "Próximamente".

---

## Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| 14 rutas del mapa responden | ✅ | todas 200 (o 307 a `/login` si son protegidas) |
| Registro con elección de rol | ✅ | `profiles.role = 'seller'`; `'admin'` manipulado → `buyer` |
| Rutas protegidas sin parpadeo | ✅ | middleware devuelve 307 con `redirectTo` |
| Catálogo con datos reales | ✅ | 14 activos en 2 páginas; 12 cards con imagen real, 0 placeholders |
| Filtros compartibles por URL | ✅ | `?minPrice=500&maxPrice=1200&condition=nuevo` compone sin pisarse |
| Detalle con galería, Q&A y reseñas | ✅ | 3 miniaturas, 3 secciones, reseña solo si `canReview` |
| Carrito y checkout simulado | ✅ | pedido `pendiente` S/ 4 098, stock 8→7 y 5→4, carrito vacío, redirect a `/pedidos/[id]` |
| Error de stock con nombre del producto | ✅ | `Stock insuficiente para "Monitor Samsung Odyssey…": disponible 0, solicitado 1` |
| Panel del vendedor | ✅ | 8 productos (7 publicados + 1 oculto), kanban con 5 columnas |
| Dos drag & drop accesibles | ✅ | `KeyboardSensor` en galería y kanban, asas con `aria-label` |
| Separación de capas | ✅ | los dos greps devuelven vacío |
| `lint` / `type-check` / `build` | ✅ | los tres exit 0 |

## Deuda técnica y limitaciones conocidas

1. **No se pueden mostrar nombres de otros usuarios.** RLS restringe `profiles`
   a su dueño. Preguntas → "Usuario"; reseñas → "Comprador verificado".
   Requiere una vista `public_profiles`.
2. **Cancelar un pedido no repone stock.** No hay trigger. Advertido en la UI.
3. **Pedidos multi-vendedor:** el estado vive en `orders`, así que mover una
   tarjeta afecta al pedido completo aunque el vendedor solo vea sus ítems.
4. **Sin realtime.** El comprador ve los cambios de estado del vendedor al
   recargar.
5. **Búsqueda por `ilike`,** provisional hasta la búsqueda semántica.
6. **Vulnerabilidades transitivas** en `postcss` y `sharp` vía `next@15.5.23`;
   el arreglo exige Next 16.
7. **Sin tests automatizados de frontend.** Vitest y Playwright llegan en la
   sesión 6; toda la verificación de esta sesión fue manual e instrumentada.

## Pendientes

**Heredado de la sesión 1 (no ejecutada):** no existen `docs/COSTOS.md` ni
`docs/PROMPTS.md`. No bloquean nada.

**Sesión 2:** las fases 2.6 y 2.7 figuraban como pendientes en la spec, pero
**ya estaban hechas**: existen `supabase/tests/rls-validation.sql` y
`docs/ARQUITECTURA.md` (commits `feccd12` y `fb419eb`).

**Para la sesión 4:** asistente de soporte con RAG, ruta `/soporte` y su
entrada en el menú, pestaña de IA en `/buscar`, y los Route Handlers de
`app/api/v1/` que hasta ahora están vacíos a propósito.

---

# Sesión 2 — Base de datos, RLS y Storage

> Reconstruida a partir de commits; no hubo bitácora en su momento.

| Commit | Qué entregó |
|---|---|
| `fecd756` | Buckets `product-images` y `avatars` con sus políticas (Fase 2.4) |
| `cb96ae4` | `seed.sql`: 6 usuarios, 8 categorías, 16 productos, pedidos en los 5 estados (Fase 2.5) |
| `feccd12` | Batería de validación de RLS en `supabase/tests/` (Fase 2.6) |
| `fb419eb` | `docs/ARQUITECTURA.md` y actualización de CLAUDE.md (Fase 2.7) |
| `66622bd` | Corrección: `pgcrypto` cualificado por esquema en `seed.sql` y `search_path` fijado en las funciones de trigger |

Dejó 14 tablas con RLS, el RPC transaccional `create_order_from_cart` y los
clientes de Supabase (browser, server, middleware, admin) sobre los que se
apoyó toda la sesión 3.

---

# Sesión 1 — Fundamentos

No se ejecutó. No hay commits ni entregables (`docs/COSTOS.md`,
`docs/PROMPTS.md`) en el repositorio.
