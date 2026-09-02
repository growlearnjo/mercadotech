# MercadoTech — Prompts específicos de la Sesión 8 (Agente de Voz y Demo)

Cada prompt está construido con los ítems de la rúbrica de prompt engineering
(Rol, Contexto, Objetivo, Público/tono, Restricciones, Formato, Ejemplos,
Razonamiento), incluyendo **solo los pertinentes para cada fase**. Lo
particular de esta sesión: el producto es un AGENTE — un sistema que decide
solo — así que las **Restricciones** cargan los guardrails como ley (nunca
actuar sin confirmación, nunca inventar datos, solo el cliente de sesión), y
la separación voz/agente se verifica con greps, no con promesas. Además, gran
parte de la verificación es **hablada**: varios prompts terminan con "di esta
frase exacta al micrófono y esto es lo que debe pasar".

Todos asumen que existe `mercadotech/MercadoTech_sesion8.md` (la spec,
versión validada del 2026-09-02). La spec es la fuente de verdad; el prompt
es el disparador autocontenido.

| Fase | Rol | Contexto | Objetivo | Público/tono | Restricciones | Formato | Ejemplos | Razonamiento | Modelo sugerido |
|---|---|---|---|---|---|---|---|---|---|
| 8.-1 Verificación del terreno | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| Lectura de la spec | — | ✔ | ✔ | — | ✔ | ✔ | — | ✔ | Sonnet |
| 8.0 Go-live pendiente | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | Opus |
| 8.1 lib/voice + useVoice | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Opus |
| 8.2 Tickets + orquestador | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Opus |
| 8.3 UI de soporte con voz | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | Opus |
| 8.4 Integración, tests y deploy | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ | Sonnet |
| 8.5 Demo y roadmap | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | Sonnet |
| Cierre: bitácora final + CLAUDE.md | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sonnet |

La columna "Modelo sugerido" sigue el criterio de la sesión 1 (no ejecutada):
Opus en el corazón de la sesión — el go-live sobre datos reales (8.0), la
máquina de estados de voz (8.1), el orquestador con guardrails (8.2) y la
composición voz+agente (8.3); Sonnet para el cierre de calidad y los
documentos.

---

## Cómo usar estos prompts

1. **Un prompt por turno, en orden, en conversación nueva** (o tras `/clear`).
2. **La Fase 8.0 es el go-live de la sesión 7**: sigue `docs/DEPLOY.md` §2 al
   pie de la letra, con tus clics en los dashboards y la regla de oro intacta
   (los valores de las claves jamás pasan por el chat). Sin esto no hay URL
   para la demo ni https para el micrófono.
3. **Verificación hablada**: desde la 8.1, ten Chrome a mano con micrófono
   funcionando. Las frases de prueba están escritas en cada prompt — dilas
   tal cual.
4. **El agente se prueba primero SIN voz** (8.2, por `curl`): si el cerebro
   funciona por texto, la voz solo es transporte. No inviertas el orden.
5. **Commit por fase**: `feat:`/`fix:`/`test:`/`docs:` según el archivo,
   `for Fase 8.x`.
6. **Cierre**: el Prompt de cierre escribe la bitácora FINAL del curso
   (incluida la retrospectiva — decisión 8 de la spec) y deja `CLAUDE.md`
   como quedará para siempre.

### Estado del repositorio al iniciar la sesión (verificado el 2026-09-02)

* Sesiones 2–7 ejecutadas y cerradas (cierre S7 = `5d83f24`). 293 unitarios;
  **13/13 E2E** (kanban accesible, cero `fixme`); CI verde;
  `github.com/growlearnjo/mercadotech` público.
* **GO-LIVE PENDIENTE**: sin URL de producción, sin branch protection, sin
  smoke test. El guion completo está en `docs/DEPLOY.md` §2; la rama
  `deploy-smoke` (commit `571e10c`) espera sin publicar.
* YA existen y se AMPLÍAN (no crear): `services/ticket.service.ts`
  (`listMine`), `types/ticket.ts`, `hooks/useMyTickets.ts`,
  `lib/constants/support.ts`, `components/chat/*` y la página `/soporte`
  (con el comentario "la sesión 8 agrega el botón de micrófono").
* `SUPPORT_SYSTEM_INSTRUCTIONS` ya es corta y hablable (comentario de la S4).
* `lib/voice/` vacío; cero `data-testid` en soporte/chat; no hay ninguna
  dependencia nueva que instalar en toda la sesión (Web Speech es del navegador).
