# RAG de MercadoTech — cómo funciona y cómo probarlo

Este documento explica el sistema de búsqueda semántica y los dos asistentes
conversacionales de la sesión 4, con los 6 casos de prueba de la spec
ejecutados y su evidencia real, la calibración de los umbrales, y una tabla
de síntomas y diagnóstico. Está escrito para alguien que no programó esto:
cada caso trae los pasos exactos para repetirlo.

## Cómo funciona, en una analogía

MercadoTech tiene un bibliotecario. Hace tres cosas:

1. **Fichar (indexar).** Cada producto activo y cada artículo de la FAQ se
   convierte en una "ficha" de 384 números que resume su significado (un
   *embedding*, calculado por Hugging Face). Las fichas viven en
   `knowledge_embeddings`, una tabla de la misma base de datos de siempre.
   Esto pasa una vez con `npx tsx scripts/index-all.ts` y luego solo
   sola cada vez que un vendedor publica o edita un producto.
2. **Buscar por las fichas (recuperar).** Cuando alguien pregunta, la
   pregunta también se convierte en ficha, y Postgres (con la extensión
   `pgvector`) encuentra las fichas más *parecidas* — no las que comparten
   palabras, las que hablan de lo mismo.
3. **Responder solo con las fichas encontradas (generar).** Un modelo de
   lenguaje redacta la respuesta usando ÚNICAMENTE esas fichas, citándolas.
   Si ninguna ficha sirve, lo dice — nunca inventa.

Todo el flujo corre en el servidor (Route Handlers de `app/api/v1/`): el
token de Hugging Face nunca llega al navegador, y por eso los dos
asistentes y la búsqueda con IA exigen sesión iniciada.

## Cómo repetir cualquier caso de este documento

1. `supabase start` (stack local corriendo) y `npm run dev`.
2. `npx tsx scripts/index-all.ts` — debe imprimir `Productos indexados: 14/14`,
   `Artículos indexados: 10/10`, `Total fichas: 24`.
3. Inicia sesión con `buyer1@mercadotech.test` / `MercadoTech123!` (o
   `seller1@mercadotech.test` para el caso 1) — contraseña de laboratorio del
   seed.
4. Sigue los pasos de cada caso.

---

## Los 6 casos de prueba

### Caso 1 — Indexación automática

**Entrada:** con sesión de `seller1@mercadotech.test`, ir a
`/vendedor/publicar`, completar el formulario (título, marca, categoría,
condición, precio, stock, al menos 1 imagen) y publicar.

**Resultado esperado:** una fila nueva en `knowledge_embeddings`.

**Evidencia real** (ejecutado durante la Fase 4.3, con el catálogo aún en
24 fichas): se publicó "Producto de prueba Fase 4.3 - Auriculares Bluetooth"
→ `knowledge_embeddings` pasó de 24 a **25** filas, con
`content` = título + marca + categoría + condición + descripción del
producto recién creado. Se editó el título a "EDITADO - ..." → la tabla
**siguió en 25 filas** (upsert, no duplicado) y `content` reflejó el título
nuevo. Al eliminar el producto de prueba, su ficha huérfana se limpió sola
(`knowledge_embeddings` volvió a 24) — el mismo trigger best-effort cubre
alta, edición y baja.

**Estado: ✅ pasa.**

### Caso 2 — Recuperación semántica

**Entrada:** con sesión, en `/buscar`, escribir **"audífonos para el
gimnasio"** y abrir la pestaña "Resultados con IA".

**Resultado esperado:** productos de audio deportivo primero, aunque ningún
título diga "gimnasio".

**Evidencia real:**

| Pestaña | Resultado |
|---|---|
| Coincidencia exacta | **0 productos** — `ilike` no encuentra nada |
| Resultados con IA | **Audífonos Logitech G435 Gaming Inalámbricos** primero, 42% de coincidencia, seguido de Smartphone Xiaomi, Mochila Targus, Laptop ASUS y Teclado Logitech |

Esa diferencia (0 vs. resultados reales) ES la sesión 4.

**Estado: ✅ pasa.**

### Caso 3 — Respuesta contextual (compras)

**Entrada:** con sesión, en `/asistente`, preguntar **"laptop liviana para
la universidad"**.

**Resultado esperado:** respuesta que cita 2+ productos reales con links.

**Evidencia real (transcripción literal):**

> Te recomiendo el Laptop ASUS Vivobook 15 Intel Core i5 8GB 512GB SSD [1].
> Está diseñado para ser delgado y liviano, lo que lo hace perfecto para
> llevar a la universidad. Además, tiene un teclado numérico completo, lo
> que te facilitará tus tareas académicas.

