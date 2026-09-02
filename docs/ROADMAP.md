# Roadmap de MercadoTech

Qué haría falta para llevar esto de proyecto de curso a producto. Ordenado por
lo que más duele hoy, no por lo más entretenido de construir.

**Esfuerzo:** **S** = un par de días · **M** = una a dos semanas · **L** = más
de dos semanas o una decisión de arquitectura.

---

## 1. Servir el catálogo desde el servidor — **L** · la deuda principal

**Es la única entrada de esta lista que ya viene con sus números medidos**, en
[`PERFORMANCE.md`](PERFORMANCE.md).

El HTML inicial no trae ni una tarjeta de producto:

```bash
curl -s https://mercadotech.vercel.app/ | grep -c "product-card"   # → 0
```

Las páginas son Client Components que piden los datos tras hidratar, así que la
secuencia real es: descargar ~300 kB de JavaScript → hidratar → pedir a
Supabase → recién entonces existe la imagen. Son **3.9 s de "Load Delay"** en el
LCP, el 73 % del total, y ninguna optimización de imagen puede tocarlos. Por eso
Lighthouse se queda en 72 y no llega a 90 por mucho que se afine.

**Qué habría que hacer:** convertir `/`, `/categoria/[slug]` y `/producto/[id]`
en Server Components que reciban los productos ya renderizados.

**Por qué es L y no M:** cambia la regla `hooks → services` que gobierna el
proyecto desde la sesión 3. No es un ajuste, es una decisión de arquitectura —
hay que decidir qué hacen entonces los hooks, cómo conviven con los filtros que
viven en la URL, y qué pasa con la búsqueda semántica, que sí necesita cliente.

**Se ganaría además el CLS** de `/categoria/[slug]` y `/producto/[id]`, que
sigue en 0.118 por la misma causa: el pie de página salta cuando llega el
contenido.

---

## 2. Pagos reales — **L**

Hoy el checkout crea el pedido y descuenta stock, sin cobrar. Es una decisión
del proyecto, no una carencia, pero es lo que separa esto de una tienda.

Con Stripe o Culqi (que cubre mejor Perú): página de pago, **webhook** que
confirme el cobro antes de dar el pedido por bueno, e idempotencia — un webhook
llega más de una vez y no puede descontar el stock dos veces. El estado
`pendiente` ya existe justo para esperar esa confirmación.

Trae consigo reembolsos, conciliación y facturación: en la práctica, un módulo
entero.

---

## 3. Un proyecto de staging separado — **S** · riesgo abierto hoy

Los previews de Vercel usan **la misma base de datos que producción**
([`DEPLOY.md`](DEPLOY.md) §1.3). Un pull request que toque datos escribe sobre
la tienda real.

Es asumible en un laboratorio y está documentado, pero es la clase de cosa que
un día borra algo que importaba. Se resuelve con un segundo proyecto Supabase
para Preview, o con las ramas de base de datos que ofrece Supabase.

Barato y con el mayor cociente entre riesgo evitado y trabajo.

---

## 4. Voz de producción: Whisper y ElevenLabs — **M**

La Web Speech API es gratis y no necesita servidores, pero tiene tres techos:
**Firefox no reconoce voz**, el reconocimiento de Chrome viaja a un servicio de
Google (falla sin conexión) y las voces del sistema suenan a robot.

**Aquí la arquitectura ya hizo su trabajo:** `lib/voice/types.ts` define
`SttProvider` y `TtsProvider`, y enchufar Whisper para transcribir o ElevenLabs
para hablar es **escribir un archivo nuevo en esa carpeta**. Ni la pantalla ni
el agente se enteran. Lo único a resolver es dónde corre: Whisper necesita
servidor, así que haría falta un Route Handler que reciba el audio — el mismo
patrón que ya usa `lib/ai/` para proteger su clave.

Es M por el coste por minuto y por el manejo del audio, no por el diseño.