* Deuda principal documentada (no se toca aquí): catálogo client-side
  ≈ 3.9 s de Load Delay → va al roadmap.
* Sesión 1 no ejecutada: no existe `docs/COSTOS.md` (la retrospectiva va en
  la bitácora final).

---

## Prompt 0 — Verificación del terreno

```text
[ROL] Actúa como release manager de la última iteración: confirmas el estado
exacto del cierre anterior y qué tareas humanas faltan para el go-live.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Lee CLAUDE.md,
docs/BITACORA.md (sección Sesión 7: qué quedó "preparado, no ejecutado"),
docs/DEPLOY.md §2 (el guion del go-live) y
mercadotech/MercadoTech_sesion8.md (secciones "Estado de partida" y
decisiones 1 y 2). Estado esperado: S7 cerrada en 5d83f24; rama
deploy-smoke local (571e10c) sin publicar; sin URL de producción.

[OBJETIVO] Verifica, deteniéndote en la primera sorpresa:
1. `git status` limpio y `git log --oneline | head -3` con el cierre S7;
   `git branch` muestra deploy-smoke.
2. Suites locales: `npm run test` verde con Docker apagado (293); con stack
   arriba y `supabase db reset`: `npm run test:e2e` 13/13; `npm run build`
   verde.
3. CI verde en la última corrida (dime qué mirar en Actions y espera mi
   confirmación).
4. Tareas humanas del go-live listas (pregúntame una por una, sin pedir
   valores): ¿proyecto Supabase de producción creado con su contraseña
   guardada?, ¿cuenta de Vercel conectada a GitHub?, ¿acceso a Settings del
   repo para branch protection?
5. Confirma que esta sesión NO instala dependencias (Web Speech API es del
   navegador) — si crees necesitar un paquete de voz, algo leíste mal.

[RESTRICCIONES]
- No escribas código ni ejecutes ningún paso del go-live: eso es la Fase 8.0.
- No corras nada contra ningún Supabase remoto.

[RAZONAMIENTO] Explica en 3 líneas por qué el go-live va ANTES que la voz
(dos razones distintas están en la spec: la demo y el contexto seguro del
micrófono).

[FORMATO DE SALIDA] (1) Tabla verificación × estado × evidencia; (2) la
lista de tareas humanas confirmadas o faltantes; (3) veredicto: "terreno
listo, adelante con la lectura y la 8.0" o el bloqueo encontrado; (4) sin
commit.
```

## Prompt 1 — Lectura de la spec (sin código)

```text
[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. El Prompt 0 confirmó
el terreno. Vas a ejecutar la última sesión del curso en 6 fases (8.0–8.5),
cada una sin memoria de la anterior. El producto central es un AGENTE: un
sistema que decide qué herramienta usar — y por eso sus reglas duras
importan más que en ninguna sesión anterior.

[OBJETIVO] Lee COMPLETOS, en este orden: CLAUDE.md;
mercadotech/MercadoTech_sesion8.md (analogía de la recepcionista, glosario,
las 11 decisiones de validación y las 5 intenciones con su tabla de
herramientas); docs/DEPLOY.md §2 (el guion que la 8.0 ejecutará);
services/ticket.service.ts y lib/constants/support.ts (lo que se AMPLÍA);
app/(shop)/soporte/page.tsx y components/chat/ChatWindow.tsx (lo que se
compone); services/order.service.ts (listMyOrders y getOrderById — las
herramientas del agente); lib/ai/prompts.ts (SUPPORT_SYSTEM_INSTRUCTIONS ya
hablable). Después confírmame que entiendes el alcance.

[RESTRICCIONES] No generes código. No propongas proveedores de voz de pago,
escucha continua ni features fuera del documento. Si algo del repo
contradice la spec, repórtalo como pregunta.

[RAZONAMIENTO] Dos pruebas de comprensión, 4 líneas cada una: (a) ¿por qué
"el agente no sabe que existe la voz" y qué permitiría eso mañana?; (b) ¿por
qué la herramienta de pedidos NO puede pedir el número de pedido, y cómo
resuelve entonces "¿y el otro pedido?"? (decisión 2 — si respondes "extrae
el id del texto", relee).

[FORMATO DE SALIDA] (1) Resumen de 6 líneas, una por fase; (2) las dos
pruebas de comprensión; (3) las 3 reglas duras del agente que consideras
más fáciles de violar por accidente y cómo las vas a proteger; (4) dudas (o
"ninguna"); (5) confirmación de no adelantar fases.
```