Fuentes devueltas (5): Laptop ASUS Vivobook (sim. 0.577), Mochila Targus
(0.566), Laptop Lenovo IdeaPad (0.537), SSD Western Digital (0.470),
Audífonos Logitech (0.371). Se hizo clic en la fuente "Laptop ASUS
Vivobook" → abrió `/producto/b0000000-0000-0000-0000-000000000002`, la
página real de ese producto (precio S/ 1,899.00 coincide).

**Estado: ✅ pasa.**

### Caso 4 — Respuesta contextual (soporte)

**Entrada:** con sesión, en `/soporte`, preguntar **"¿cómo devuelvo un
producto?"**.

**Resultado esperado:** respuesta basada en el artículo de devoluciones,
citado.

**Evidencia real (transcripción literal):**

> Según el artículo [1], puedes solicitar la devolución de un producto
> dentro de los 7 días calendario posteriores a que el pedido pase a estado
> "entregado". Para iniciar la devolución, abre un ticket de soporte
> indicando el número de pedido, el producto y el motivo de la devolución.
> Los productos deben devolverse en las mismas condiciones en que fueron
> recibidos, sin señales de uso excesivo, con su empaque original y
> accesorios completos, salvo que la devolución se deba a un defecto de
> fábrica.

Fuente [1]: "¿Cómo solicito la devolución de un producto?" (similitud
0.689) — el artículo correcto del seed.

**Estado: ✅ pasa.**

### Caso 5 — Sin información

**Entrada:** con sesión, preguntar **"¿venden autos usados?"** en
`/asistente` (modo compras) y en `/soporte` (modo soporte).

**Resultado esperado:** admite que no hay resultados; en soporte, sugiere
crear un ticket.

**Evidencia real:**

- **Compras:** "No encontré productos que coincidan con tu búsqueda." (con
  el threshold provisional de 0.3; ver "Calibración" — con el threshold
  final de 0.38 esta consulta ya no recupera NINGUNA ficha, así que
  `hasRelevantContext` pasa a `false` correctamente).
- **Soporte** (transcripción literal):
  > Lo siento, pero la información proporcionada no incluye un artículo que
  > responda directamente a tu pregunta. Si estás interesado en vender o
  > comprar autos usados en MercadoTech, te recomendaría crear un ticket de
  > soporte para que un agente humano te pueda ayudar.

**Estado: ✅ pasa** (y mejora con la calibración, ver abajo).

### Caso 6 — Navegación desde fuentes

**Entrada:** clic en una fuente citada por el asistente.

**Resultado esperado:** abre el producto/artículo correcto.

**Evidencia real:** ya documentada en el Caso 3 — el enlace de la fuente
"Laptop ASUS Vivobook" apuntaba a
`/producto/b0000000-0000-0000-0000-000000000002` y esa página cargó el
producto correcto (mismo título, mismo precio).

**Estado: ✅ pasa.**

---

## Calibración

### Datos: similitud de match_knowledge sin filtrar (threshold 0.0)

Para calibrar con datos reales (y sin gastar más cuota de completions, ver
"Problemas encontrados" abajo), se consultó `match_knowledge` directamente
para 10 consultas — las de los 6 casos, 2 legítimas adicionales y 2
absurdas — con el threshold en 0 para ver la distribución completa antes de
filtrar:

| Consulta | Modo | Mejor similitud | 2da | 3ra |
|---|---|---|---|---|
| "laptop liviana para la universidad" | compras | 0.577 | 0.566 | 0.537 |
| "audífonos para el gimnasio" | compras | **0.421** | 0.377 | 0.374 |
| "algo para conectar mi casa a internet" | compras | 0.475 | 0.447 | 0.412 |
| "monitor para gaming competitivo" | compras | 0.600 | 0.513 | 0.419 |
| "¿venden autos usados?" | compras | 0.354 | 0.334 | 0.332 |
| "¿cómo devuelvo un producto?" | soporte | 0.689 | 0.655 | 0.605 |
| "¿cuánto demora el envío?" | soporte | 0.607 | 0.563 | 0.556 |
| "¿venden autos usados?" | soporte | 0.447 | 0.437 | 0.432 |
| "cuéntame un chiste" | soporte | 0.431 | 0.299 | 0.295 |
| "recomiéndame una pizza para cenar" | compras | 0.322 | 0.242 | 0.230 |

### Decisión: threshold 0.3 → **0.38**

Con el 0.3 original, **todas** las 10 consultas —incluidas las 3 absurdas—
recuperaban al menos una ficha "relevante" (`hasRelevantContext: true`),
porque el piso de ruido del modelo de embeddings en español ronda 0.3-0.35,
no 0.1-0.2 como asumía el comentario original. Eso es ruido, no señal.

