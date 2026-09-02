/**
 * Contrato de la capa de voz (sesión 8, Fase 8.1).
 *
 * QUÉ HACE ESTE ARCHIVO: describe QUÉ sabe hacer un proveedor de voz, sin
 * decir QUIÉN lo hace. Hoy lo implementa la Web Speech API del navegador
 * (`web-speech-stt.ts` y `web-speech-tts.ts`), gratis y sin servidores.
 *
 * POR QUÉ NO SE LLAMA AL NAVEGADOR DIRECTAMENTE DESDE LA UI: para poder
 * cambiar de proveedor sin tocar nada más. Enchufar mañana Whisper para
 * transcribir (mejor precisión, coste por minuto) o ElevenLabs para hablar
 * (voz mucho más natural) sería escribir un archivo nuevo en esta carpeta que
 * cumpla estas mismas interfaces; ni la pantalla ni el agente se enterarían.
 * Un proveedor de servidor, además, encaja sin rediseño: `stop()` ya devuelve
 * una promesa, así que puede tardar lo que tarde una llamada de red.
 *
 * REGLAS DE DEPENDENCIA (verificadas con grep en la Fase 8.4):
 *   · `lib/voice/` NO importa React, ni `services/`, ni `lib/ai/`. Es una capa
 *     de entrada/salida y no sabe qué es un agente, un pedido ni una FAQ.
 *   · Ningún componente importa `lib/voice/`. La cadena sancionada es
 *     componente → `hooks/useVoice.ts` → `lib/voice/`.
 */

/**
 * Motivos por los que la voz puede fallar.
 *
 * Se tipan en vez de dejar sueltas las excepciones del navegador porque cada
 * uno tiene una salida distinta PARA EL USUARIO, y la UI necesita distinguir:
 * "no hay permiso" se arregla en la barra del navegador, "no se te escuchó" se
 * arregla repitiendo, y "este navegador no puede" no se arregla — se escribe.
 */
export type VoiceErrorCode =
  /** El navegador no trae la capacidad (Firefox no tiene reconocimiento). */
  | "not-supported"
  /** El usuario denegó el micrófono, o la página no está en https/localhost. */
  | "permission-denied"
  /** Se escuchó silencio: no hay nada que transcribir. */
  | "no-speech"
  /** El STT de Chrome viaja a un servicio en línea y no hubo conexión. */
  | "network"
  /** Se canceló a propósito (cambio de página, botón de parar). */
  | "aborted"
  | "unknown";

/** Error de voz con motivo legible y mensaje ya redactado para mostrar. */
export class VoiceError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

export type SttStartOptions = {
  /** Código BCP-47, por ejemplo `es-PE`. */
  lang?: string;
  /**
   * Se llama con la transcripción PROVISIONAL mientras el usuario habla.
   *
   * Existe para que la pantalla muestre las palabras apareciendo en vivo: sin
   * esa señal, el usuario no sabe si el micrófono lo está oyendo y termina
   * hablándole más fuerte a una pantalla quieta. El texto es tentativo y
   * cambia solo; el definitivo lo devuelve `stop()`.
   */
  onPartial?: (texto: string) => void;
  /**
   * Se llama en cuanto el motor falla, sin esperar a `stop()`.
   *
   * Existe porque los fallos más comunes —permiso denegado, sin micrófono— se
   * producen ANTES de que el micrófono llegue a abrirse. Sin esta señal, la
   * interfaz se quedaría anunciando "escuchando" a un micrófono que nunca se
   * encendió, y el usuario hablaría a la nada hasta pulsar "detener".
   */
  onError?: (error: VoiceError) => void;
};

/** Convierte voz en texto. */
export type SttProvider = {
  /** `false` en Firefox y en navegadores sin la API. Se consulta ANTES de ofrecer el botón. */
  isSupported: () => boolean;
  /** Abre el micrófono. Lanza `VoiceError` si no hay permiso o soporte. */
  start: (options?: SttStartOptions) => Promise<void>;
  /** Cierra el micrófono y devuelve la transcripción final (`""` si no se entendió nada). */
  stop: () => Promise<string>;
  /** Corta sin devolver nada: para desmontajes y cancelaciones. */
  abort: () => void;
};

export type TtsSpeakOptions = {
  lang?: string;
  /** 1 = velocidad normal. */
  rate?: number;
};

/** Convierte texto en voz. */
export type TtsProvider = {
  isSupported: () => boolean;
  /** Resuelve cuando termina de hablar, para poder encadenar estados. */
  speak: (text: string, options?: TtsSpeakOptions) => Promise<void>;
  /** Calla de inmediato. Obligatorio al salir de la página. */
  cancel: () => void;
};

/* ------------------------------------------------------------------ *
 * Declaraciones de la Web Speech API
 * ------------------------------------------------------------------ *
 * TypeScript no incluye `SpeechRecognition` en su `lib.dom`: la API está en
 * estado de borrador y solo la implementan navegadores basados en Chromium,
 * con el prefijo `webkit`. Se declara aquí lo MÍNIMO que este proyecto usa —no
 * la especificación entera— para no añadir dependencias solo por unos tipos.
 *
 * `speechSynthesis` (la mitad de salida) SÍ está en `lib.dom` y no necesita
 * nada de esto.
 * ------------------------------------------------------------------ */

export type SpeechRecognitionAlternative = {
  readonly transcript: string;
  readonly confidence: number;
};

export type SpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternative;
};

export type SpeechRecognitionResultList = {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
};

export type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
};

export type SpeechRecognitionErrorEventLike = Event & {
  /** "not-allowed", "no-speech", "network", "aborted", "audio-capture"… */
  readonly error: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  /** `true` para no cortar en la primera pausa: el usuario decide cuándo termina. */
  continuous: boolean;
  /** `true` para recibir texto provisional mientras se habla. */
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