## Prompt Fase 8.0 — El go-live pendiente de la sesión 7

```text
[ROL] Actúa como ingeniero de release acompañando un go-live real: el guion
ya está escrito; tu trabajo es ejecutarlo contigo de copiloto, un paso a la
vez, verificando cada "deberías ver" antes de seguir.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. EL GUION ES
docs/DEPLOY.md §2 — léelo completo antes de empezar y NO lo re-redactes:
esta fase lo ejecuta tal cual (spec 8.0, decisión 1). Lee también la
sección Sesión 7 de docs/BITACORA.md ("preparado, no ejecutado": qué quedó
exactamente a medias) y ten presente la regla de oro: los valores de las
claves van directo a los dashboards, jamás por este chat. La rama
deploy-smoke (571e10c) está lista y sin publicar. YO confirmé en el Prompt
0 las tareas humanas (proyecto Supabase prod, Vercel, acceso a Settings).

[OBJETIVO] Ejecutar el go-live completo siguiendo DEPLOY.md §2, alternando:
comandos que corres tú (supabase link/db push desde mi terminal — me los
das y yo los corro donde haya contraseñas), clics que doy yo (SQL Editor
con seed.prod.sql, Confirm email OFF, importar el repo en Vercel y cargar
las variables A MANO, branch protection), y verificaciones tuyas tras cada
paso. Después: `git push -u origin deploy-smoke`, abrir el PR, comprobar
que el merge se bloquea hasta los checks, mergear en verde, y correr el
smoke test completo de DEPLOY.md sobre la URL real (incluida la indexación
de la FAQ de prod si el guion la marca pendiente). Completar la checklist
del smoke en DEPLOY.md con los ✅ y la URL.

[PÚBLICO/TONO] Instrucciones para mí: numeradas, un clic o comando por
línea, con "deberías ver…" al final de cada una. Ante cualquier
discrepancia con el guion, me detengo y te la digo.

[RESTRICCIONES]
- Nada de CLI de Vercel ni secretos en Actions (directivas de la S7).
- Si un paso del guion no coincide con la realidad del dashboard, se anota
  como desviación en el registro de cambios de la spec 7 — no se improvisa.
- El seed de laboratorio jamás toca producción.
- Si el primer deploy falla, se diagnostica con la tabla de síntomas de
  DEPLOY.md §4 antes de tocar nada.

[RAZONAMIENTO] Antes del primer paso: identifica en el guion los 3 pasos de
mayor riesgo y su plan-B (los mismos que la spec 7 exigía). Luego
ejecutamos.

[FORMATO DE SALIDA] (1) Transcripción del go-live paso a paso con mis
confirmaciones; (2) evidencia del candado: PR bloqueado → checks verdes →
merge → producción actualizada; (3) checklist del smoke con ✅ y la URL de
producción; (4) commit: "docs: record executed go-live and smoke results
for Fase 8.0".
```

## Prompt Fase 8.1 — Capa de voz y `useVoice`

