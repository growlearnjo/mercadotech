/**
 * Reconocimiento de voz con la Web Speech API del navegador (Fase 8.1).
 *
 * Implementa `SttProvider`. Es la única pieza del proyecto que sabe que existe
 * `SpeechRecognition`; cambiarla por Whisper sería escribir otro archivo en
 * esta carpeta con el mismo contrato.
 *
 * DOS COSAS QUE SORPRENDEN DE ESTA API:
 *
 * 1. En Chrome NO transcribe en tu máquina: manda el audio a un servicio de
 *    Google. Por eso puede fallar con `network` aunque el micrófono ande
 *    perfecto, y por eso no sirve sin conexión.
 * 2. Solo funciona en CONTEXTO SEGURO: `https` o `localhost`. En un `http`
 *    cualquiera el navegador ni pide permiso, simplemente no ocurre nada.
 */

import {
  VoiceError,
  type SpeechRecognitionLike,
  type SttProvider,
  type SttStartOptions,
} from "@/lib/voice/types";
import {
  LISTEN_TIMEOUT_MS,
  VOICE_LANG_DEFAULT,
} from "@/lib/constants/voice";

function getConstructor() {
  if (typeof window === "undefined") return undefined;
  // `webkit` primero por compatibilidad: Chrome y Edge aún exponen el
  // prefijado, y algunas versiones solo ese.
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/** Traduce el código crudo del navegador al motivo tipado y su mensaje. */
function traducirError(codigo: string): VoiceError {
  switch (codigo) {
    case "not-allowed":
    case "service-not-allowed":
      return new VoiceError(
        "permission-denied",
        "No diste permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo.",
      );
    case "no-speech":
      return new VoiceError(
        "no-speech",
        "No se escuchó nada. Acércate al micrófono e inténtalo otra vez.",
      );
    case "network":
      return new VoiceError(
        "network",
        "El reconocimiento de voz necesita conexión a internet. Revisa tu red e inténtalo de nuevo.",
      );
    case "aborted":
      return new VoiceError("aborted", "Se canceló la grabación.");
    case "audio-capture":
      return new VoiceError(
        "permission-denied",
        "No se encontró ningún micrófono disponible.",
      );
    default:
      return new VoiceError(
        "unknown",
        "No se pudo usar el micrófono. Puedes escribir tu mensaje.",
      );
  }
}

export function createWebSpeechStt(): SttProvider {
  let recognition: SpeechRecognitionLike | null = null;
  /** Texto ya confirmado por el motor; se acumula entre pausas. */
  let textoFinal = "";
  /** Se resuelve cuando el motor confirma que cerró el micrófono. */
  let resolverParada: ((texto: string) => void) | null = null;
  let errorPendiente: VoiceError | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  /**
   * La sesión ya terminó, la haya parado el usuario o el propio motor.
   *
   * Hace falta porque con el permiso denegado el navegador dispara `onend`
   * INMEDIATAMENTE, antes de que nadie llame a `stop()`. Sin esta marca, ese
   * `onend` se perdía y el `stop()` posterior esperaba un evento que ya había
   * pasado: la promesa no resolvía nunca y la interfaz se quedaba congelada en
   * "procesando", sin error y sin texto.
   */
  let sesionTerminada = false;

  function limpiarTemporizador() {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  }

  return {
    isSupported: () => getConstructor() !== undefined,

    start(options: SttStartOptions = {}) {
      const Constructor = getConstructor();
      if (!Constructor) {
        return Promise.reject(
          new VoiceError(
            "not-supported",
            "Este navegador no reconoce voz. Firefox todavía no lo soporta: puedes escribir tu mensaje.",
          ),
        );
      }

      // Si quedó una sesión viva (doble clic, re-render), se corta antes de
      // abrir otra: dos reconocedores a la vez se pisan y el segundo falla.
      recognition?.abort();
      textoFinal = "";
      errorPendiente = null;
      sesionTerminada = false;

      const rec = new Constructor();
      rec.lang = options.lang ?? VOICE_LANG_DEFAULT;
      // `continuous`: el usuario decide cuándo termina, no el motor. Sin esto
      // se cerraría solo en la primera pausa, a media frase.
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        let parcial = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const resultado = event.results[i];
          const texto = resultado[0]?.transcript ?? "";
          if (resultado.isFinal) textoFinal += texto;
          else parcial += texto;
        }
        // Cada palabra reconocida reinicia el plazo: el temporizador mide
        // SILENCIO, no duración total de la grabación.
        reiniciarTemporizador();
        options.onPartial?.((textoFinal + parcial).trim());
      };

      rec.onerror = (event) => {
        const error = traducirError(event.error);
        // `no-speech` no es un fallo si ya se había entendido algo antes: el
        // usuario simplemente terminó de hablar.
        if (error.code === "no-speech" && textoFinal.trim()) return;
        errorPendiente = error;
        // Se avisa en el acto: los fallos de permiso ocurren antes de que el
        // micrófono se abra, y esperar a `stop()` dejaría a la interfaz
        // anunciando una escucha que no existe.
        options.onError?.(error);
      };

      rec.onend = () => {
        limpiarTemporizador();
        sesionTerminada = true;
        resolverParada?.(textoFinal.trim());
        resolverParada = null;
      };

      function reiniciarTemporizador() {
        limpiarTemporizador();
        temporizador = setTimeout(() => rec.stop(), LISTEN_TIMEOUT_MS);
      }

      recognition = rec;

      return new Promise<void>((resolve, reject) => {
        try {
          rec.start();
          reiniciarTemporizador();
          // `start()` no espera al permiso: el navegador lo pide en paralelo y
          // si lo deniegan avisa por `onerror`, que ya llama a `onError`.
          resolve();
        } catch {
          reject(
            new VoiceError(
              "unknown",
              "No se pudo iniciar el micrófono. Inténtalo de nuevo.",
            ),
          );
        }
      });
    },

    stop() {
      const rec = recognition;
      if (!rec) return Promise.resolve("");

      /** Entrega el resultado: el error manda sobre el texto. */
      function entregar(
        texto: string,
        resolve: (v: string) => void,
        reject: (e: VoiceError) => void,
      ) {
        recognition = null;
        if (errorPendiente) {
          const error = errorPendiente;
          errorPendiente = null;
          reject(error);
          return;
        }
        resolve(texto);
      }

      return new Promise<string>((resolve, reject) => {
        // Si el motor ya cerró por su cuenta —permiso denegado, silencio, fin
        // del plazo—, no hay ningún `onend` que esperar: se responde con lo que
        // haya. Esperarlo dejaba la promesa colgada para siempre.
        if (sesionTerminada) {
          entregar(textoFinal.trim(), resolve, reject);
          return;
        }
        resolverParada = (texto) => entregar(texto, resolve, reject);
        rec.stop();
      });
    },

    abort() {
      limpiarTemporizador();
      resolverParada = null;
      errorPendiente = null;
      sesionTerminada = false;
      textoFinal = "";
      recognition?.abort();
      recognition = null;
    },
  };
}
