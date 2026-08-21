# MercadoTech — Sesión 8: Agente de Voz de Soporte, Demo Final y Roadmap

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion8.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 8.1: capa de abstracción de voz (`lib/voice/`)."
3. "Ejecuta la Fase 8.2: servicios de tickets y orquestador del agente de soporte."
4. "Ejecuta la Fase 8.3: centro de soporte con voz (UI)."
5. "Ejecuta la Fase 8.4: integración final y pulido end-to-end."
6. "Ejecuta la Fase 8.5: guion de demo y roadmap de especialización."

---

## Objetivo general

Culminar MercadoTech convirtiendo el asistente de soporte (texto, sesión 4) en
un **agente de voz**: el usuario habla, el agente entiende la intención, usa
herramientas reales de la plataforma (estado de pedido, FAQ, tickets) y
responde hablando. Cierre con integración total, demo en vivo y roadmap.

Este es el módulo del curso de "agentes autónomos": el agente decide QUÉ
herramienta usar, pero cada acción con efectos (crear ticket, escalar) exige
confirmación explícita del usuario.

## Objetivos específicos

* Integrar todos los módulos construidos en las sesiones 2–7.
* Implementar STT y TTS detrás de una interfaz intercambiable (`VoiceProvider`).
* Construir un orquestador de agente con detección de intención y herramientas.
* Mantener la independencia de capas: la voz es una CAPA DE ENTRADA/SALIDA,
  el agente es un SERVICE, y ninguno conoce al otro por dentro.
* Preparar y ejecutar la demo final; definir el roadmap.

## Decisiones técnicas de voz

* **Baseline: Web Speech API del navegador** (costo cero, sin claves):
  `SpeechRecognition` (STT, `lang: 'es-PE'` con fallback `es`) y
  `speechSynthesis` (TTS, elegir voz en español disponible).
* Soporte de navegador: Chrome/Edge sí; Firefox no soporta `SpeechRecognition`
  → la UI detecta la capacidad y degrada a modo texto SIN romper nada.
* Toda la API de voz vive en `lib/voice/` detrás de la interfaz `VoiceProvider`
  — cambiar a Whisper (STT server-side) o ElevenLabs (TTS) en el futuro no debe
  tocar ni la UI ni el agente. Documentar en el código cómo se enchufaría un
  provider alternativo.
* El AGENTE no sabe que existe la voz: recibe texto, devuelve texto. La voz es
  transporte. (Esta frase va como comentario de cabecera del orquestador.)

---

# FASES

## Fase 8.1 — Capa de abstracción de voz (`lib/voice/`)

**Prompt sugerido:** "Ejecuta la Fase 8.1 de `MercadoTech_sesion8.md`."

1. `lib/voice/types.ts` — la interfaz:

```ts
interface SttProvider {
  isSupported(): boolean
  start(opts: { lang: string; onPartial?: (text: string) => void }): void
  stop(): Promise<string>          // transcripción final
  abort(): void
}
interface TtsProvider {
  isSupported(): boolean
  speak(text: string, opts?: { lang?: string; rate?: number }): Promise<void>
  cancel(): void
}
```

2. `lib/voice/web-speech-stt.ts` y `lib/voice/web-speech-tts.ts` —
   implementaciones con Web Speech API: manejo de permisos de micrófono
   denegados (error tipado, no excepción sin catch), resultados parciales para
   transcripción en vivo, selección de voz es-* disponible, troceo de textos
   largos para `speechSynthesis` (se corta ~200+ chars en algunos motores).
3. `lib/constants/voice.ts`: idioma default, rate, timeout de escucha (ej. 8 s
   de silencio corta), longitud máxima de respuesta hablada.
4. `hooks/useVoice.ts` — máquina de estados de UI:
   `idle → listening → processing → speaking → idle`, con `error` transversal.
   Expone: `state`, `partialTranscript`, `startListening`, `stopListening`,
   `speak`, `cancel`, `isVoiceSupported`. NO llama al agente — eso lo compone
   la página (independencia: useVoice sirve para cualquier feature de voz futura).

## Fase 8.2 — Tickets y orquestador del agente

**Prompt sugerido:** "Ejecuta la Fase 8.2 de `MercadoTech_sesion8.md`."