```text
[ROL] Actúa como ingeniero de plataformas de navegador: envuelves una API
caprichosa (Web Speech) en una interfaz limpia, con los caprichos
documentados donde muerden.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion8.md (Fase 8.1 completa y decisiones 4 y
6); CLAUDE.md (la regla de capas que vas a extender: la cadena de voz es
componente → useVoice → lib/voice, y NADIE más importa lib/voice);
lib/constants/roles.ts o cualquier archivo de lib/constants/ (el patrón de
comentario justificatorio); hooks/useChat.ts (el estilo de hooks del repo).
lib/voice/ está vacío. Cero dependencias nuevas: SpeechRecognition y
speechSynthesis son del navegador, y sus tipos NO vienen en lib.dom — las
declaraciones ambient van dentro de lib/voice/types.ts (decisión 6).

[OBJETIVO] Ejecuta la Fase 8.1: lib/voice/types.ts (interfaces SttProvider
y TtsProvider de la spec + declaraciones ambient + comentario de cómo se
enchufaría Whisper/ElevenLabs sin tocar UI ni agente);
lib/voice/web-speech-stt.ts (permiso denegado → error tipado; parciales
via onPartial; es-PE con fallback es); lib/voice/web-speech-tts.ts (primera
voz es-* disponible; troceo a TTS_CHUNK_MAX_CHARS — algunos motores cortan
~200 chars en silencio; cancel limpio); lib/constants/voice.ts (los 4
tunables con su porqué); hooks/useVoice.ts (máquina idle → listening →
processing → speaking → idle con error transversal; expone state,
partialTranscript, startListening, stopListening, speak, cancel,
isVoiceSupported; NO llama al agente); y la página TEMPORAL app/dev/voz/
page.tsx para probar (se borra en 8.4).

[RESTRICCIONES]
- lib/voice/ no importa React, services, lib/ai/ ni Supabase. useVoice no
  conoce al agente. Ningún componente importa lib/voice (grep al final).
- El micrófono solo arranca por llamada explícita a startListening; el
  timeout de silencio (LISTEN_TIMEOUT_MS) corta solo.
- Errores como valores tipados en el estado del hook, no excepciones sin
  catch (el permiso denegado es el caso número uno).
- Nada de npm install.

[EJEMPLOS] Forma esperada del guard de soporte:
  isSupported(): boolean {
    return typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }

[RAZONAMIENTO] Antes de codificar, escribe la tabla de transiciones de la
máquina (estado × evento → estado nuevo), incluidos los caminos de error
(permiso denegado en listening; timeout de silencio; cancel durante
speaking). Implementa exactamente esa tabla.

[FORMATO DE SALIDA] (1) Árbol de lib/voice/ + el hook; (2) la tabla de
transiciones; (3) verificación en vivo conmigo en /dev/voz: dicto una frase
(parciales visibles → transcripción final), escucho un texto leído, deniego
el permiso y veo el error claro; (4) greps de independencia en vacío;
(5) lint y type-check; (6) commit: "feat: add voice abstraction layer and
useVoice for Fase 8.1".
```

## Prompt Fase 8.2 — Tickets completos y orquestador del agente

```text
[ROL] Actúa como ingeniero de agentes con una obsesión: un agente vale lo
que valen sus límites. Herramientas que reutilizan, confirmación antes de
actuar, y ni un dato inventado.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion8.md (Fase 8.2 COMPLETA: tabla de
herramientas y decisiones 2, 3, 5, 7 y 9 — la 2 es la más importante: los
ids de pedido son UUIDs impronunciables, la herramienta resuelve por
contexto con listMyOrders, jamás pide un id); services/ticket.service.ts
(listMine se AMPLÍA, no se renombra); services/order.service.ts (firmas
reales de listMyOrders y getOrderById); services/chat.service.ts (ask con
modo soporte — la herramienta de FAQ); lib/ai/completion.ts y prompts.ts
(patrones de la S4); lib/constants/support.ts (se amplía con los tunables
del agente); la RLS de support_tickets/ticket_messages en
supabase/policies.sql (qué permite el trigger del dueño); el patrón de
endpoint de app/api/v1/chat/route.ts. La sesión 6 manda: Supabase inyectado,
lib/ai con vi.mock — los tests llegan en 8.4, pero DISEÑA para eso.

[OBJETIVO] Ejecuta la Fase 8.2: ampliar ticket.service (createTicket con
primer mensaje 'usuario', getTicketWithMessages, addMessage, closeTicket);
ampliar lib/constants/support.ts (AGENT_INTENTS, AGENT_MAX_HISTORY_TURNS,
AGENT_MAX_REPLY_CHARS, INTENT_MAX_TOKENS, con porqués); ampliar
lib/ai/prompts.ts (INTENT_CLASSIFIER_INSTRUCTIONS con salida forzada a
etiqueta y SUPPORT_AGENT_INSTRUCTIONS con los guardrails de la spec);
types/support.ts (AgentIntent, AgentTurnRequest con pending eco,
AgentTurnResult); services/support-agent.service.ts (cabecera obligatoria:
"El agente no sabe que existe la voz: recibe texto, devuelve texto"; flujo
por turno: pending → clasificar → herramienta → redactar corto); y POST
/api/v1/support-agent (sesión requerida, cliente de SESIÓN, log
estructurado {intent, hasAction, pendingType}, errores con apiError).

[PÚBLICO/TONO] Los textos que el agente dice (propuestas de confirmación,
enumeración de pedidos, fuera de alcance) van en español hablable: cortos,
sin jerga, terminando en una pregunta cuando esperan respuesta. La
enumeración de pedidos es dictable: "1: el del 20 de agosto, una laptop
Lenovo, entregado. 2: …".

[RESTRICCIONES]
- Guardrails NO negociables (spec): nunca inventar pedidos ni montos (los
  datos de pedidos SOLO salen de la herramienta); nunca prometer
  reembolsos; crear_reclamo y hablar_humano SIEMPRE en dos turnos con
  pending; máx ~2 frases + una pregunta; cliente de SESIÓN siempre (el
  admin no existe en esta sesión).
- El orquestador no importa lib/voice/ ni React, no toca Supabase directo
  (todo vía services), no llama al servidor MCP (decisión 5).
- El historial al LLM se recorta a AGENT_MAX_HISTORY_TURNS; la
  clasificación usa INTENT_MAX_TOKENS (decisión 7).
- Sin token HF, el endpoint devuelve el error accionable de lib/ai/.

[EJEMPLOS] El contrato del turno con confirmación (decisión 9):
  // turno 1 → {reply: "Voy a crear este reclamo: 'Laptop llegó rayada…'.
  //            ¿Confirmas?", intent: "crear_reclamo",
  //            pending: {type: "crear_reclamo", subject: "…", summary: "…"}}
  // turno 2 (el cliente reenvía pending + "sí, confirmo")
  //         → {reply: "Listo, creé el reclamo…", intent: "crear_reclamo",
  //            action: {type: "ticket_creado", ticketId: "…"}}

[RAZONAMIENTO] Antes de codificar: (a) escribe la tabla intención ×
herramienta × qué pasa si falta un dato (¿pregunta? ¿enumera?); (b) para
consulta_pedido, lista 4 formas reales de referirse a un pedido hablando
("mi último pedido", "el de la laptop", "el que hice ayer", "mis pedidos")
y cómo las resuelve listMyOrders sin pedir jamás un id. Implementa eso.

[FORMATO DE SALIDA] (1) Archivos ampliados/creados; (2) los 6 curl de
verificación de la spec (estado real del último pedido de buyer1; FAQ con
fuentes; reclamo → pending SIN ticket; confirmación → ticket en Studio con
channel 'chat'; fuera de alcance honesto; 401 sin cookie) con sus
respuestas literales; (3) los logs estructurados de esos turnos; (4) lint
y type-check; (5) commit: "feat: add full ticket service and support agent
orchestrator for Fase 8.2".
```