---

## 5. Streaming de respuestas — **M**

Hoy el agente hace dos llamadas al modelo por turno (clasificar y redactar) y el
usuario espera en silencio a que termine. Con streaming, la respuesta aparecería
palabra a palabra y el TTS podría empezar a hablar antes de tenerla completa.

Cambia mucho la sensación de velocidad sin cambiar nada de la velocidad real.
Toca `lib/ai/completion.ts`, el Route Handler y el hook.

---

## 6. Chunking real del RAG — **M**

`knowledge_embeddings` ya tiene una columna `chunk_index` que **hoy no se usa**:
cada artículo de la FAQ se indexa entero, como un solo vector.

Con artículos largos eso diluye el significado — un texto que habla de envíos,
plazos y devoluciones acaba en un vector que no representa bien ninguno de los
tres. Partirlos en trozos con solapamiento mejora la recuperación y hace las
citas más precisas. La columna está esperando desde la sesión 4.

---

## 7. Un agente para el vendedor — **M**

El mismo orquestador, otras herramientas: *"¿cuánto vendí esta semana?"*,
*"¿qué productos se están quedando sin stock?"*, *"marca como enviados los
pedidos de ayer"*.

Encaja sin rediseño porque el agente **no sabe de dónde viene el texto** y sus
herramientas son services existentes. Lo nuevo sería el conjunto de intenciones
y, sobre todo, los guardrails: aquí las acciones cambian pedidos de otras
personas, así que la confirmación importa aún más.

---

## 8. Notificaciones — **M**

Ahora mismo, si un vendedor marca un pedido como enviado, el comprador se entera
si entra a mirar. Correo transaccional (Resend) para cambios de estado y
respuestas a tickets, con sus preferencias de suscripción.

Habilita además volver a activar la **confirmación por correo** en el registro,
que hoy está desactivada solo porque no hay proveedor configurado
([`DEPLOY.md`](DEPLOY.md) §2.5).

---

## 9. Aplicación móvil reutilizando los services — **L**

Con React Native y `@supabase/supabase-js`, la capa de negocio se reutiliza casi
entera: los services reciben el cliente por parámetro y no saben nada del DOM.
Habría que rehacer la interfaz y resolver la sesión en móvil.

Y el agente ya está listo: recibe texto y devuelve texto, así que la aplicación
llamaría al mismo endpoint.

---

## 10. El MCP como API pública autenticada — **M**

El servidor MCP es hoy de solo lectura y corre en local por stdio. Exponerlo
sobre HTTP con autenticación por usuario permitiría que otras herramientas
consulten el catálogo — con la RLS aplicando por token en vez del service role.

---

## Deuda menor, anotada para que no se olvide

| Qué | Esfuerzo | Nota |
|---|---|---|
| **`/dev/voz` sigue publicada** | S | Banco de pruebas de la sesión 8. No está bajo `(shop)`, así que **no exige sesión** y es accesible en producción. No expone datos ni claves, pero es una página interna a la vista. Se decidió conservarla; moverla dentro de `(shop)` la protegería |
| Códigos de pedido legibles | S | Hoy son UUID. El agente lo resuelve por contexto, pero un `A3F2` ayudaría a las personas — y a decirlo por teléfono |
| E2E contra previews en el CI | S | Documentado como herramienta manual: los specs crean datos reales y los previews comparten la base de producción (ver #3) |
| Cobertura de `hooks/` y `components/` | M | Los tests cubren bien `services/` (89.9 %); la capa de interfaz depende de los E2E |
| Paginación por cursor | S | Hoy por offset. Con miles de productos, las páginas altas se vuelven lentas |
| Rotación del modelo de chat | S | Los modelos gratuitos de Hugging Face desaparecen sin aviso. Existe `HUGGINGFACE_CHAT_MODEL` para cambiarlo sin desplegar, pero nadie vigila que siga vivo |
