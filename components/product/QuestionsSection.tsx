"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import type { Question } from "@/types/question";

type QuestionsSectionProps = {
  questions: Question[];
  loading?: boolean;
  error?: string | null;
  /** Hay sesión. Si no, se invita a entrar en vez de mostrar el formulario. */
  isAuthenticated: boolean;
  /** El usuario es el vendedor: puede responder. */
  isOwner: boolean;
  loginHref: string;
  onAsk: (text: string) => Promise<boolean>;
  onAnswer: (questionId: string, text: string) => Promise<boolean>;
};

/**
 * Autor de la pregunta.
 *
 * Decisión 8: `profiles` solo es legible por su dueño, así que no hay forma de
 * mostrar el nombre de quien preguntó sin una vista `public_profiles`
 * (migración nueva, fuera del alcance de esta sesión).
 */
const ASKER_LABEL = "Usuario";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Caja de respuesta del vendedor para una pregunta sin responder. */
function AnswerForm({
  questionId,
  onAnswer,
}: {
  questionId: string;
  onAnswer: QuestionsSectionProps["onAnswer"];
}) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  return (
    <form
      className="flex flex-col gap-2 pt-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim()) return;
        setSending(true);
        const ok = await onAnswer(questionId, text.trim());
        setSending(false);
        if (ok) setText("");
      }}
    >
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Responde a este comprador…"
        aria-label="Tu respuesta"
        rows={2}
      />
      <div>
        <Button type="submit" size="sm" disabled={sending || !text.trim()}>
          {sending ? "Publicando…" : "Responder"}
        </Button>
      </div>
    </form>
  );
}

export function QuestionsSection({
  questions,
  loading,
  error,
  isAuthenticated,
  isOwner,
  loginHref,
  onAsk,
  onAnswer,
}: QuestionsSectionProps) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">
        Preguntas y respuestas
      </h2>

      {/* El vendedor responde, no pregunta sobre su propio producto. */}
      {!isOwner ? (
        isAuthenticated ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!text.trim()) return;
              setSending(true);
              const ok = await onAsk(text.trim());
              setSending(false);
              if (ok) setText("");
            }}
          >
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="¿Qué quieres saber sobre este producto?"
              aria-label="Tu pregunta"
              rows={3}
            />
            <div>
              <Button type="submit" size="sm" disabled={sending || !text.trim()}>
                {sending ? "Enviando…" : "Preguntar"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Ingresa para preguntarle al vendedor.
            </p>
            <Button
              render={<Link href={loginHref} />}
              nativeButton={false}
              size="sm"
              variant="outline"
            >
              Ingresar
            </Button>
          </div>
        )
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingState variant="list" count={2} label="Cargando preguntas" />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="Todavía no hay preguntas"
          description="Sé el primero en preguntar sobre este producto."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((question) => (
            <li key={question.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">{ASKER_LABEL}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(question.created_at)}
                </span>
              </div>
              <p className="text-sm">{question.question}</p>

              {question.answer ? (
                <div className="mt-1 border-l-2 border-primary/40 pl-3">
                  <p className="text-xs font-medium text-primary">
                    Respuesta del vendedor
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {question.answer}
                  </p>
                </div>
              ) : isOwner ? (
                <AnswerForm questionId={question.id} onAnswer={onAnswer} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin responder todavía.
                </p>
              )}
              <Separator className="mt-3" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