## Prompt Fase 8.3 — Centro de soporte con voz (UI)

```text
[ROL] Actúa como frontend engineer de interfaces multimodales: la voz es un
acelerador sobre una UI que ya funciona perfecta por texto, y cada estado
del micrófono es visible y honesto.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion8.md (Fase 8.3 completa);
hooks/useVoice.ts (8.1) y el endpoint /api/v1/support-agent con
types/support.ts (8.2); app/(shop)/soporte/page.tsx (hoy usa
useChat('soporte') — migra al agente); components/chat/ChatWindow.tsx (se
AMPLÍA con props opcionales puras: inputAccessory y soporte de action en
mensajes — sin lógica nueva); hooks/useChat.ts (patrón para
useSupportAgent; useChat queda INTACTO para /asistente);
components/support/TicketStatusBadge.tsx y hooks/useMyTickets.ts (Mis
tickets, ya existen); lib/constants/support.ts.

[OBJETIVO] Ejecuta la Fase 8.3: hooks/useSupportAgent.ts (historial +
pending eco + errores como mensaje inline); components/support/
VoiceButton.tsx (push-to-talk con los 4 estados visuales + badge
"micrófono activo" + deshabilitado con tooltip si no hay soporte),
LiveTranscript.tsx y TicketCreatedCard.tsx; ampliar ChatWindow
(inputAccessory + action); recomponer /soporte (useSupportAgent + useVoice
se encuentran SOLO en la página; cada respuesta se habla por TTS con
silenciar/repetir y siempre queda escrita; ChatInput de texto presente —
paridad total); y la ruta soporte/tickets/[id] (detalle con mensajes +
cerrar ticket).

[PÚBLICO/TONO] Estados del micrófono en palabras de usuario ("Escuchando…",
"Pensando…", "Hablando"), tooltip de Firefox amable ("Tu navegador no
soporta dictado por voz; escribe tu consulta"), y la card de ticket con el
número visible y link.

[RESTRICCIONES]
- La página es el ÚNICO lugar donde voz y agente se conocen. VoiceButton y
  LiveTranscript son PUROS (estado y callbacks por props); ningún
  componente importa lib/voice ni hace fetch.
- Micrófono solo por gesto; al desmontar la página, cancel() de STT y TTS
  (nada de voces fantasma en otra ruta).
- La UI no re-redacta al agente: muestra reply tal cual.
- useChat y /asistente no se tocan.
- Sin data-testid todavía (llegan con el E2E en 8.4) — no los inventes aquí.

[RAZONAMIENTO] Antes de codificar, describe el ciclo completo de UN turno
por voz (gesto → listening con parciales → stop → processing con el
endpoint → reply → speaking → idle) y señala los 2 puntos donde puede
colgarse (stop sin resultado; TTS sin voz es-*) y qué muestra la UI en
cada uno. Implementa eso.

[FORMATO DE SALIDA] (1) Archivos creados/ampliados; (2) verificación en
vivo conmigo en Chrome (frases exactas): "¿en qué estado está mi último
pedido?" → hablado y escrito con el estado real; "¿cómo devuelvo un
producto?" → fuentes visibles; "quiero reclamar porque mi laptop llegó
rayada" → pide confirmación → "sí, confirmo" HABLADO → card de ticket →
aparece en Mis tickets con channel 'voz' → abro el detalle y lo cierro;
(3) verificación de degradación: simular isVoiceSupported=false → todo
funciona por texto; (4) navegación fuera corta el TTS; (5) lint y
type-check; (6) commit: "feat: add voice support center UI for Fase 8.3".
```