Subir a **0.38** corta las dos consultas absurdas de tipo `producto`
("autos usados" 0.354, "pizza" 0.322 — ambas quedan bajo el nuevo umbral)
**sin romper el caso canónico** "audífonos para el gimnasio" (su mejor
match, 0.421, sigue por encima). Verificado en vivo contra
`/api/v1/search/semantic` tras el cambio:

```
audífonos para el gimnasio → 1 resultado (0.421, Audífonos Logitech G435)
¿venden autos usados?      → 0 resultados
```

**Limitación conocida, documentada a propósito:** el ajuste NO resuelve el
ruido en modo `soporte`. Los artículos de la FAQ comparten mucho vocabulario
("MercadoTech", "producto", "pedido"), así que hasta preguntas sin relación
("cuéntame un chiste", 0.431; "autos usados", 0.447) superan 0.38 — de
hecho superan varios de los matches LEGÍTIMOS de `producto`. Subir el
threshold lo suficiente para filtrar esto (≥0.45) rompería "audífonos para
el gimnasio" (0.421 < 0.45), el caso de referencia de toda la sesión. Con un
único threshold global (no uno por `source_type`) no hay un valor que
resuelva ambos modos a la vez.

La razón por la que esto sigue siendo aceptable: `SUPPORT_SYSTEM_INSTRUCTIONS`
ya le exige al modelo admitir cuando el contexto no sirve, y en la práctica
lo cumple (Caso 5, transcripción real arriba) — el ruido llega al LLM, pero
no llega al usuario. Queda como deuda técnica para una futura sesión:
umbrales independientes por `source_type` en `lib/constants/ai.ts` y en la
firma de `searchByEmbedding`/`match_knowledge`.

## Problemas encontrados

**Cuota de Hugging Face agotada a mitad de la calibración.** Durante las
pruebas de esta fase, el proveedor de *chat completions* (no el de
embeddings — son cuotas separadas, lección 8 de la Guía HF) devolvió:

```
Error del proveedor de chat (HTTP 402): {"error":"You have depleted your
monthly included credits. Purchase pre-paid credits to continue using
Inference Providers..."}
```

Diagnóstico (tabla de síntomas abajo, fila "429/rate limit"): cuota
gratuita del mes agotada — el mismo síntoma que un 429, con código HTTP
distinto porque el proveedor de este modelo lo reporta como 402. `lib/ai/completion.ts`
ya lo captura con un mensaje accionable (HTTP + cuerpo crudo del proveedor),
así que no fue necesario tocar código. Las pruebas restantes de calibración
se hicieron contra `match_knowledge` directamente (embeddings, cuota
separada) en vez de `/api/v1/chat`, sin perder validez: la búsqueda
semántica es la parte que el threshold gobierna. No es una falla de la
sesión — es lo que la Guía HF anticipaba ("planes gratuitos tienen límites
reales"): la solución es esperar el reinicio mensual o pasar a un plan de
pago, ninguna de las dos cambia una línea de código.

## Tabla de síntomas y diagnóstico

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| Error 401 de Hugging Face | Token ausente, mal copiado o revocado | Revisar `HUGGINGFACEHUB_API_TOKEN` en `.env.local` (empieza con `hf_`); reiniciar `npm run dev` tras cambiarlo |
| "model not supported" / "no provider available" en el chat | El modelo gratuito rotó | Cambiar `HUGGINGFACE_CHAT_MODEL` en `.env.local` por un candidato probado contra la API real; NO tocar código |
| Error 429 / "rate limit" / **402 "depleted your monthly included credits"** (visto en esta sesión) | Cuota gratuita del mes agotada o ráfaga de llamadas | Esperar al siguiente ciclo, o revisar en huggingface.co → Settings → Billing cuánta cuota queda |
| La pestaña IA nunca trae resultados | No se corrió `index-all` (tabla vacía) o threshold muy alto | Contar filas de `knowledge_embeddings` en Studio; si hay 0 → correr el script; si hay 24 → bajar el threshold y recargar |
| La búsqueda IA trae cosas sin relación | Threshold muy bajo | Subirlo en `lib/constants/ai.ts` y documentar aquí (ver "Calibración") |
| El chat responde pero sin fuentes | El contexto llegó vacío (`hasRelevantContext: false`) | Comportamiento correcto para preguntas fuera del catálogo/FAQ; si pasa con preguntas legítimas → revisar calibración |
| Embeddings fallan pero el chat funciona (o viceversa) | Son dos vías distintas (SDK vs router), con cuotas separadas | Revisar el mensaje: `lib/ai/` distingue cuál de las dos falló |
| Publicar un producto no crea su ficha | El trigger es best-effort y el server no ve el token | Buscar el `console.warn` en la terminal del server; correr `index-all` como plan B |
