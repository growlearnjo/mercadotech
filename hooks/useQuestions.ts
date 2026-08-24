"use client";

import * as React from "react";

import * as questionService from "@/services/question.service";
import type { Question } from "@/types/question";

export function useQuestions(productId: string) {
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    let active = true;
    setLoading(true);
    questionService
      .listByProduct(productId)
      .then((data) => {
        if (active) setQuestions(data);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar las preguntas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  React.useEffect(() => load(), [load]);

  const ask = React.useCallback(
    async (userId: string, text: string) => {
      setError(null);
      try {
        const created = await questionService.create(productId, userId, text);
        // Se antepone: el orden de la lista es "más recientes primero".
        setQuestions((prev) => [created, ...prev]);
        return true;
      } catch {
        setError("No pudimos enviar tu pregunta.");
        return false;
      }
    },
    [productId],
  );

  const answer = React.useCallback(async (questionId: string, text: string) => {
    setError(null);
    // Actualización optimista: la respuesta aparece al instante y se revierte
    // si el servidor la rechaza (p. ej. no eres el vendedor).
    const previous = questions;
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, answer: text, answered_at: new Date().toISOString() }
          : q,
      ),
    );
    try {
      const updated = await questionService.answer(questionId, text);
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
      return true;
    } catch {
      setQuestions(previous);
      setError("No pudimos publicar la respuesta.");
      return false;
    }
  }, [questions]);

  return { questions, loading, error, ask, answer, reload: load };
}
