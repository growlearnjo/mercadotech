"use client";

import { Loader2, Mic, MicOff, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoiceState } from "@/types/voice";

type VoiceButtonProps = {
  state: VoiceState;
  /** `false` en Firefox y navegadores sin reconocimiento de voz. */
  supported: boolean;
  /** Una pulsación abre el micrófono, la siguiente cierra y envía. */
  onToggle: () => void;
};

/**
 * Botón de micrófono del centro de soporte (Fase 8.3).
 *
 * PURO: recibe el estado y un callback, no sabe qué es `useVoice` ni el
 * agente. Se limita a traducir la máquina de estados a algo que se ve.
 *
 * FUNCIONA COMO INTERRUPTOR, no manteniendo pulsado: una pulsación graba, otra
 * envía. Se eligió así porque dictar una consulta de soporte lleva su tiempo
 * —hay que pensar qué pedido era, cómo explicar el problema— y sostener el
 * dedo durante toda la frase cansa y se suelta sin querer a media palabra.
 *
 * MIENTRAS ESCUCHA SIEMPRE HAY UN INDICADOR VISIBLE. No es decoración: un
 * micrófono abierto sin señal en pantalla es exactamente lo que la gente teme
 * de una web que pide permiso de micrófono.
 */
export function VoiceButton({ state, supported, onToggle }: VoiceButtonProps) {
  if (!supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        aria-label="Este navegador no reconoce voz. Escribe tu mensaje."
        title="Tu navegador no reconoce voz (Firefox aún no lo soporta). Puedes escribir tu mensaje."
        data-testid="voice-button"
      >
        <MicOff className="size-4" aria-hidden="true" />
      </Button>
    );
  }

  const escuchando = state === "listening";
  const ocupado = state === "processing" || state === "speaking";

  const etiqueta = escuchando
    ? "Terminar de hablar y enviar"
    : state === "processing"
      ? "Procesando tu mensaje"
      : state === "speaking"
        ? "El asistente está hablando"
        : "Hablar con el asistente";

  return (
    <Button
      type="button"
      variant={escuchando ? "destructive" : "outline"}
      size="icon"
      onClick={onToggle}
      disabled={ocupado}
      aria-label={etiqueta}
      title={etiqueta}
      // Se anuncia a lectores de pantalla como un interruptor, que es lo que
      // es: su estado importa tanto como su acción.
      aria-pressed={escuchando}
      data-testid="voice-button"
      className={cn(escuchando && "animate-pulse")}
    >
      {escuchando ? (
        <Square className="size-4" aria-hidden="true" />
      ) : state === "processing" ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : state === "speaking" ? (
        <Volume2 className="size-4" aria-hidden="true" />
      ) : (
        <Mic className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
