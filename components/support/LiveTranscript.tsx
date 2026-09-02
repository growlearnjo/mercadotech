import { Mic } from "lucide-react";

type LiveTranscriptProps = {
  /** Texto provisional; cambia solo mientras la persona habla. */
  text: string;
  listening: boolean;
};

/**
 * Lo que se va entendiendo mientras el usuario habla (Fase 8.3).
 *
 * POR QUÉ EXISTE: sin esto, dictar es hablarle a una pantalla quieta. Nadie
 * sabe si el micrófono lo está oyendo, así que la gente sube la voz, repite o
 * se calla a media frase. Ver aparecer las palabras es la única señal de que
 * la escucha funciona.
 *
 * Va en cursiva y apagado a propósito: el texto es TENTATIVO —el reconocedor
 * lo corrige solo sobre la marcha— y no debe parecer un mensaje ya enviado.
 *
 * `aria-live="polite"` lo anuncia a lectores de pantalla sin interrumpir lo
 * que estén leyendo.
 */
export function LiveTranscript({ text, listening }: LiveTranscriptProps) {
  if (!listening && !text) return null;

  return (
    <div
      className="flex items-start gap-2 rounded-md bg-muted px-3 py-2"
      role="status"
      aria-live="polite"
      data-testid="live-transcript"
    >
      <Mic className="mt-0.5 size-4 shrink-0 animate-pulse text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground italic">
        {text || "Escuchando… habla y pulsa el botón para enviar."}
      </p>
    </div>
  );
}
