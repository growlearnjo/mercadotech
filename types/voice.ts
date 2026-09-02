// Tipos de la capa de voz que necesita la INTERFAZ (sesión 8).
//
// POR QUÉ VIVE AQUÍ Y NO EN `hooks/useVoice.ts`, donde se usa: porque
// `VoiceButton` tiene que tiparse con él, y la regla del CLAUDE.md es que un
// componente no dependa de un hook. Tampoco puede venir de `lib/voice/`: esa
// carpeta es la implementación y ningún componente la importa.
//
// `types/` es el terreno neutral donde ambos lados pueden encontrarse.

/**
 * Los cinco modos de la voz en el navegador.
 *
 * Es UN estado y no varios booleanos porque son mutuamente excluyentes: si el
 * asistente está hablando no puede estar escuchando, o se oiría a sí mismo.
 *
 *   idle ──abrir micrófono──> listening ──cerrar──> processing
 *    ▲                                                  │
 *    └────────── speaking <──── leer respuesta ─────────┘
 *
 * `error` es transversal: se puede llegar desde cualquiera de los otros.
 */
export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";