## Prompt Fase 8.4 — Integración final, tests y deploy del agente

```text
[ROL] Actúa como QA final de un curso completo: nada se entrega sin su
test, su auditoría y su deploy — y lo que no se puede automatizar (la voz)
queda cubierto por una checklist explícita, no por fe.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion8.md (Fase 8.4 y decisiones 10 y 11);
services/support-agent.service.ts y ticket.service.ts (lo que vas a
testear — los tests documentan SU comportamiento real);
services/test-utils/supabase-mock.ts y cualquier *.service.test.ts de la
S6 (el patrón exacto: Supabase inyectado, lib/ai con vi.mock);
e2e/fixtures/ y e2e/pages/ (reutilizar; agregar SupportPage);
app/(shop)/soporte/page.tsx y components/chat|support/ (dónde faltan los
data-testid — hoy hay CERO); .claude/skills/ (las 4 Skills que auditarán);
docs/DEPLOY.md (el flujo de deploy que usarás al final).

[OBJETIVO] Ejecuta la Fase 8.4 en orden: (1) tests unitarios del
orquestador (intención mockeada → herramienta correcta; crear_reclamo sin
confirmación NO crea y con confirmación crea con el channel correcto; "mi
último pedido" → el más reciente; ambigüedad → enumeración) y de las
funciones nuevas de ticket.service; (2) data-testid en soporte/chat (solo
atributos) + e2e/tests/support-agent.spec.ts EN MODO TEXTO (FAQ con
fuentes; reclamo con confirmación → card → Mis tickets → detalle → cerrar)
con el comentario de por qué la voz no se automatiza (decisión 11);
(3) suite completa: unit verde con Docker apagado, E2E completo tras db
reset; (4) borrar app/dev/voz/; (5) invocar las 4 Skills sobre lib/voice/,
el orquestador y la UI nueva → corregir hallazgos en commits separados →
validator APROBADA; (6) greps de independencia de la spec, pegados;
(7) rama → PR (el CI corre los E2E nuevos) → merge en verde → smoke de
producción ampliado: el agente responde en la URL real.

[RESTRICCIONES]
- Los tests anclan el comportamiento REAL del orquestador; si revelan un
  bug, primero el fix (commit propio), después el test en verde — nunca un
  test que "perdona".
- vi.mock SOLO para lib/ai/*; Supabase siempre inyectado (regla S6).
- El E2E no intenta usar el micrófono ni stubear Web Speech: modo texto
  puro (decisión 11).
- La corrección de hallazgos de Skills no cambia contratos públicos; si
  uno lo exigiera, va como deuda documentada.

[EJEMPLOS] Ancla esperada del guardrail (unit):
  it("crear_reclamo sin confirmación NO crea el ticket", async () => {
    const supabase = mockSupabase({});
    const r = await runAgentTurn({message: "quiero reclamar…", history: []}, supabase);
    expect(r.pending?.type).toBe("crear_reclamo");
    expect(supabase.inserts("support_tickets")).toHaveLength(0);
  });

[RAZONAMIENTO] Antes de escribir tests: lista los 5 comportamientos del
agente cuya regresión sería más grave en una demo en vivo, y asegúrate de
que cada uno tiene SU test con nombre explícito. Esa lista abre la sección
de tests en el commit message.

[FORMATO DE SALIDA] (1) Archivos de test y conteo de casos; (2) suite
completa: unit (con Docker apagado) y E2E (total actualizado, sin fixme);
(3) informe de las Skills + commits de corrección + salida literal del
validator (APROBADA); (4) greps en vacío; (5) evidencia del PR → CI verde
→ merge → smoke de producción con el agente respondiendo; (6) commits:
"test: add agent and ticket suites for Fase 8.4", "test: add support agent
e2e (text mode) for Fase 8.4", y los fix/chore que salgan.
```

