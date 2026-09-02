/**
 * Síntesis de voz con `speechSynthesis` (Fase 8.1).
 *
 * Implementa `TtsProvider`. A diferencia del reconocimiento, esta mitad de la
 * Web Speech API sí está en todos los navegadores modernos y funciona sin
 * conexión, con las voces instaladas en el sistema operativo.
 *
 * DOS RAREZAS QUE OBLIGAN A ESCRIBIR MÁS CÓDIGO DEL ESPERADO:
 *
 * 1. `getVoices()` suele devolver una lista VACÍA la primera vez: el navegador
 *    las carga de forma asíncrona y avisa después por `onvoiceschanged`. Pedir
 *    la voz en español sin esperar termina hablando en inglés.
 * 2. Con textos largos, varios motores se callan a media frase sin lanzar
 *    ningún error. Por eso el texto se trocea (`TTS_CHUNK_MAX_CHARS`) y se
 *    encolan las partes.
 */

import type { TtsProvider, TtsSpeakOptions } from "@/lib/voice/types";
import {
  TTS_CHUNK_MAX_CHARS,
  VOICE_LANG_DEFAULT,
  VOICE_LANG_FALLBACK_PREFIX,
  VOICE_RATE,
} from "@/lib/constants/voice";

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Espera a que el navegador termine de cargar la lista de voces. */
async function obtenerVoces(): Promise<SpeechSynthesisVoice[]> {
  const voces = window.speechSynthesis.getVoices();
  if (voces.length > 0) return voces;

  return new Promise((resolve) => {
    // Red de seguridad: si `onvoiceschanged` no llega (pasa en algunos
    // navegadores), se sigue igual con lo que haya. Hablar con la voz por
    // defecto es mejor que no hablar.
    const plazo = setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1_000);
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(plazo);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

/** La variante exacta si existe; si no, cualquier voz en español. */
function elegirVoz(
  voces: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | undefined {
  return (
    voces.find((v) => v.lang.replace("_", "-") === lang) ??
    voces.find((v) => v.lang.toLowerCase().startsWith(VOICE_LANG_FALLBACK_PREFIX))
  );
}

/**
 * Parte el texto en trozos que quepan en el límite, cortando por frases.
 *
 * Se corta en el punto y no a mitad de palabra porque el motor hace una pausa
 * natural entre trozos: partir por la mitad de una frase suena a tartamudeo.
 */
function trocear(texto: string): string[] {
  const limpio = texto.trim();
  if (limpio.length <= TTS_CHUNK_MAX_CHARS) return limpio ? [limpio] : [];

  const frases = limpio.match(/[^.!?]+[.!?]*\s*/g) ?? [limpio];
  const trozos: string[] = [];
  let actual = "";

  for (const frase of frases) {
    if ((actual + frase).length > TTS_CHUNK_MAX_CHARS && actual) {
      trozos.push(actual.trim());
      actual = "";
    }
    // Una sola frase más larga que el límite se parte por palabras: raro, pero
    // un solo párrafo sin puntos volvería a disparar el corte silencioso.
    if (frase.length > TTS_CHUNK_MAX_CHARS) {
      for (const palabra of frase.split(" ")) {
        if ((actual + " " + palabra).length > TTS_CHUNK_MAX_CHARS && actual) {
          trozos.push(actual.trim());
          actual = "";
        }
        actual += (actual ? " " : "") + palabra;
      }
    } else {
      actual += frase;
    }
  }

  if (actual.trim()) trozos.push(actual.trim());
  return trozos;
}

export function createWebSpeechTts(): TtsProvider {
  let cancelado = false;

  return {
    isSupported,

    async speak(text: string, options: TtsSpeakOptions = {}) {
      if (!isSupported()) return;

      const trozos = trocear(text);
      if (trozos.length === 0) return;

      cancelado = false;
      const lang = options.lang ?? VOICE_LANG_DEFAULT;
      const voz = elegirVoz(await obtenerVoces(), lang);

      // Nunca se encola sobre lo anterior: si llega una respuesta nueva, manda
      // la nueva. Encolar dejaría al asistente contestando preguntas viejas.
      window.speechSynthesis.cancel();

      for (const trozo of trozos) {
        if (cancelado) return;
        await new Promise<void>((resolve) => {
          const frase = new SpeechSynthesisUtterance(trozo);
          frase.lang = lang;
          frase.rate = options.rate ?? VOICE_RATE;
          if (voz) frase.voice = voz;
          // Se resuelve igual ante error: un trozo que no se pudo pronunciar
          // no debe dejar colgada la promesa ni bloquear el resto.
          frase.onend = () => resolve();
          frase.onerror = () => resolve();
          window.speechSynthesis.speak(frase);
        });
      }
    },

    cancel() {
      cancelado = true;
      if (isSupported()) window.speechSynthesis.cancel();
    },
  };
}
