// Tunables de la capa de voz (sesión 8). Regla 5 del CLAUDE.md: todo valor
// ajustable vive aquí y lleva un comentario que justifica su elección.

/**
 * Idioma de reconocimiento y de síntesis.
 *
 * `es-PE` y no `es` a secas porque el catálogo, los precios y la FAQ son
 * peruanos: el reconocedor acierta más con "soles", "provincia" o "Miraflores"
 * cuando sabe la variante. Si el navegador no tiene esa voz instalada, el TTS
 * cae al primer `es-*` disponible (ver `web-speech-tts.ts`), así que no hay
 * riesgo de quedarse mudo por pedir demasiado.
 */
export const VOICE_LANG_DEFAULT = "es-PE";

/** Prefijo aceptable cuando no existe la variante exacta. */
export const VOICE_LANG_FALLBACK_PREFIX = "es";

/**
 * Velocidad de lectura (1 = normal).
 *
 * 1.05 apenas por encima: las voces del sistema en español suenan algo
 * pausadas para leer respuestas de soporte, y acelerarlas más empieza a
 * atropellar los números de pedido y los precios, que es justo lo que el
 * usuario necesita entender bien.
 */
export const VOICE_RATE = 1.05;

/**
 * Silencio máximo antes de cortar la escucha, en milisegundos.
 *
 * Con el micrófono en modo interruptor —una pulsación abre, otra cierra y
 * envía— esto no es un adorno: si el usuario se distrae y nunca pulsa la
 * segunda vez, el micrófono se quedaría abierto indefinidamente. Al cumplirse
 * el plazo se cierra solo y se envía lo que se haya entendido, que es lo que
 * el usuario esperaría.
 *
 * 8 s es holgado para las pausas naturales a mitad de frase (pensar el nombre
 * de un producto, dudar) y corto para que un olvido no deje el micrófono vivo.
 */
export const LISTEN_TIMEOUT_MS = 8_000;

/**
 * Tamaño máximo de cada trozo que se manda a `speechSynthesis`.
 *
 * Varios motores (notablemente el de Chrome en Windows) se callan a mitad de
 * un texto largo sin lanzar ningún error: simplemente dejan de hablar. Trocear
 * por debajo de ese umbral lo evita. 200 caracteres es una o dos frases, que
 * además es donde conviene respirar al leer en voz alta.
 */
export const TTS_CHUNK_MAX_CHARS = 200;