## Prompt Fase 8.5 — Demo y roadmap

```text
[ROL] Actúa como el productor de la demo: tu entregable es un guion que
CUALQUIERA puede ejecutar cronómetro en mano, con cada clic, cada frase
hablada y cada dato escritos — y un plan B que no dependa del wifi.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Antes de escribir,
lee: mercadotech/MercadoTech_sesion8.md (Fase 8.5: la escaleta minuto a
minuto y la decisión 8 — la retrospectiva NO va aquí); docs/BITACORA.md
(los números reales de todo el curso: tests, cobertura, performance con su
deuda, tiempos de CI); la URL de producción y los usuarios/datos reales
(seed + el producto demo del smoke); docs/PERFORMANCE.md (los números que
la demo puede presumir y el que debe admitir); mcp/README.md (el cierre
"bajo el capó" muestra el Inspector).

[OBJETIVO] Ejecuta la Fase 8.5: docs/DEMO.md con la escaleta de 10 minutos
de la spec — cada paso con URL exacta, usuario exacto, dato exacto y, en
el bloque de voz, la FRASE LITERAL que se dice al micrófono y qué debe
responder el agente; el plan B escrito (video corto del flujo de voz
pregrabado + entorno local como respaldo del deploy, con los comandos para
levantarlo en 2 minutos). Y docs/ROADMAP.md con los ítems de la spec,
esfuerzo S/M/L y una línea de porqué cada uno — abriendo con el catálogo a
Server Components (la deuda medida: sus números están en PERFORMANCE.md y
la bitácora S7).

[PÚBLICO/TONO] DEMO.md lo ejecutará alguien nervioso frente a público:
imperativo, un paso por línea, tiempos por bloque, y las frases de voz
entre comillas listas para leer. ROADMAP.md lo lee quien hereda el
proyecto: cada ítem con su porqué y su tamaño, sin humo.

[RESTRICCIONES]
- Ningún paso de la demo depende de datos que no existan HOY en producción
  o en el seed local del plan B — verifica cada uno antes de escribirlo.
- La retrospectiva del curso no va en estos documentos (decisión 8: es del
  Prompt de cierre).
- No agregues features ni "mejoras rápidas" al pasar: el código está
  congelado para la demo.

[EJEMPLOS] Forma esperada de un paso del bloque de voz:
  [6:30] Mantén presionado el botón del micrófono y di:
  "¿En qué estado está mi último pedido?"
  → El agente responde hablando: estado 'entregado', la laptop Lenovo,
    y lo mismo queda escrito. (Si el STT falla 2 veces: plan B, video 0:40.)

[FORMATO DE SALIDA] (1) docs/DEMO.md; (2) docs/ROADMAP.md; (3) el
resultado del ENSAYO cronometrado conmigo (bloque × tiempo real × ¿hizo
falta improvisar?) y los ajustes que salieron de él; (4) commit: "docs:
add demo script and roadmap for Fase 8.5".
```

## Prompt de cierre — Bitácora final del curso y CLAUDE.md definitivo