1. `services/ticket.service.ts`: `createTicket(subject, firstMessage, channel)`,
   `listMyTickets`, `getTicketWithMessages`, `addMessage`, `closeTicket`.
   (RLS de la sesión 2 ya cubre la seguridad.)
2. `services/support-agent.service.ts` — el ORQUESTADOR. Solo servidor
   (usa `lib/ai/completion`). Flujo por turno:

   a. **Detección de intención** con el LLM (prompt de clasificación en
      `lib/ai/prompts.ts`, salida forzada a una etiqueta):
      `consulta_pedido | pregunta_faq | crear_reclamo | hablar_humano | fuera_de_alcance`.

   b. **Herramientas** (funciones internas que REUTILIZAN services existentes —
      el agente no toca Supabase directo):
      * `consulta_pedido` → extrae el nº de pedido del texto (o pide el dato si
        falta) → `order.service.getOrderById` con el cliente de SESIÓN (RLS: solo
        pedidos propios) → respuesta con estado, ítems y fecha.
      * `pregunta_faq` → pipeline RAG de la sesión 4 (`chat.service.ask` modo
        soporte) → respuesta con fuentes.
      * `crear_reclamo` → PRIMERO propone el resumen del ticket y PIDE
        confirmación ("¿Confirmas que cree el reclamo con este resumen?"); solo
        ante confirmación del siguiente turno llama a `ticket.service.createTicket`
        con `channel: 'voz'` (o 'chat').
      * `hablar_humano` → crea ticket marcado para escalamiento y responde el
        tiempo estimado (dato de FAQ).
      * `fuera_de_alcance` → lo dice honestamente y reencuadra qué sí puede hacer.

   c. **Estado conversacional**: el turno recibe el historial resumido (los
      últimos N mensajes) para resolver referencias ("¿y el otro pedido?") y las
      confirmaciones pendientes.

   d. **Guardrails escritos en el prompt de sistema**: nunca inventar pedidos ni
      montos; nunca prometer reembolsos (eso lo decide un humano); respuestas
      CORTAS y hablables (máx. ~2 frases + una pregunta); siempre en español.

3. Route Handler `POST /api/v1/support-agent`: sesión requerida; body
   `{message, history}`; responde `{reply, intent, action?: {type, ticketId?},
   sources?}`. Log estructurado de intenciones (observabilidad del agente).
4. `types/support.ts`: tipos del turno, intenciones, acciones.

## Fase 8.3 — Centro de soporte con voz (UI)

**Prompt sugerido:** "Ejecuta la Fase 8.3 de `MercadoTech_sesion8.md`."

1. Ampliar `(shop)/soporte/page.tsx` componiendo `useVoice` + `useSupportAgent`
   (hook nuevo que llama al endpoint del agente y mantiene el historial):
   * `VoiceButton` — push-to-talk (mantener presionado o toggle): estados
     visuales claros (escuchando con animación de onda, procesando, hablando);
     deshabilitado con tooltip si `!isVoiceSupported`.
   * `LiveTranscript` — transcripción parcial en vivo mientras el usuario habla.
   * La conversación reutiliza los componentes `components/chat/` de la sesión 4
     (los mensajes del agente muestran fuentes cuando la intención fue FAQ, y
     un card de "Ticket #123 creado" cuando hubo acción).
   * Cada respuesta del agente se REPRODUCE por TTS (con botón para silenciar/
     repetir) y siempre se muestra escrita.
2. **Accesibilidad y paridad**: todo lo que se puede hacer por voz se puede
   hacer por texto en la misma pantalla (el `ChatInput` sigue presente). La voz
   es un acelerador, no un requisito.
3. Sección "Mis tickets" (lista + detalle con mensajes) en la misma página o
   ruta anidada `soporte/tickets/[id]`.
4. Indicador de privacidad: puntito/badge "micrófono activo" mientras escucha,
   y el micrófono SOLO se activa por gesto explícito del usuario (nunca auto-start).

## Fase 8.4 — Integración final y pulido

**Prompt sugerido:** "Ejecuta la Fase 8.4 de `MercadoTech_sesion8.md`."

1. Recorrido completo de TODOS los flujos (comprador, vendedor, asistentes,
   agente de voz) con datos frescos del seed + productos creados a mano.
