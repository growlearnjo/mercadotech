"use client";

/**
 * Banco de pruebas de la capa de voz (Fase 8.1). TEMPORAL: se borra en la 8.4.
 *
 * Existe para probar `useVoice` aislado, antes de que exista el agente. Si el
 * micrófono falla aquí, el problema es de la capa de voz; si aquí funciona y en
 * `/soporte` no, el problema es de cómo se compuso. Separar esas dos preguntas
 * es lo que hace que depurar la voz sea posible.
 *
 * No está en `(shop)`, así que no lleva navbar ni pide sesión: es una página de
 * desarrollo, no una pantalla del producto.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks/useVoice";

const TEXTO_DE_PRUEBA =
  "Tu pedido más reciente está en camino y debería llegar entre dos y cuatro días hábiles. ¿Quieres que te ayude con algo más?";

export default function VozDevPage() {
  const voz = useVoice();
  const [transcripcion, setTranscripcion] = React.useState("");

  const escuchando = voz.state === "listening";

  // Una pulsación abre el micrófono, la siguiente lo cierra y entrega el texto.
  async function alternarMicrofono() {
    if (escuchando) {
      const texto = await voz.stopListening();
      // Si falló (permiso denegado, silencio), `stopListening` ya dejó el
      // estado en `error` con su mensaje: no se pisa con "no se entendió".
      setTranscripcion(texto || "");
      if (texto) voz.cancel();
      return;
    }
    setTranscripcion("");
    await voz.startListening();
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Banco de pruebas de voz
        </h1>
        <p className="text-sm text-muted-foreground">
          Página temporal de la Fase 8.1. Comprueba el micrófono y la lectura en
          voz alta sin que exista todavía ningún agente.
        </p>
      </header>

      <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <p className="text-sm">
          Estado: <strong data-testid="voz-estado">{voz.state}</strong>
        </p>
        <p className="text-sm">
          ¿Este navegador reconoce voz?{" "}
          <strong>{voz.isVoiceSupported ? "sí" : "no"}</strong>
        </p>
        {!voz.isVoiceSupported ? (
          <p className="text-sm text-muted-foreground">
            Firefox todavía no implementa el reconocimiento de voz. La página
            sigue funcionando: en el producto real, todo lo que se puede decir
            se puede escribir.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <Button
          onClick={alternarMicrofono}
          disabled={!voz.isVoiceSupported || voz.state === "speaking"}
          variant={escuchando ? "destructive" : "default"}
        >
          {escuchando ? "Detener y transcribir" : "Hablar"}
        </Button>

        {escuchando ? (
          <p className="text-sm text-primary" role="status">
            🎤 Micrófono abierto — pulsa otra vez para terminar
          </p>
        ) : null}

        {voz.partialTranscript ? (
          <p className="rounded-md bg-muted p-3 text-sm italic text-muted-foreground">
            {voz.partialTranscript}
          </p>
        ) : null}

        {transcripcion ? (
          <p className="rounded-md border border-border p-3 text-sm">
            <span className="text-muted-foreground">Transcripción: </span>
            {transcripcion}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <Button variant="outline" onClick={() => voz.speak(TEXTO_DE_PRUEBA)}>
          Leer un texto en voz alta
        </Button>
        <Button variant="ghost" onClick={voz.cancel}>
          Cancelar todo
        </Button>
      </section>

      {voz.error ? (
        <p role="alert" className="text-sm text-destructive">
          {voz.error}
        </p>
      ) : null}
    </main>
  );
}