```text
[ROL] Actúa como tech lead cerrando un PROYECTO, no una iteración: la
bitácora que escribes es el documento que alguien leerá dentro de un año
para entender qué se construyó, cómo y qué aprendió el equipo.

[CONTEXTO] Proyecto MercadoTech, carpeta mercadotech/. Las Fases 8.0–8.5
están ejecutadas: hay URL de producción con el agente de voz desplegado,
demo ensayada y roadmap. Obtén el estado REAL: `git log --oneline`
(identifica el cierre S7, 5d83f24, y el rango de la 8), `git diff --stat
5d83f24..HEAD`, docs/{DEMO,ROADMAP,DEPLOY,PERFORMANCE}.md, y lee
docs/BITACORA.md completo (vas a cerrar su historia), CLAUDE.md y
mercadotech/MercadoTech_sesion8.md (decisiones, entregables, criterios —
en particular la decisión 8: la retrospectiva del curso va AQUÍ).

[OBJETIVO] (1) Agregar a docs/BITACORA.md la sección "Sesión 8" (arriba de
la 7): el go-live ejecutado (URL, qué se desvió del guion), por fase qué se
construyó con commits, las decisiones ejercidas (resolución de pedidos sin
UUID, pending eco, voz solo en navegador, E2E solo texto), problemas
reales y solución, números finales del curso (tests totales, E2E, cobertura,
duración de CI, Lighthouse con su deuda admitida). (2) En la misma sección,
la RETROSPECTIVA DEL CURSO (decisión 8): qué funcionó del método
(spec-por-fases, Prompt 0, bitácora, Skills, anclas al código real), qué
no se midió (el gasto por sesión — la sesión 1 nunca se ejecutó, decirlo
honestamente), y las 3 lecciones que un alumno debería llevarse. (3)
Actualizar CLAUDE.md a su estado FINAL: la capa lib/voice/ y su cadena
(componente → useVoice → lib/voice, con su grep), el agente y sus
guardrails como reglas del repo, el estado del proyecto en "8 sesiones:
completas" con la URL, y los punteros definitivos (DEMO, ROADMAP,
BITACORA). Verificar que ninguna línea de CLAUDE.md afirme algo ya falso.

[PÚBLICO/TONO] La bitácora final la lee alguien dentro de un año: hechos,
números y porqués. La retrospectiva es honesta — lo que no se midió, no se
midió. CLAUDE.md: solo lo que cambia decisiones de quien trabaje mañana en
el repo.

[RESTRICCIONES]
- Todo sale de git, del filesystem y de los docs; nada de memoria.
- CLAUDE.md crece máximo ~30 líneas netas y borra lo obsoleto (ej.
  "Siguiente: sesión 8").
- Ninguna clave en la bitácora; URLs públicas sí.
- No modifiques código.

[EJEMPLOS] Línea esperada en CLAUDE.md:
  * La voz vive en `lib/voice/` tras la interfaz VoiceProvider; solo
    `hooks/useVoice.ts` la importa. El agente (support-agent.service) no
    sabe que existe: recibe texto, devuelve texto.

[RAZONAMIENTO] Arma la línea de tiempo completa del curso desde git (8
sesiones, una línea por sesión) antes de redactar — es el esqueleto de la
retrospectiva. Relee CLAUDE.md completo al final como si mañana llegara un
desarrollador nuevo: es SU contrato ahora.

[FORMATO DE SALIDA] (1) Sección "Sesión 8" + retrospectiva en
docs/BITACORA.md; (2) diff de CLAUDE.md; (3) tabla entregables de la
sesión × estado × evidencia; (4) la línea de tiempo del curso; (5) commit:
"docs: add final project log and course retrospective at close of
Sesión 8".
```

---

## Nota sobre la rúbrica

El riesgo nuevo de esta sesión no es técnico sino de **autonomía**: un
agente mal especificado "ayuda" de más — crea el ticket sin preguntar,
adivina un pedido, promete un reembolso. Por eso las **Restricciones** de
8.2 llevan los guardrails como lista no negociable, los **Ejemplos**
muestran el contrato de confirmación en dos turnos (el patrón `pending`
eco), y el test que ancla "sin confirmación NO crea" aparece dos veces
(diseño en 8.2, verificación en 8.4). El **Razonamiento** obliga a resolver
EL problema de diseño de la sesión antes de codificar: cómo se refiere un
humano a un pedido hablando (nunca por UUID — decisión 2). Y el **Formato de
salida** incorpora algo inédito en el curso: verificación hablada en vivo,
con las frases exactas entre comillas — porque la voz no cabe en un `curl`
ni en CI, y la única evidencia honesta es decirle la frase al micrófono y
escuchar la respuesta correcta.