2. Correr el ciclo de calidad completo de la sesión 6: unit + E2E verdes.
3. Agregar tests de la sesión 8: unit del orquestador (intención mockeada →
   herramienta correcta llamada; confirmación requerida antes de crear ticket)
   y E2E del centro de soporte EN MODO TEXTO (la voz no se automatiza en CI;
   documentar el porqué: permisos de micrófono y APIs no disponibles headless).
4. Correr las 4 Skills de la sesión 5 sobre el código nuevo (`lib/voice/`,
   orquestador, UI de soporte); corregir hallazgos; cerrar con validator APROBADO.
5. Verificación de independencia (grep): `lib/voice/` no importa services ni
   IA; el orquestador no importa nada de `lib/voice/` ni de React; la UI no
   importa `lib/ai/`.
6. Deploy a producción (pipeline sesión 7) y smoke test que incluya el agente.

## Fase 8.5 — Demo y roadmap

**Prompt sugerido:** "Ejecuta la Fase 8.5 de `MercadoTech_sesion8.md`."

1. `docs/DEMO.md` — guion de 10 minutos, con URL, usuarios y datos EXACTOS:
   * (1 min) Qué es MercadoTech + arquitectura en una lámina (capas).
   * (2 min) Flujo comprador: buscar semánticamente → detalle → carrito → checkout.
   * (2 min) Flujo vendedor: publicar con galería drag & drop → kanban de pedidos.
   * (1 min) Asesor de compras RAG con fuentes navegables.
   * (3 min) **Clímax: agente de voz** — preguntar por un pedido hablando,
     hacer una pregunta de FAQ, crear un reclamo con confirmación por voz.
   * (1 min) Bajo el capó: CI verde, tests, Skills, servidor MCP en el Inspector.
   * Plan B por si el demo-god falla: video corto pregrabado del flujo de voz +
     entorno local como respaldo del deploy.
2. `docs/ROADMAP.md` — siguientes pasos con esfuerzo estimado (S/M/L):
   * Pagos reales (Stripe/Culqi) + webhooks de confirmación.
   * STT/TTS de calidad producción (Whisper server-side, ElevenLabs) — solo
     tocar `lib/voice/` gracias a la interfaz.
   * Streaming de respuestas del chat y del TTS.
   * Chunking real de documentos largos en el RAG (la tabla ya tiene `chunk_index`).
   * Agente de vendedor (responder preguntas borrador, reponer stock).
   * Notificaciones (email/push) de cambios de estado de pedido.
   * App móvil (React Native/Expo) reutilizando services vía API.
   * APIs híbridas: exponer el MCP como API pública autenticada.
3. Retrospectiva del curso en `docs/COSTOS.md`: cerrar el registro de gasto por
   sesión y anotar qué estrategia de modelos funcionó mejor.

---

## Restricciones de la sesión

* La voz NUNCA ejecuta acciones con efectos sin confirmación explícita
  (crear ticket, escalar). Consultar estado de pedido sí es directo (solo lectura).
* El agente solo accede a datos del usuario autenticado (cliente de sesión + RLS).
* Sin proveedores de voz de pago en esta fase (la interfaz queda lista para ellos).
* El micrófono solo se activa por gesto del usuario; nada de escucha continua.
* No agregar features fuera de este documento — el tiempo restante es para la demo.

## Entregables

1. `lib/voice/` completo (interfaces + implementación Web Speech + constantes).
2. `ticket.service`, `support-agent.service` (orquestador) y su endpoint.
3. Centro de soporte con voz, accesible y con paridad texto/voz.
4. Tests del orquestador + E2E de soporte en modo texto.
5. Deploy final en producción con smoke test.
6. `docs/DEMO.md` + `docs/ROADMAP.md` + retrospectiva de costos.

## Criterios de aceptación de la sesión

* En Chrome: hablar "¿en qué estado está mi pedido …?" devuelve el estado real
  del pedido del usuario, hablado y escrito.
* Crear un reclamo por voz exige y respeta la confirmación; el ticket aparece
  en "Mis tickets" con `channel: 'voz'`.
* En Firefox (sin SpeechRecognition): la misma página funciona 100% por texto.
* Todo el ciclo de calidad (lint, type-check, unit, E2E, Skills, CI) verde.
* Demo ejecutable de principio a fin siguiendo `docs/DEMO.md` sin improvisar.
