# Guion de demostración — MercadoTech

Diez minutos, cronometrados. **Cada paso dice qué usuario, qué producto y qué
frase decir.** No es rigidez por gusto: en una demo en vivo, improvisar un
dato es lo que lleva a buscar un pedido que no existe delante de la gente.

**URL:** https://mercadotech.vercel.app

---

## Antes de empezar (el día anterior, no cinco minutos antes)

### 1. Reindexar producción — OBLIGATORIO

Los 20 productos del catálogo **no tienen embeddings**: se sembraron con
`demo-catalog.sql` *después* de haber corrido el indexado. Sin este paso, la
búsqueda semántica del minuto 2 no encuentra nada y el asesor de compras
responde que no halló productos.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<clave-secreta>"; $env:HUGGINGFACEHUB_API_TOKEN="<token>"; npx tsx scripts/index-all.ts
```

Debe decir **20 productos** y **10 artículos**. Compruébalo en el SQL Editor:

```sql
select source_type, count(*) from public.knowledge_embeddings group by source_type;
```

### 2. Preparar las dos cuentas

| Cuenta | Para qué | Cómo |
|---|---|---|
| **Vendedor** | Mostrar el panel, publicar y el kanban | La que ya creaste y es dueña de los 20 productos |
| **Comprador** | Todo el recorrido de compra y el agente | Regístrate en `/register` con un correo distinto, rol **comprador** |

Anota aquí los correos para no dudar en vivo:

* Vendedor: `_______________________`
* Comprador: `_______________________`

### 3. Comprobaciones de dos minutos

- [ ] La home carga con los 20 productos **y sus imágenes**.
- [ ] `/soporte` responde a *"¿cómo devuelvo un producto?"* citando fuentes.
- [ ] El micrófono funciona **en Chrome** (Firefox no reconoce voz).
- [ ] Sesión iniciada como comprador, con las pestañas ya abiertas.
- [ ] Notificaciones del sistema silenciadas.

> **El truco del guion:** en el minuto 2 el comprador hace una compra real. Ese
> pedido es el que el agente consulta en el minuto 7. No es casualidad — es lo
> que permite enseñar el agente con datos verdaderos sin preparar nada aparte.

---

## Minuto 0–1 · Qué es y cómo está hecho

Una lámina, sin tocar el teclado.

> "MercadoTech es un marketplace de productos tecnológicos. Los compradores
> navegan, preguntan y compran; los vendedores publican y gestionan pedidos; y
> dos asistentes con IA responden **citando de dónde sacaron cada dato**. El
> checkout es simulado a propósito: crea el pedido y descuenta stock, sin
> cobrar."

Enseña el diagrama de capas del README y di la regla que gobierna todo:

> "Un solo camino de datos: componentes → hooks → services → Supabase, con las
> políticas de seguridad en la base. La interfaz nunca es lo que protege."

---

## Minuto 1–3 · Comprador

1. Desde la home, escribe en el buscador: **`algo para trabajar desde casa`**
2. Abre la pestaña **"Resultados con IA"**.

   > "Fíjate que ninguna de esas palabras está en los títulos. La búsqueda no
   > es por texto, es por significado: cada producto tiene un vector que
   > representa de qué trata."

3. Abre **Laptop Lenovo IdeaPad Slim 3** → enseña la galería, el precio, las
   reseñas.
4. **Agregar al carrito** → ir al carrito → **Finalizar compra**.
5. En `/pedidos`, muestra el pedido recién creado en estado **pendiente**.

   > "Ese pedido acaba de existir. En el minuto 7 se lo vamos a preguntar al
   > agente de voz."

---

## Minuto 3–5 · Vendedor

Cambia a la cuenta de vendedor (ten la sesión abierta en otra ventana).

1. `/vendedor/publicar` → publica un producto con **dos imágenes**.
2. **Arrastra las miniaturas** para reordenarlas.

   > "Y esto funciona también con el teclado: Tab hasta el asa, Espacio,
   > flechas, Espacio. Se arregló en la sesión 7 — el kanban registraba el
   > sensor de teclado pero le faltaba decirle a dónde saltar."

3. `/vendedor/pedidos` → **mueve el pedido del minuto 2** de *pendiente* a
   *pagado* **usando el teclado**.
4. Intenta moverlo hacia atrás: sale un aviso y la tarjeta no se mueve.

   > "Esa regla vive en el hook, y la base la respalda: aunque alguien llame a
   > la API directamente, las políticas rechazan el retroceso."

---

## Minuto 5–6 · Asesor de compras

Vuelve a la cuenta de comprador. En `/asistente`:

> **"busco unos audífonos para hacer ejercicio"**

Señala las **fuentes** debajo de la respuesta.

> "Solo responde con lo que encuentra en el catálogo. Si no encuentra nada
> relevante, lo dice — no inventa un producto."

---

## Minuto 6–9 · El agente de voz (el clímax)

En `/soporte`, con **Chrome**. Pulsa el micrófono y **habla**; el botón es un
interruptor: una pulsación abre, otra envía.

### a) Consultar un pedido — sin decir ningún código

> **"¿en qué estado está mi último pedido?"**

Responde hablando **y** por escrito, con el estado real.

> "No le dije cuál. Los pedidos se identifican con un código de 36 caracteres
> que nadie puede dictar, así que el agente lo resuelve como una persona: 'el
> último' es el más reciente, y 'el de la laptop' lo busca por el producto. Si
> duda, enumera y pregunta."

### b) Una duda de la FAQ

> **"¿cómo devuelvo un producto?"**

Señala las fuentes.

> "Está leyendo los artículos de ayuda de la tienda, no su conocimiento
> general."

### c) Un reclamo — **el momento importante**

> **"quiero reclamar porque la laptop llegó rayada"**

El agente **propone un resumen y pregunta si confirmas**. Detente aquí:

> "Fíjate en lo que **no** hizo: no creó nada. Consultar un pedido es directo
> porque solo lee. Pero abrir un reclamo escribe en la base y compromete al
> usuario, así que primero pregunta. Un agente que actúa sin permiso es peor
> que no tener agente."

Ahora confirma **hablando**:

> **"sí, confirmo"**

Aparece la tarjeta del ticket. Ábrela: la conversación completa, y el ticket
marcado **"por voz"**.

### d) Los límites, dichos con honestidad

> **"¿me venden un auto?"**

> "Reconoce que no puede y reencuadra qué sí sabe hacer."

---

## Minuto 9–10 · Bajo el capó

Sin navegar mucho, solo enseñar:

* **GitHub → Actions**: el CI en verde. *"Cada pull request corre 313 tests
  unitarios y 17 end-to-end contra una base de datos efímera. Sin ningún
  secreto: el pipeline no puede filtrar lo que no tiene."*
* **La regla de rama**: los dos checks marcados **Required**. *"A `main` no
  entra nada en rojo, ni siquiera si lo intento yo."*
* **`docs/PERFORMANCE.md`**: *"Medir, cambiar, medir. Incluye las
  optimizaciones que revertí por no mover la aguja, y las tres formas de medir
  mal que cometí antes de acertar."*
* **El servidor MCP** en el Inspector, si sobra tiempo: 10 herramientas de solo
  lectura reutilizando los mismos services que la web.

Cierre:

> "Ocho sesiones: base de datos con seguridad a nivel de fila, tienda completa,
> RAG, servidor MCP, tests y CI, despliegue, y un agente que usa herramientas
> reales de la plataforma y pide permiso antes de actuar."

---

## Plan B — porque una demo en vivo tiene tres formas de fallar

| Si falla… | Haz esto |
|---|---|
| **El micrófono o el reconocimiento de voz** | Reproduce el **vídeo pregrabado** del flujo de voz (grábalo el día antes: los tres turnos del minuto 6–9, 90 segundos). Y sigue en vivo por texto: la paridad texto/voz es total |
| **El modelo de Hugging Face** (cuota, o el modelo gratuito rotó) | El catálogo, el carrito, el checkout y el panel del vendedor **no dependen de la IA**: sigue con esos y enseña el vídeo para la parte del agente |
| **Vercel o internet** | Entorno local: `supabase start`, `supabase db reset`, `npx tsx scripts/index-all.ts`, `npm run dev`. Los datos del seed son más ricos que los de producción — hay 6 usuarios y pedidos en los cinco estados |
| **Un flujo se rompe en vivo** | No lo depures delante de la gente. Dilo, sáltalo y sigue. `docs/DEBUGGING.md` existe para después |

**Ten el vídeo abierto en una pestaña antes de empezar.** Un plan B que hay que
buscar en el escritorio no es un plan B.

---

## Checklist de la voz (lo que el CI no puede probar)

Los E2E cubren el agente en modo texto, pero la voz no se automatiza: no hay
micrófono en un servidor y `SpeechRecognition` no existe en un navegador sin
interfaz. Esto se comprueba a mano antes de cada demo:

- [ ] El micrófono pide permiso la primera vez y lo recuerda.
- [ ] Mientras escucha hay **indicador visible** y la transcripción aparece en vivo.
- [ ] La respuesta se **oye en español** y queda escrita.
- [ ] "Silenciar" corta la voz al instante; "Repetir" la vuelve a leer.
- [ ] Al cambiar de página, **deja de hablar**.
- [ ] En Firefox: el botón está deshabilitado, lo explica, y todo funciona por teclado.
