"use client";

/**
 * Estado de la voz en el navegador (Fase 8.1).
 *
 * ES EL ÚNICO ARCHIVO QUE IMPORTA `lib/voice/`. Los componentes reciben de
 * aquí estado y callbacks; ninguno toca la Web Speech API directamente. Es la
 * misma regla que ya cumple `lib/ai/` —una sola puerta de entrada—, con una
 * diferencia: la IA se aísla detrás de un Route Handler porque su clave es un
 * secreto, mientras que la voz corre forzosamente en el navegador y su puerta
 * es este hook.
 *
 * NO LLAMA AL AGENTE, A PROPÓSITO. Convierte voz en texto y texto en voz, nada
 * más. Quien une la voz con el agente es la PÁGINA, que es el único sitio
 * donde un hook se encuentra con otro (regla de la sesión 3). Gracias a eso,
 * el mismo hook sirve para dictar en un buscador o leer una descripción.
 */

import * as React from "react";

import { VOICE_LANG_DEFAULT } from "@/lib/constants/voice";
import { createWebSpeechStt } from "@/lib/voice/web-speech-stt";
import { createWebSpeechTts } from "@/lib/voice/web-speech-tts";
import { VoiceError } from "@/lib/voice/types";
import type { VoiceState } from "@/types/voice";

// El tipo vive en types/voice.ts porque VoiceButton también lo necesita y un
// componente no puede importar de hooks/ (regla del CLAUDE.md). Se reexporta
// para que quien use el hook no tenga que ir a buscarlo a otro archivo.
export type { VoiceState };

export type UseVoiceResult = {
  state: VoiceState;
  /** Lo que se va entendiendo mientras el usuario habla. Se vacía al terminar. */
  partialTranscript: string;
  /** Mensaje ya redactado para mostrar; `null` si no hay error. */
  error: string | null;
  /** `false` en Firefox: la página debe seguir funcionando por teclado. */
  isVoiceSupported: boolean;
  /** Primera pulsación: abre el micrófono. */
  startListening: () => Promise<void>;
  /** Segunda pulsación: cierra y devuelve lo transcrito (`""` si no se entendió). */
  stopListening: () => Promise<string>;
  speak: (text: string) => Promise<void>;
  /** Corta micrófono y voz. Obligatorio al desmontar. */
  cancel: () => void;
};

export function useVoice(lang: string = VOICE_LANG_DEFAULT): UseVoiceResult {
  // Los proveedores se crean una sola vez y con `useRef`: tocan `window`, así
  // que no pueden construirse durante el render del servidor.
  const sttRef = React.useRef<ReturnType<typeof createWebSpeechStt> | null>(null);
  const ttsRef = React.useRef<ReturnType<typeof createWebSpeechTts> | null>(null);

  const getStt = React.useCallback(() => {
    sttRef.current ??= createWebSpeechStt();
    return sttRef.current;
  }, []);
  const getTts = React.useCallback(() => {
    ttsRef.current ??= createWebSpeechTts();
    return ttsRef.current;
  }, []);

  const [state, setState] = React.useState<VoiceState>("idle");
  const [partialTranscript, setPartial] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isVoiceSupported, setSupported] = React.useState(false);

  // El soporte se resuelve tras montar, no durante el render: en el servidor no
  // existe `window`, y decidirlo allí haría que el HTML y el navegador
  // discrepen (error de hidratación).
  React.useEffect(() => {
    setSupported(getStt().isSupported());
  }, [getStt]);

  const fallar = React.useCallback((err: unknown) => {
    const mensaje =
      err instanceof VoiceError
        ? err.message
        : "Algo falló con el micrófono. Puedes escribir tu mensaje.";
    setError(mensaje);
    setState("error");
    setPartial("");
  }, []);

  const startListening = React.useCallback(async () => {
    setError(null);
    setPartial("");
    try {
      // Si el asistente estaba hablando, se calla: nadie quiere que el
      // micrófono grabe la voz del propio asistente.
      getTts().cancel();
      setState("listening");
      await getStt().start({
        lang,
        onPartial: setPartial,
        // El permiso se deniega DESPUÉS de que `start()` haya vuelto, así que
        // el aviso llega por aquí: sin esto la interfaz se quedaba diciendo
        // "escuchando" con el micrófono cerrado.
        onError: fallar,
      });
    } catch (err) {
      fallar(err);
    }
  }, [getStt, getTts, lang, fallar]);

  const stopListening = React.useCallback(async () => {
    try {
      setState("processing");
      const texto = await getStt().stop();
      setPartial("");
      // Se queda en `processing`: quien llamó va a hacer algo con el texto
      // (preguntarle al agente) y la interfaz debe seguir mostrando que
      // trabaja. Vuelve a `idle` cuando llegue `speak()` o `cancel()`.
      return texto;
    } catch (err) {
      fallar(err);
      return "";
    }
  }, [getStt, fallar]);

  const speak = React.useCallback(
    async (text: string) => {
      try {
        setState("speaking");
        await getTts().speak(text, { lang });
        // `cancel()` deja el estado en otro sitio a propósito: solo se vuelve a
        // `idle` si nadie interrumpió mientras hablaba.
        setState((actual) => (actual === "speaking" ? "idle" : actual));
      } catch (err) {
        fallar(err);
      }
    },
    [getTts, lang, fallar],
  );

  const cancel = React.useCallback(() => {
    getStt().abort();
    getTts().cancel();
    setPartial("");
    setError(null);
    setState("idle");
  }, [getStt, getTts]);

  // Al salir de la página se corta todo. Sin esto, el asistente sigue hablando
  // solo mientras el usuario navega por el catálogo, y el micrófono puede
  // quedarse abierto sin ningún indicador en pantalla.
  React.useEffect(() => {
    return () => {
      sttRef.current?.abort();
      ttsRef.current?.cancel();
    };
  }, []);

  return {
    state,
    partialTranscript,
    error,
    isVoiceSupported,
    startListening,
    stopListening,
    speak,
    cancel,
  };
}
